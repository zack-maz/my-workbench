// Bob Shell hook entry point: `herdr-bobshell hook` (stdin = Bob's hook JSON).
//
// Bob runs hooks inside its own process environment, so HERDR_PANE_ID tells us
// exactly which herdr pane this Bob lives in. Two jobs:
//
//   1. Bind the pane to Bob's root task (`session_id`), so the daemon knows
//      which workspace a new subagent's tab belongs in.
//   2. Record tool calls. Subagents inherit the parent's PreToolUse /
//      PostToolUse hooks, and while spawn_subagent runs the parent itself is
//      parked, so those calls are the subagents' live activity — Bob doesn't
//      persist subagent messages until they finish.
//
// Bob treats stdout from SessionStart/PostToolUse as extra model context and
// warns on non-JSON PreToolUse output, so this prints nothing and always exits 0.

import fs from "node:fs";
import { ACTIVITY_DIR, activityFile, ensureStateDirs, log, paneFile, writeJson } from "./paths.js";
import { AGENT, SOURCE, call, seq } from "./herdr.js";

const MAX_ARG = 400;
const MAX_RESULT_LINES = 8;
const ACTIVITY_MAX_AGE_MS = 7 * 24 * 3600 * 1000;

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function clip(text, n) {
  text = String(text ?? "");
  return text.length <= n ? text : `${text.slice(0, n - 1)}…`;
}

/** The one argument worth showing for a tool call. */
export function primaryArg(input) {
  if (!input || typeof input !== "object") return "";
  for (const key of ["command", "path", "file_path", "pattern", "regex", "query", "url", "description", "question"]) {
    if (typeof input[key] === "string" && input[key].trim()) return input[key];
  }
  if (Array.isArray(input.files) && input.files[0]?.path) {
    return input.files.map((f) => f.path).join(", ");
  }
  for (const value of Object.values(input)) if (typeof value === "string" && value.trim()) return value;
  return "";
}

function resultText(response) {
  if (typeof response === "string") return response;
  if (Array.isArray(response)) {
    return response.map((b) => (typeof b === "string" ? b : b?.text ?? "")).join("\n");
  }
  if (response && typeof response === "object") {
    return typeof response.content === "string" ? response.content : JSON.stringify(response);
  }
  return "";
}

function recordActivity(payload) {
  const entry = {
    t: Date.now(),
    event: payload.hook_event_name,
    tool: payload.tool_name,
    id: payload.tool_use_id || "",
  };
  if (payload.hook_event_name === "PreToolUse") {
    entry.arg = clip(primaryArg(payload.tool_input), MAX_ARG);
  } else {
    const lines = resultText(payload.tool_response).replace(/\s+$/, "").split("\n");
    entry.lines = lines.length;
    entry.head = lines.slice(0, MAX_RESULT_LINES).map((l) => clip(l, 200));
  }
  fs.appendFileSync(activityFile(payload.session_id), JSON.stringify(entry) + "\n");
}

function pruneActivity() {
  const cutoff = Date.now() - ACTIVITY_MAX_AGE_MS;
  for (const name of fs.readdirSync(ACTIVITY_DIR)) {
    const file = `${ACTIVITY_DIR}/${name}`;
    try {
      if (fs.statSync(file).mtimeMs < cutoff) fs.unlinkSync(file);
    } catch {}
  }
}

export async function runHook() {
  const paneId = process.env.HERDR_PANE_ID;
  if (process.env.HERDR_ENV !== "1" || !paneId) return;
  let payload;
  try {
    payload = JSON.parse(readStdin() || "{}");
  } catch {
    return;
  }
  const event = payload.hook_event_name;
  const root = payload.session_id;
  if (!event || !root) return;

  try {
    ensureStateDirs();
    writeJson(paneFile(paneId), {
      pane_id: paneId,
      workspace_id: process.env.HERDR_WORKSPACE_ID || null,
      root_task_id: root,
      cwd: payload.cwd || process.cwd(),
      updated_at: Date.now(),
    });

    if (event === "PreToolUse" || event === "PostToolUse") {
      recordActivity(payload);
    } else if (event === "SessionStart") {
      pruneActivity();
      await call(
        "pane.report_agent_session",
        { pane_id: paneId, source: SOURCE, agent: AGENT, agent_session_id: root, session_start_source: payload.source ?? null, seq: seq() },
        { timeoutMs: 800 },
      );
    }
  } catch (e) {
    log("hook", `${event}: ${e.message}`);
  }
}
