// The long-running half: `herdr-bobshell daemon`, started by herdr through the
// plugin's [[startup]] entry.
//
// Every tick it
//   - finds panes running Bob Shell, classifies their screen and reports
//     idle / working / blocked (+ "ctx NN%") so they show in herdr's sidebar
//     as agent `bobshell`, and releases panes that stopped running Bob;
//   - watches Bob's task store for running subagents and gives each one a
//     --no-focus tab in the workspace of the Bob pane that spawned it, running
//     `herdr-bobshell mirror <id>`; the tab closes when the subagent finishes.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as bob from "./bob-db.js";
import * as herdr from "./herdr.js";
import { AGENT, SOURCE, seq } from "./herdr.js";
import { bobCommand, classify, contextToken, isBareShell } from "./classify.js";
import { firstLine } from "./mirror.js";
import {
  BINDINGS_DIR, PID_FILE, TABS_FILE, ensureStateDirs, log, readJson, writeJson,
} from "./paths.js";

const num = (name, fallback) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
};
const POLL_MS = num("HERDR_BOBSHELL_POLL_SECONDS", 0.6) * 1000;
const SUBAGENT_POLL_MS = 1000;
const TAB_LINGER_MS = num("HERDR_BOBSHELL_TAB_LINGER", 0) * 1000;
const TABS_ENABLED = process.env.HERDR_BOBSHELL_TABS !== "0";
const HEARTBEAT_MS = 30_000;
const UNKNOWN_GRACE_MS = 3000;
const SHELL_READY_TIMEOUT_MS = 15_000;
// A 'running' row older than this with no live Bob pane behind it is a leftover
// from a crashed session, not something to open a tab for.
const STALE_SUBAGENT_MS = 6 * 3600 * 1000;
const LABEL_MAX = 36;

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "bin", "herdr-bobshell.js");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const short = (text, n = LABEL_MAX) => {
  text = (text || "").replace(/\s+/g, " ").trim();
  return text.length <= n ? text : `${text.slice(0, n - 1)}…`;
};
const shq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

// ── singleton ──────────────────────────────────────────────────────────────

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
}

async function claimSingleton() {
  ensureStateDirs();
  const old = Number(fs.existsSync(PID_FILE) && fs.readFileSync(PID_FILE, "utf8").trim());
  if (old && old !== process.pid && alive(old)) {
    log("daemon", `taking over from pid ${old}`);
    try { process.kill(old, "SIGTERM"); } catch {}
    for (let i = 0; i < 30 && alive(old); i++) await sleep(100);
  }
  fs.writeFileSync(PID_FILE, `${process.pid}\n`);
}

export function daemonPid() {
  const pid = Number(fs.existsSync(PID_FILE) && fs.readFileSync(PID_FILE, "utf8").trim());
  return pid && alive(pid) ? pid : null;
}

// ── sidebar state ──────────────────────────────────────────────────────────

const tracked = new Map(); // pane id -> { state, message, context, reportedAt, unknownSince }

async function report(paneId, cls, context) {
  const now = Date.now();
  const { state, message } = cls;
  if (!tracked.has(paneId)) tracked.set(paneId, { reportedAt: 0 });
  const entry = tracked.get(paneId);

  if (state === "unknown") {
    // Bob's boot frames match nothing; hold the last state for a moment.
    entry.unknownSince ??= now;
    if (now - entry.unknownSince < UNKNOWN_GRACE_MS) return;
  }

  const changed = entry.state !== state || entry.message !== message;
  if (changed || now - entry.reportedAt > HEARTBEAT_MS) {
    await herdr.call("pane.report_agent", { pane_id: paneId, source: SOURCE, agent: AGENT, state, message, seq: seq() });
    Object.assign(entry, { state, message, reportedAt: now });
  }
  if (state !== "unknown") entry.unknownSince = undefined;

  if (context !== entry.context || changed) {
    await herdr.call("pane.report_metadata", {
      pane_id: paneId, source: SOURCE, applies_to_source: SOURCE,
      tokens: { context: context ?? "" }, seq: seq(),
    });
    entry.context = context;
  }
}

async function release(paneId) {
  tracked.delete(paneId);
  await herdr.call("pane.release_agent", { pane_id: paneId, source: SOURCE, agent: AGENT, seq: seq() });
}

function bindings() {
  const out = new Map();
  let names = [];
  try { names = fs.readdirSync(BINDINGS_DIR); } catch {}
  for (const name of names) {
    const b = readJson(path.join(BINDINGS_DIR, name), null);
    if (b?.pane_id) out.set(b.pane_id, b);
  }
  return out;
}

// ── subagent tabs ──────────────────────────────────────────────────────────

let tabs = {}; // subagent id -> { tab, pane, host, workspace, opened_at, done_at? }
const skipped = new Set();
const saveTabs = () => writeJson(TABS_FILE, tabs);

/** The Bob pane a subagent belongs to: exact via hook binding, else by directory. */
function hostPane(sub, bobPanes, bound) {
  const root = bob.rootOf(sub.id);
  if (!root) return null;
  for (const pane of bobPanes) if (bound.get(pane.pane_id)?.root_task_id === root.id) return pane;
  const dir = (root.project_id || "").replace(/^file:/, "");
  const sameDir = bobPanes.filter((p) => (p.foreground_cwd || p.cwd) === dir && !bound.has(p.pane_id));
  return sameDir.length === 1 ? sameDir[0] : null;
}

