import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { configureBobHooks } from "../src/install.js";

test("Bob hook wiring is idempotent and leaves other hooks alone", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "herdr-bobshell-"));
  const file = path.join(dir, "settings.json");
  const theirs = { matcher: "*", hooks: [{ type: "command", command: "echo mine" }] };
  fs.writeFileSync(file, JSON.stringify({ session: { a: 1 }, hooks: { PreToolUse: [theirs] } }));

  configureBobHooks(true, file);
  configureBobHooks(true, file);
  let s = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(s.session.a, 1);
  assert.equal(s.hooks.PreToolUse.length, 2);
  assert.deepEqual(s.hooks.PreToolUse[0], theirs);
  assert.match(s.hooks.PreToolUse[1].hooks[0].command, /herdr-bobshell\.js' hook$/);
  assert.equal(s.hooks.SessionStart.length, 1);
  assert.equal(s.hooks.PostToolUse.length, 1);

  configureBobHooks(false, file);
  s = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.deepEqual(s.hooks, { PreToolUse: [theirs] });
});
