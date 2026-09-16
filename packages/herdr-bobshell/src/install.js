// `herdr-bobshell install | uninstall | status`
//
// install wires both halves and is idempotent:
//   - adds this package's hook to Bob's global settings (every event it needs),
//   - links this directory as a herdr plugin so herdr starts the daemon,
//   - starts the daemon now, so no herdr server restart (which would kill
//     live panes) is needed.

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closeAllTabs, daemonPid } from "./daemon.js";
import { call } from "./herdr.js";
import { BOB_DB, BOB_SETTINGS, LOG_FILE, PID_FILE, SOCKET_PATH, STATE_DIR, ensureStateDirs, readJson } from "./paths.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BIN = path.join(ROOT, "bin", "herdr-bobshell.js");
const PLUGIN_ID = "herdr-bobshell-connector";
const HOOK_MARK = "herdr-bobshell.js";
// Prefer the `node` on PATH (e.g. /opt/homebrew/bin/node) over process.execPath,
// which is a versioned Cellar path that disappears on the next upgrade.
const NODE = (() => {
  const found = spawnSync("sh", ["-c", "command -v node"], { encoding: "utf8" }).stdout.trim();
  try {
    if (found && fs.realpathSync(found) === fs.realpathSync(process.execPath)) return found;
  } catch {}
  return process.execPath;
})();
const HOOK_COMMAND = `'${NODE}' '${BIN}' hook`;
const HOOK_EVENTS = { SessionStart: 5, PreToolUse: 3, PostToolUse: 3 };

const mark = (code, sym) => (process.stdout.isTTY ? `\x1b[${code}m${sym}\x1b[0m` : sym);
const ok = (msg) => console.log(`  ${mark(32, "✓")} ${msg}`);
const warn = (msg) => console.log(`  ${mark(33, "!")} ${msg}`);
const bad = (msg) => console.log(`  ${mark(31, "✗")} ${msg}`);

const isOurs = (group) => (group?.hooks ?? []).some((h) => (h.command || "").includes(HOOK_MARK));

function herdrCli(...args) {
  const p = spawnSync("herdr", args, { encoding: "utf8" });
  return { ok: p.status === 0, out: `${p.stdout || ""}${p.stderr || ""}`.trim() };
}

export function configureBobHooks(install, file = BOB_SETTINGS) {
  const settings = fs.existsSync(file) ? readJson(file, null) : {};
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    throw new Error(`${file} is not a JSON object; not touching it`);
  }
  const hooks = settings.hooks ?? {};
  for (const event of Object.keys(HOOK_EVENTS)) {
    const groups = (hooks[event] ?? []).filter((g) => !isOurs(g));
    if (install) {
      groups.push({ matcher: "*", hooks: [{ type: "command", command: HOOK_COMMAND, timeout: HOOK_EVENTS[event] }] });
    }
    if (groups.length) hooks[event] = groups;
    else delete hooks[event];
  }
  if (Object.keys(hooks).length) settings.hooks = hooks;
  else delete settings.hooks;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.herdr-bobshell.bak`);
  fs.writeFileSync(file, JSON.stringify(settings, null, 2) + "\n");
}

/** Where herdr currently has this plugin linked from, or null. */
function linkedRoot() {
  const res = herdrCli("plugin", "list", "--json");
  try {
    const plugins = JSON.parse(res.out).result?.plugins ?? [];
    return plugins.find((p) => p.plugin_id === PLUGIN_ID)?.plugin_root ?? null;
  } catch {
    return null;
  }
}

function startDaemon() {
  ensureStateDirs();
  const logFd = fs.openSync(LOG_FILE, "a");
  const child = spawn(NODE, [BIN, "daemon"], {
    detached: true,
    stdio: ["ignore", logFd, logFd],
    cwd: ROOT,
  });
  child.unref();
  return child.pid;
}

function stopDaemon() {
  const pid = daemonPid();
  if (pid) process.kill(pid, "SIGTERM");
  return pid;
}

export async function install() {
  console.log("herdr-bobshell-connector: install");
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 13)) {
    bad(`node ${process.versions.node} is too old (need 22.13+ for node:sqlite)`);
    process.exitCode = 1;
    return;
  }
  const version = herdrCli("--version");
  if (!version.ok) {
    bad("herdr not found on PATH");
    process.exitCode = 1;
    return;
  }
  ok(version.out);
  if (!fs.existsSync(BOB_DB)) warn(`Bob task store not found yet at ${BOB_DB} (it appears after Bob's first run)`);

  configureBobHooks(true);
  ok(`Bob hooks (${Object.keys(HOOK_EVENTS).join(", ")}) -> ${BOB_SETTINGS}`);

  const linked = linkedRoot();
  if (linked && fs.realpathSync(linked) === fs.realpathSync(ROOT)) {
    ok("herdr plugin already linked");
  } else {
    // Linked from somewhere else (e.g. a dev checkout): point herdr here instead.
    if (linked) herdrCli("plugin", "unlink", PLUGIN_ID);
    const link = herdrCli("plugin", "link", ROOT);
    if (link.ok) ok(`herdr plugin linked (${ROOT})`);
    else {
      bad(`herdr plugin link failed: ${link.out}`);
      process.exitCode = 1;
    }
  }

  stopDaemon();
  const pid = startDaemon();
  ok(`daemon started (pid ${pid}); herdr will start it on its own from now on`);
  console.log("\nRestart any running bob sessions so they pick up the hooks.");
}

