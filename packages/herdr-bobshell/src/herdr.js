// Minimal client for the herdr control socket.
//
// Newline-delimited JSON, one request per connection: the server replies and
// closes the stream. A failed call resolves to null instead of throwing, so a
// herdr hiccup skips a frame rather than killing the daemon or a Bob hook.

import net from "node:net";
import { SOCKET_PATH, log } from "./paths.js";

let counter = 0;

export function call(method, params = {}, { timeoutMs = 3000, socketPath = SOCKET_PATH } = {}) {
  const id = `herdr-bobshell:${process.pid}:${++counter}`;
  return new Promise((resolve) => {
    let buf = "";
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      sock.destroy();
      resolve(value);
    };
    const parse = () => {
      const line = buf.split("\n", 1)[0];
      try {
        const msg = JSON.parse(line);
        if (msg.error) log("herdr", `${method} -> ${JSON.stringify(msg.error).slice(0, 300)}`);
        done(msg.result ?? null);
      } catch {
        done(null);
      }
    };
    const sock = net.createConnection(socketPath);
    const timer = setTimeout(() => {
      log("herdr", `${method} timed out`);
      done(null);
    }, timeoutMs);
    sock.setEncoding("utf8");
    sock.on("connect", () => sock.write(JSON.stringify({ id, method, params }) + "\n"));
    sock.on("data", (chunk) => {
      buf += chunk;
      if (buf.includes("\n")) parse();
    });
    sock.on("end", () => (buf ? parse() : done(null)));
    sock.on("error", () => done(null));
  });
}

export const SOURCE = "herdr-bobshell-connector";
export const AGENT = "bobshell";

let lastSeq = 0;
/** Increasing across calls (herdr drops out-of-order reports); microseconds keep it a safe integer. */
export function seq() {
  lastSeq = Math.max(lastSeq + 1, Date.now() * 1000);
  return lastSeq;
}

export async function listPanes() {
  return (await call("pane.list"))?.panes ?? null;
}

export async function processInfo(paneId) {
  return (await call("pane.process_info", { pane_id: paneId }))?.process_info ?? null;
}

export async function readScreen(paneId, lines = 40) {
  const res = await call("pane.read", { pane_id: paneId, source: "detection", lines, strip_ansi: true });
  return res?.read?.text ?? null;
}

export async function createTab({ workspaceId, cwd, label, env = {} }) {
  const res = await call("tab.create", { workspace_id: workspaceId, cwd, label, env, focus: false });
  if (!res?.tab?.tab_id || !res?.root_pane?.pane_id) return null;
  return { tabId: res.tab.tab_id, paneId: res.root_pane.pane_id };
}

export const closeTab = (tabId) => call("tab.close", { tab_id: tabId });
export const renameTab = (tabId, label) => call("tab.rename", { tab_id: tabId, label });

/** Type a command into a pane and press Enter. */
export const runInPane = (paneId, command) =>
  call("pane.send_input", { pane_id: paneId, text: command, keys: ["enter"] });