async function launchMirror(subId, paneId) {
  const t0 = Date.now();
  for (;;) {
    const info = await herdr.processInfo(paneId);
    if (!info) return; // tab already gone
    if (isBareShell(info)) break;
    if (Date.now() - t0 > SHELL_READY_TIMEOUT_MS) {
      log("tabs", `shell in ${paneId} never became ready`);
      return;
    }
    await sleep(200);
  }
  // Leading space keeps it out of shell history (HIST_IGNORE_SPACE / atuin).
  await herdr.runInPane(paneId, ` exec ${shq(process.execPath)} ${shq(BIN)} mirror ${subId}`);
}

/** The mirror must read the same store and state as this daemon. */
function mirrorEnv() {
  const env = { HERDR_BOBSHELL_MIRROR: "1" };
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("HERDR_BOBSHELL_") || k === "XDG_STATE_HOME") env[k] = v;
  }
  return env;
}

async function openTab(sub, host) {
  const res = await herdr.createTab({
    workspaceId: host.workspace_id,
    cwd: (host.foreground_cwd || host.cwd) ?? undefined,
    label: `⚙ ${short(firstLine(sub.title)) || "subagent"}`,
    env: mirrorEnv(),
  });
  if (!res) return;
  tabs[sub.id] = { tab: res.tabId, pane: res.paneId, host: host.pane_id, workspace: host.workspace_id, opened_at: Date.now() };
  saveTabs();
  log("tabs", `open ${sub.id.slice(0, 8)} -> ${res.tabId} for ${host.pane_id}`);
  launchMirror(sub.id, res.paneId).catch((e) => log("tabs", `launch: ${e.message}`));
}

async function closeTab(subId, why) {
  const t = tabs[subId];
  delete tabs[subId];
  saveTabs();
  if (t) {
    await herdr.closeTab(t.tab);
    log("tabs", `close ${subId.slice(0, 8)} (${why})`);
  }
}

export async function closeAllTabs() {
  tabs = readJson(TABS_FILE, {});
  for (const id of Object.keys(tabs)) await closeTab(id, "uninstall");
}

async function syncTabs(panes, bobPanes, notBob) {
  const now = Date.now();
  const running = bob.runningSubagents();
  const runningIds = new Set(running.map((s) => s.id));
  const livePanes = new Set(panes.map((p) => p.pane_id));
  const livePaneTabs = new Set(panes.map((p) => p.tab_id));

  for (const [id, t] of Object.entries(tabs)) {
    if (!livePaneTabs.has(t.tab)) {
      delete tabs[id]; // closed by hand (or the mirror exited); don't reopen
      skipped.add(id);
      saveTabs();
    } else if (!livePanes.has(t.host) || notBob.has(t.host)) {
      await closeTab(id, "bob pane gone");
    } else if (!runningIds.has(id)) {
      t.done_at ??= now;
      if (now - t.done_at >= TAB_LINGER_MS) await closeTab(id, "finished");
    }
  }

  if (!TABS_ENABLED || !bobPanes.length) return;
  const bound = bindings();
  for (const sub of running) {
    if (tabs[sub.id] || skipped.has(sub.id)) continue;
    if (now - sub.updated_at > STALE_SUBAGENT_MS) {
      skipped.add(sub.id);
      continue;
    }
    const host = hostPane(sub, bobPanes, bound);
    if (host && livePanes.has(host.pane_id)) await openTab(sub, host);
  }
}

// ── main loop ──────────────────────────────────────────────────────────────

let stopping = false;

async function tick(state) {
  const panes = await herdr.listPanes();
  if (!panes) return;
  const mirrorPanes = new Set(Object.values(tabs).map((t) => t.pane));
  const bound = bindings();
  const bobPanes = [];
  const notBob = new Set();

  for (const pane of panes) {
    if (stopping) return;
    const id = pane.pane_id;
    if (mirrorPanes.has(id)) continue;
    // Panes herdr already knows as another agent can't be Bob.
    if (pane.agent && pane.agent !== AGENT && !tracked.has(id)) {
      notBob.add(id);
      continue;
    }
    const info = await herdr.processInfo(id);
    if (!info) continue;
    if (!bobCommand(info)) {
      notBob.add(id);
      if (tracked.has(id)) await release(id);
      continue;
    }
    bobPanes.push(pane);
    const text = await herdr.readScreen(id);
    if (text == null) continue;
    let cls = classify(text);
    const root = bound.get(id)?.root_task_id;
    if (cls.state !== "blocked" && root && bob.pendingApprovalCount(root) > 0) {
      cls = { state: "blocked", message: "awaiting approval" };
    }
    await report(id, cls, contextToken(text));
  }
  for (const id of [...tracked.keys()]) {
    if (!panes.some((p) => p.pane_id === id)) tracked.delete(id);
  }

  if (Date.now() - state.lastSubagentPoll >= SUBAGENT_POLL_MS) {
    state.lastSubagentPoll = Date.now();
    await syncTabs(panes, bobPanes, notBob);
  }
}

export async function runDaemon() {
  await claimSingleton();
  tabs = readJson(TABS_FILE, {});
  log("daemon", `started pid ${process.pid} (poll ${POLL_MS}ms, tabs ${TABS_ENABLED ? "on" : "off"}, linger ${TAB_LINGER_MS}ms)`);

  const shutdown = async (signal) => {
    if (stopping) return;
    stopping = true;
    log("daemon", `${signal}: releasing ${tracked.size} pane(s)`);
    await Promise.all([...tracked.keys()].map(release));
    try {
      if (Number(fs.readFileSync(PID_FILE, "utf8")) === process.pid) fs.unlinkSync(PID_FILE);
    } catch {}
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGHUP", () => shutdown("SIGHUP"));

  const state = { lastSubagentPoll: 0 };
  while (!stopping) {
    const started = Date.now();
    try {
      await tick(state);
    } catch (e) {
      log("daemon", `tick: ${e.stack || e.message}`);
    }
    await sleep(Math.max(50, POLL_MS - (Date.now() - started)));
  }
}