export async function uninstall({ purge = false } = {}) {
  console.log("herdr-bobshell-connector: uninstall");
  const pid = stopDaemon();
  ok(pid ? `daemon stopped (pid ${pid})` : "daemon was not running");
  await closeAllTabs();
  ok("subagent tabs closed");
  configureBobHooks(false);
  ok(`Bob hooks removed from ${BOB_SETTINGS}`);
  const unlink = herdrCli("plugin", "unlink", PLUGIN_ID);
  if (unlink.ok) ok("herdr plugin unlinked");
  else warn(`herdr plugin unlink: ${unlink.out}`);
  if (purge) {
    fs.rmSync(STATE_DIR, { recursive: true, force: true });
    ok(`removed ${STATE_DIR}`);
  }
}

export async function status() {
  console.log("herdr-bobshell-connector: status");
  const pong = await call("ping");
  (pong ? ok : bad)(`herdr socket ${SOCKET_PATH}`);
  const linked = linkedRoot();
  (linked ? ok : bad)(linked ? `herdr plugin linked from ${linked}` : "herdr plugin not linked");
  const settings = readJson(BOB_SETTINGS, {});
  const missing = Object.keys(HOOK_EVENTS).filter((e) => !(settings.hooks?.[e] ?? []).some(isOurs));
  (missing.length ? bad : ok)(missing.length ? `Bob hooks missing: ${missing.join(", ")}` : `Bob hooks in ${BOB_SETTINGS}`);
  if (settings.disableGlobalHooks) bad("Bob has disableGlobalHooks: true — the hooks will not run");
  (fs.existsSync(BOB_DB) ? ok : bad)(`Bob task store ${BOB_DB}`);
  const pid = daemonPid();
  (pid ? ok : bad)(pid ? `daemon running (pid ${pid})` : `daemon not running (${PID_FILE})`);

  const panes = (await call("pane.list"))?.panes ?? [];
  const bobPanes = panes.filter((p) => p.agent === "bobshell");
  console.log(`\n  bob panes in sidebar: ${bobPanes.length}`);
  for (const p of bobPanes) console.log(`    ${p.pane_id}  ${p.agent_status}  ${p.cwd}`);
  const tabs = readJson(path.join(STATE_DIR, "tabs.json"), {});
  console.log(`  open subagent tabs: ${Object.keys(tabs).length}`);
  for (const [id, t] of Object.entries(tabs)) console.log(`    ${t.tab}  ${id.slice(0, 8)}  (from ${t.host})`);
  console.log(`\n  log: ${LOG_FILE}`);
}
