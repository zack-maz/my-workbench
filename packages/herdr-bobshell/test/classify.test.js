import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { bobCommand, classify, contextToken, isBareShell } from "../src/classify.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

// Fixtures are named <expected-state>-<what>.txt.
for (const name of fs.readdirSync(FIXTURES).filter((f) => f.endsWith(".txt"))) {
  test(`classifies ${name}`, () => {
    const text = fs.readFileSync(path.join(FIXTURES, name), "utf8");
    assert.equal(classify(text).state, name.split("-")[0]);
  });
}

test("blocked message carries the approval form title", () => {
  const text = fs.readFileSync(path.join(FIXTURES, "blocked-exec-approval.txt"), "utf8");
  assert.match(classify(text).message, /^awaiting approval/);
});

test("working message is the spinner text", () => {
  assert.deepEqual(classify("⠸ Processing…\n│ ❯ \n"), { state: "working", message: "Processing…" });
});

test("context token from the status line", () => {
  assert.equal(contextToken("Agent Mode · 34k / 270k (13%)"), "ctx 13%");
  assert.equal(contextToken("nothing here"), null);
});

test("recognises bob through its node wrapper", () => {
  const info = (argv) => ({ foreground_processes: [{ argv0: argv[0], argv, cmdline: argv.join(" ") }] });
  assert.equal(bobCommand(info(["node", "/opt/homebrew/bin/bob"])), "bob");
  assert.equal(bobCommand(info(["node", "/opt/homebrew/lib/node_modules/bob-shell/dist/bob.js"])), "bob2");
  assert.equal(bobCommand(info(["claude", "--resume"])), null);
});

test("bare shell detection", () => {
  assert.equal(isBareShell({ foreground_processes: [{ argv0: "-zsh", name: "zsh" }] }), true);
  assert.equal(isBareShell({ foreground_processes: [{ argv0: "node", name: "node" }] }), false);
});
