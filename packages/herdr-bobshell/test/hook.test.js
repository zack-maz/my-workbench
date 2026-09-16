import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BIN = path.join(ROOT, "bin", "herdr-bobshell.js");

function runHook(payload, stateDir) {
  return spawnSync(process.execPath, [BIN, "hook"], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    env: {
      ...process.env,
      HERDR_ENV: "1",
      HERDR_PANE_ID: "wT:p9",
      HERDR_WORKSPACE_ID: "wT",
      HERDR_SOCKET_PATH: path.join(stateDir, "no.sock"),
      HERDR_BOBSHELL_STATE_DIR: stateDir,
    },
  });
}

test("hook binds the pane and records tool activity, printing nothing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "herdr-bobshell-"));
  const base = { session_id: "root123", cwd: "/tmp/proj" };

  let p = runHook({ ...base, hook_event_name: "SessionStart", source: "startup" }, dir);
  assert.equal(p.status, 0);
  assert.equal(p.stdout, "");

  p = runHook({ ...base, hook_event_name: "PreToolUse", tool_name: "read_file", tool_input: { path: "a.txt" }, tool_use_id: "t1" }, dir);
  assert.equal(p.stdout, "");
  p = runHook({ ...base, hook_event_name: "PostToolUse", tool_name: "read_file", tool_input: {}, tool_response: "one\ntwo", tool_use_id: "t1" }, dir);
  assert.equal(p.stdout, "");

  const binding = JSON.parse(fs.readFileSync(path.join(dir, "bindings", "wT_p9.json"), "utf8"));
  assert.equal(binding.root_task_id, "root123");
  assert.equal(binding.workspace_id, "wT");

  const lines = fs.readFileSync(path.join(dir, "activity", "root123.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(lines.length, 2);
  assert.deepEqual([lines[0].event, lines[0].tool, lines[0].arg], ["PreToolUse", "read_file", "a.txt"]);
  assert.deepEqual([lines[1].lines, lines[1].head], [2, ["one", "two"]]);
});

test("hook is a no-op outside herdr", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "herdr-bobshell-"));
  const p = spawnSync(process.execPath, [BIN, "hook"], {
    input: JSON.stringify({ session_id: "x", hook_event_name: "SessionStart" }),
    encoding: "utf8",
    env: { ...process.env, HERDR_ENV: "", HERDR_BOBSHELL_STATE_DIR: dir },
  });
  assert.equal(p.status, 0);
  assert.equal(fs.existsSync(path.join(dir, "bindings")), false);
});
