// Every file this package reads or writes, in one place. All overridable by
// environment so tests and odd setups don't have to touch the real ones.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const home = os.homedir();
const env = process.env;

const xdgConfig = env.XDG_CONFIG_HOME || path.join(home, ".config");
const xdgState = env.XDG_STATE_HOME || path.join(home, ".local", "state");

export const HERDR_CONFIG_DIR = env.HERDR_CONFIG_DIR || path.join(xdgConfig, "herdr");
export const SOCKET_PATH = env.HERDR_SOCKET_PATH || path.join(HERDR_CONFIG_DIR, "herdr.sock");

export const BOB_HOME = env.HERDR_BOBSHELL_BOB_HOME || path.join(home, ".bob");
export const BOB_DB = env.HERDR_BOBSHELL_DB || path.join(BOB_HOME, "db", "bob.db");
// Bob 2.x reads global hooks from <bob home>/settings/settings.json.
export const BOB_SETTINGS = env.HERDR_BOBSHELL_BOB_SETTINGS || path.join(BOB_HOME, "settings", "settings.json");

export const STATE_DIR = env.HERDR_BOBSHELL_STATE_DIR || path.join(xdgState, "herdr", "bobshell");
export const BINDINGS_DIR = path.join(STATE_DIR, "bindings"); // <pane>.json: pane -> Bob root task
export const ACTIVITY_DIR = path.join(STATE_DIR, "activity"); // <root task>.jsonl: tool calls from hooks
export const TABS_FILE = path.join(STATE_DIR, "tabs.json"); // subagent id -> open herdr tab
export const PID_FILE = path.join(STATE_DIR, "daemon.pid");
export const LOG_FILE = path.join(STATE_DIR, "connector.log");

const LOG_MAX_BYTES = 512 * 1024;

export function ensureStateDirs() {
  for (const dir of [STATE_DIR, BINDINGS_DIR, ACTIVITY_DIR]) fs.mkdirSync(dir, { recursive: true });
}

/** Append one line to the log. Never throws: nothing here may take Bob or herdr down. */
export function log(scope, message) {
  try {
    ensureStateDirs();
    try {
      if (fs.statSync(LOG_FILE).size > LOG_MAX_BYTES) fs.renameSync(LOG_FILE, `${LOG_FILE}.1`);
    } catch {}
    fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} [${scope}] ${message}\n`);
  } catch {}
}

export function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

/** Write via rename so a reader never sees half a file. */
export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n");
  fs.renameSync(tmp, file);
}

/** Pane ids look like "wR:p3"; keep them filename-safe. */
export function paneFile(paneId) {
  return path.join(BINDINGS_DIR, `${paneId.replace(/[^A-Za-z0-9_-]/g, "_")}.json`);
}

export function activityFile(rootTaskId) {
  return path.join(ACTIVITY_DIR, `${rootTaskId.replace(/[^A-Za-z0-9_-]/g, "_")}.jsonl`);
}
