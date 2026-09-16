// Bob Shell screen rules and process matching.
//
// herdr can't be taught a new agent through a detection manifest (its manifest
// system only patches agents compiled into the binary), so Bob panes are
// classified here and pushed back through pane.report_agent. Every rule traces
// to a captured screen in test/fixtures.

import path from "node:path";

export const BOTTOM_LINES = 14;
const TITLE_LINES = 30;

const RULE_LINE_RE = /^\s*─{10,}\s*$/;
const SPINNER_RE = /^\s*[⠀-⣿]\s+(\S.*?)\s*$/;
const PROMPT_BOX_RE = /^\s*│\s*❯/;
const STATUS_LINE_RE = /^\s*Agent Mode(?:\s|·|$)/;
const CONTEXT_RE = /\((\d{1,3})%\)/;
const BLOCKED_CONFIRM = "press enter to confirm";
const BLOCKED_CHOICES = ["approve once", "always allow", "reject", "(tab to toggle)"];

const BOB_COMMANDS = new Set(["bob", "bob2"]);
// `bob` comes from npm `bobshell`, `bob2` from `bob-shell`. The npm bins are
// symlinks to a node script, so a pane usually reports `node …/bob.js`.
const BOB_PATH_RE = /(bobshell|bob-shell)[/\\](?:dist[/\\])?bob\.js/;
const PACKAGE_COMMANDS = { bobshell: "bob", "bob-shell": "bob2" };
export const SHELL_NAMES = new Set(["zsh", "bash", "sh", "fish", "dash", "ksh"]);

function bottomLines(text, count = BOTTOM_LINES) {
  return (text || "").split("\n").filter((l) => l.trim()).slice(-count);
}

function approvalTitle(text) {
  // Bob brackets an approval form's title in horizontal rules.
  const lines = bottomLines(text, TITLE_LINES);
  let title = null;
  for (let i = 0; i + 2 < lines.length; i++) {
    if (RULE_LINE_RE.test(lines[i]) && RULE_LINE_RE.test(lines[i + 2]) && !RULE_LINE_RE.test(lines[i + 1])) {
      title = lines[i + 1].trim();
    }
  }
  return title;
}

/** Classify a detection snapshot. Order matters: blocked > working > idle. */
export function classify(text) {
  const lines = bottomLines(text);
  const lowered = lines.map((l) => l.toLowerCase());

  const hasConfirm = lowered.some((l) => l.includes(BLOCKED_CONFIRM));
  const hasChoice = lowered.some((l) => BLOCKED_CHOICES.some((c) => l.includes(c)));
  if (hasConfirm && hasChoice) {
    const title = approvalTitle(text);
    return { state: "blocked", message: title ? `awaiting approval: ${title}` : "awaiting approval" };
  }
  for (const line of [...lines].reverse()) {
    const m = SPINNER_RE.exec(line);
    if (m) return { state: "working", message: m[1] };
  }
  if (lines.some((l) => PROMPT_BOX_RE.test(l) || STATUS_LINE_RE.test(l))) {
    return { state: "idle", message: null };
  }
  return { state: "unknown", message: null };
}

/** "ctx 47%" from Bob's `Agent Mode · 34k / 270k (13%)` status line. */
export function contextToken(text) {
  for (const line of bottomLines(text).reverse()) {
    if (!STATUS_LINE_RE.test(line)) continue;
    const m = CONTEXT_RE.exec(line);
    return m ? `ctx ${m[1]}%` : null;
  }
  return null;
}

function* processNames(info) {
  for (const p of info?.foreground_processes ?? []) {
    const argv0 = (p.argv0 || "").replace(/^-/, "");
    if (argv0) yield [argv0, null];
    const args = p.argv?.length ? p.argv : (p.cmdline || "").split(/\s+/).filter(Boolean);
    for (const arg of args) yield [path.basename(arg), arg];
  }
}

/** "bob" / "bob2" when the pane is running Bob Shell, else null. */
export function bobCommand(info) {
  for (const [name, arg] of processNames(info)) {
    if (BOB_COMMANDS.has(name)) return name;
    const m = BOB_PATH_RE.exec(arg || name);
    if (m) return PACKAGE_COMMANDS[m[1]];
  }
  return null;
}

/** True when the pane sits at its own shell with nothing else in the foreground. */
export function isBareShell(info) {
  const fg = info?.foreground_processes ?? [];
  if (fg.length !== 1) return false;
  const name = path.basename(fg[0].argv0 || fg[0].name || "").replace(/^-/, "");
  return SHELL_NAMES.has(name);
}
