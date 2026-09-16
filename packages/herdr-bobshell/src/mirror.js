// What runs inside a subagent's tab: `herdr-bobshell mirror <subagent-id>`.
//
// Shows the spawn_subagent prompt, then follows the root task's hook activity
// log for the subagent's tool calls as they happen, and a short summary once
// Bob marks the subagent completed. The daemon closes the tab.

import fs from "node:fs";
import * as bob from "./bob-db.js";
import { activityFile } from "./paths.js";

const POLL_MS = 400;
const HEARTBEAT_MS = 30_000;

const tty = process.stdout.isTTY;
// Piped into `head` or the tab closing under us: just stop.
process.stdout.on("error", (e) => process.exit(e.code === "EPIPE" ? 0 : 1));
const paint = (code) => (text) => (tty ? `\x1b[${code}m${text}\x1b[0m` : text);
const bold = paint("1");
const dim = paint("2");
const cyan = paint("1;36");
const green = paint("32");
const red = paint("31");
const cols = () => Math.max(40, process.stdout.columns || 100);
const out = (line = "") => process.stdout.write(line + "\n");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const firstLine = (text) => (text || "").split("\n").map((l) => l.trim()).find(Boolean) || "";

function fit(line, indent = 0) {
  const width = cols() - indent;
  return " ".repeat(indent) + (line.length > width ? `${line.slice(0, width - 1)}…` : line);
}

function wrap(text, indent = 0) {
  const width = cols() - indent;
  const lines = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if (line && line.length + word.length + 1 > width) {
        lines.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    lines.push(line);
  }
  return lines.map((l) => " ".repeat(indent) + l);
}

function block(text, maxLines, indent = 2, style = (s) => s) {
  const lines = wrap(text.trim(), indent);
  for (const line of lines.slice(0, maxLines)) out(style(line));
  if (lines.length > maxLines) out(dim(`${" ".repeat(indent)}… +${lines.length - maxLines} lines`));
}

export function formatTokens(n) {
  if (!n) return "0";
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n);
}

function stats(sub, extra = []) {
  const end = sub.status === "running" ? Date.now() : sub.updated_at;
  const secs = Math.round((end - sub.created_at) / 1000);
  const elapsed = secs >= 60 ? `${Math.floor(secs / 60)}m${String(secs % 60).padStart(2, "0")}s` : `${secs}s`;
  const c = sub.costs ?? {};
  const parts = [elapsed, ...extra];
  if (c.contextTokens) parts.push(`${formatTokens(c.contextTokens)} ctx`);
  if (c.cost) parts.push(`$${c.cost.toFixed(3)}`);
  return parts.join(" · ");
}

export function renderActivity(entry) {
  if (entry.event === "PreToolUse") {
    out(cyan(fit(`▶ ${entry.tool}`)));
    for (const line of (entry.arg || "").trim().split("\n").slice(0, 3)) if (line) out(dim(fit(line, 2)));
    return;
  }
  const tag = `  ✓ ${entry.tool}${entry.lines > 8 ? `  (${entry.lines} lines)` : ""}`;
  out(dim(tag));
  for (const line of entry.head ?? []) out(dim(fit(line, 4)));
  if (entry.lines > (entry.head?.length ?? 0)) out(dim("    …"));
  out();
}

/** Yields new complete JSON lines appended to `file` since the last call. */
function follower(file) {
  let offset = 0;
  let partial = "";
  return () => {
    let fd;
    try {
      fd = fs.openSync(file, "r");
    } catch {
      return [];
    }
    try {
      const size = fs.fstatSync(fd).size;
      if (size < offset) offset = 0;
      if (size === offset) return [];
      const buf = Buffer.alloc(size - offset);
      fs.readSync(fd, buf, 0, buf.length, offset);
      offset = size;
      const lines = (partial + buf.toString("utf8")).split("\n");
      partial = lines.pop();
      return lines.flatMap((l) => {
        try {
          return [JSON.parse(l)];
        } catch {
          return [];
        }
      });
    } finally {
      fs.closeSync(fd);
    }
  };
}

async function waitFor(fn, ms) {
  const deadline = Date.now() + ms;
  for (;;) {
    const value = fn();
    if (value || Date.now() > deadline) return value;
    await sleep(250);
  }
}

export async function runMirror(subagentId) {
  let sub = await waitFor(() => bob.getTask(subagentId), 10_000);
  if (!sub) {
    out(red(`subagent ${subagentId} not found in Bob's task store`));
    return;
  }
  const root = bob.rootOf(sub.id);
  const call = await waitFor(() => bob.spawnCall(sub), 5_000);

  out(bold(fit(`⚙ ${firstLine(sub.title)}`)));
  out(dim(`bob subagent · ${call?.name || "general"}${call?.fork_context ? " · forked context" : ""} · ${sub.id.slice(0, 8)}`));
  out();
  out(bold("prompt"));
  block(sub.title, 20);
  out();

  const since = sub.created_at - 1000;
  const next = follower(activityFile(root?.id ?? sub.parent_id));
  let lastOutput = Date.now();
  let sharedNoted = false;

  for (;;) {
    for (const entry of next()) {
      if (entry.t < since || entry.tool === "spawn_subagent") continue;
      renderActivity(entry);
      lastOutput = Date.now();
    }

    sub = bob.getTask(subagentId) ?? sub;
    if (sub.status !== "running") break;

    if (!sharedNoted) {
      const siblings = bob.runningSubagents().filter((s) => s.parent_id === sub.parent_id).length;
      if (siblings > 1) {
        out(dim(`(${siblings} subagents are running in parallel; Bob doesn't say which one made each tool call, so every tab shows all of them)`));
        out();
        sharedNoted = true;
      }
    }
    if (Date.now() - lastOutput > HEARTBEAT_MS) {
      out(dim(`… ${stats(sub)}`));
      lastOutput = Date.now();
    }
    await sleep(POLL_MS);
  }

  const result = await waitFor(() => bob.subagentResult(sub), 5_000);
  const ok = sub.status === "completed";
  const extra = result?.meta?.toolUseCount != null ? [`${result.meta.toolUseCount} tool calls`] : [];
  out((ok ? green : red)(bold(`${ok ? "✓ done" : `✗ ${sub.status}`}  ${stats(sub, extra)}`)));
  if (typeof result?.content === "string" && result.content.trim()) {
    out();
    block(result.content.replace(/<\/?task_result>/g, ""), 40, 2);
  }
  // A daemon-launched mirror stays up until the daemon closes its tab.
  // (A bare pending promise wouldn't keep the event loop alive; a timer does.)
  if (process.env.HERDR_BOBSHELL_MIRROR === "1") setInterval(() => {}, 1 << 30);
}
