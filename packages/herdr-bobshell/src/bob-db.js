// Read-only view of Bob Shell's task store (~/.bob/db/bob.db, SQLite in WAL
// mode, so reading alongside a live Bob is safe).
//
// What Bob persists about subagents, and when (bobshell 2.0.x):
//   - spawn_subagent inserts a `tasks` row { task_type: 'subagent',
//     status: 'running', parent_id, title: <description> } before the
//     subagent's first turn, and flips it to 'completed' when it returns.
//     `costs` is updated live as the subagent spends.
//   - The subagent's own messages are NOT written while it runs. They land
//     afterwards inside the parent's `tool` message for that call
//     (`_meta.subagentId`, `messages[]`).

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import { BOB_DB, log } from "./paths.js";

let db = null;

function open() {
  if (db) return db;
  if (!fs.existsSync(BOB_DB)) return null;
  try {
    db = new DatabaseSync(BOB_DB, { readOnly: true });
    db.exec("PRAGMA busy_timeout = 2000");
  } catch (e) {
    log("db", `open failed: ${e.message}`);
    db = null;
  }
  return db;
}

function all(sql, ...params) {
  const conn = open();
  if (!conn) return [];
  try {
    return conn.prepare(sql).all(...params);
  } catch (e) {
    log("db", `query failed: ${e.message}`);
    // A replaced/rotated file leaves a stale handle; reopen next time.
    try { conn.close(); } catch {}
    db = null;
    return [];
  }
}

const get = (sql, ...params) => all(sql, ...params)[0] ?? null;

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

const TASK_COLS = "id, parent_id, project_id, title, status, task_type, costs, created_at, updated_at";

function toTask(row) {
  return row && { ...row, costs: parseJson(row.costs) };
}

export function getTask(id) {
  return toTask(get(`SELECT ${TASK_COLS} FROM tasks WHERE id = ?`, id));
}

/** Subagents Bob currently has running, oldest first. */
export function runningSubagents() {
  return all(
    `SELECT ${TASK_COLS} FROM tasks WHERE task_type = 'subagent' AND status = 'running' ORDER BY created_at`,
  ).map(toTask);
}

/** The top-level task a subtask/subagent belongs to — Bob's hook `session_id`. */
export function rootOf(taskId) {
  let task = getTask(taskId);
  for (let hops = 0; task?.parent_id && hops < 16; hops++) task = getTask(task.parent_id);
  return task;
}

/** Most recently active top-level task in a directory. */
export function latestRootFor(cwd) {
  return toTask(
    get(
      `SELECT ${TASK_COLS} FROM tasks
        WHERE project_id = ? AND parent_id IS NULL
          AND EXISTS (SELECT 1 FROM messages m WHERE m.task_id = tasks.id)
        ORDER BY updated_at DESC LIMIT 1`,
      `file:${cwd}`,
    ),
  );
}

/** Tasks with an approval Bob is waiting on — a precise "blocked" signal. */
export function pendingApprovalCount(taskId) {
  return get("SELECT count(*) AS n FROM task_pending_approvals WHERE task_id = ?", taskId)?.n ?? 0;
}

/**
 * The spawn_subagent call that started `sub`: the newest parent assistant
 * message whose toolCalls include one whose description matches the row title.
 */
export function spawnCall(sub) {
  if (!sub?.parent_id) return null;
  const rows = all(
    `SELECT data FROM messages WHERE task_id = ? AND role = 'assistant' AND data LIKE '%spawn_subagent%'
      ORDER BY created_at DESC LIMIT 10`,
    sub.parent_id,
  );
  for (const row of rows) {
    for (const call of parseJson(row.data)?.toolCalls ?? []) {
      if (call.name !== "spawn_subagent") continue;
      const args = call.arguments ?? {};
      if ((args.mask || args.description) === sub.title) return { id: call.id, ...args };
    }
  }
  return null;
}

/** The finished tool message for a subagent: result text, metadata, full transcript. */
export function subagentResult(sub) {
  if (!sub?.parent_id) return null;
  const row = get(
    `SELECT data FROM messages WHERE task_id = ? AND role = 'tool' AND data LIKE ? ORDER BY created_at DESC LIMIT 1`,
    sub.parent_id,
    `%"subagentId":"${sub.id}"%`,
  );
  const msg = parseJson(row?.data);
  if (!msg || msg._meta?.subagentId !== sub.id) return null;
  return { content: msg.content, meta: msg._meta, messages: msg.messages ?? [] };
}
