#!/usr/bin/env python3
"""herdr-agent-tab — mirror Claude Code subagents and background shells into herdr tabs.

Claude Code runs subagents (the Agent tool) and `run_in_background` shells
inside its own process, so there is no PTY to hand to herdr. What it does
expose is one live file per task under <session>/tasks/<id>.output — a JSONL
transcript for a subagent, raw stdout for a shell. Wired in as a Claude Code
hook, this script turns each of those files into a tab in the herdr workspace
the agent is running in:

  SubagentStart       -> open a --no-focus tab that renders the transcript live
  SubagentStop        -> close it
  PostToolUse (Bash)  -> for run_in_background, open a tab tailing the output;
                         the tab closes itself when the shell exits

Everything is a no-op outside a herdr pane (HERDR_ENV != 1) or when the
`herdr` binary is missing, so the hooks are safe to leave installed.

Hook entry points (stdin is the hook JSON):
  herdr-agent-tab.py subagent-start
  herdr-agent-tab.py subagent-stop
  herdr-agent-tab.py bg-shell

Setup (edits ~/.claude/settings.json in place, idempotent):
  herdr-agent-tab.py install
  herdr-agent-tab.py uninstall

Internal (spawned by the entry points):
  herdr-agent-tab.py launch <pane> <tab> <kind> <file> <title> [parent-transcript] [agent-id]
  herdr-agent-tab.py mirror <tab> <kind> <file> <title>

State lives in $XDG_STATE_HOME/herdr/claude-tabs/ (one small JSON per open
tab, plus hook.log for anything that went wrong). Stdlib only.
"""

import json
import os
import shlex
import shutil
import subprocess
import sys
import textwrap
import time

STATE_DIR = os.path.join(
    os.environ.get("XDG_STATE_HOME") or os.path.expanduser("~/.local/state"),
    "herdr",
    "claude-tabs",
)
SHELL_NAMES = {"zsh", "bash", "fish", "sh"}
LABEL_MAX = 36
ICON = {"subagent": "⚙", "shell": "$"}

# ── small helpers ────────────────────────────────────────────────────────────


def log(msg):
    try:
        os.makedirs(STATE_DIR, exist_ok=True)
        with open(os.path.join(STATE_DIR, "hook.log"), "a") as f:
            f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} {msg}\n")
    except OSError:
        pass


def herdr(*args, timeout=10):
    """Run a herdr CLI command; return its `.result` (or {} when it prints
    nothing), None on failure. Failures are logged, never raised: a hook must
    not take Claude Code down with it."""
    exe = shutil.which("herdr") or "/opt/homebrew/bin/herdr"
    try:
        p = subprocess.run([exe, *args], capture_output=True, text=True, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired) as e:
        log(f"herdr {' '.join(args)} failed to run: {e}")
        return None
    if p.returncode != 0:
        log(f"herdr {' '.join(args)} -> exit {p.returncode}: {p.stderr.strip()[:300]}")
        return None
    try:
        return json.loads(p.stdout).get("result", {})
    except ValueError:
        return {}


def state_path(task_id):
    return os.path.join(STATE_DIR, f"{task_id}.json")


def task_file(payload, task_id):
    """Claude Code keeps every background task's output next to the session
    scratchpad: <session>/tasks/<id>.output. For subagents that is a symlink
    to the transcript JSONL, for shells the captured stdout."""
    scratch = payload.get("scratchpad_dir") or ""
    return os.path.join(os.path.dirname(scratch), "tasks", f"{task_id}.output")


def short(text, n=LABEL_MAX):
    text = " ".join((text or "").split())
    return text if len(text) <= n else text[: n - 1] + "…"


def subagent_description(agent_id, transcript_path):
    """The SubagentStart payload carries the agent type but not the
    description Claude gave the Agent tool call. The parent transcript has
    it: the entry that records the launch carries `toolUseResult` with both
    `agentId` and `description`. It lands a few hundred milliseconds *after*
    the hook fires, so callers poll. Returns None until it is visible."""
    if not transcript_path or not agent_id:
        return None
    try:
        with open(transcript_path, "rb") as f:
            f.seek(0, os.SEEK_END)
            f.seek(max(0, f.tell() - 2 * 1024 * 1024))
            tail = f.read().decode("utf-8", "replace").splitlines()
    except OSError:
        return None
    for line in reversed(tail):
        if agent_id not in line or "toolUseResult" not in line:
            continue
        try:
            result = json.loads(line).get("toolUseResult") or {}
        except ValueError:
            continue
        if isinstance(result, dict) and result.get("agentId") == agent_id:
            return result.get("description") or None
    return None


# ── hook entry points ────────────────────────────────────────────────────────


def open_tab(payload, kind, task_id, title, transcript_path=""):
    workspace = os.environ.get("HERDR_WORKSPACE_ID")
    if not workspace:
        return
    file = task_file(payload, task_id)
    res = herdr(
        "tab", "create",
        "--workspace", workspace,
        "--no-focus",
        "--label", f"{ICON[kind]} {short(title)}",
        "--cwd", payload.get("cwd") or os.getcwd(),
    )
    if not res:
        return
    tab = res["tab"]["tab_id"]
    pane = res["root_pane"]["pane_id"]
    os.makedirs(STATE_DIR, exist_ok=True)
    with open(state_path(task_id), "w") as f:
        json.dump({"tab": tab, "pane": pane, "kind": kind, "file": file}, f)
    # The new tab's shell needs a moment to reach its prompt. Hand that wait
    # to a detached child so the hook itself returns immediately.
    subprocess.Popen(
        [sys.executable, os.path.realpath(__file__), "launch", pane, tab, kind, file, title, transcript_path, task_id],
        stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        start_new_session=True,
    )


def close_tab(task_id):
    path = state_path(task_id)
    try:
        with open(path) as f:
            state = json.load(f)
    except (OSError, ValueError):
        return
    herdr("tab", "close", state["tab"])
    try:
        os.remove(path)
    except OSError:
        pass


def hook_subagent_start(payload):
    task_id = payload.get("agent_id")
    if task_id:
        # Label with the agent type now; `launch` upgrades it to the Agent
        # call's description once the parent transcript has caught up.
        open_tab(payload, "subagent", task_id, payload.get("agent_type") or "subagent",
                 payload.get("transcript_path") or "")


def hook_subagent_stop(payload):
    task_id = payload.get("agent_id")
    if task_id:
        close_tab(task_id)


def hook_bg_shell(payload):
    if payload.get("tool_name") != "Bash":
        return
    tool_input = payload.get("tool_input") or {}
    task_id = (payload.get("tool_response") or {}).get("backgroundTaskId")
    if not tool_input.get("run_in_background") or not task_id:
        return
    title = tool_input.get("description") or tool_input.get("command") or "shell"
    open_tab(payload, "shell", task_id, title)


# ── inside the tab ───────────────────────────────────────────────────────────


def launch(pane, tab, kind, file, title, transcript_path="", task_id=""):
    """Wait for the fresh tab's shell to be at its prompt, then start the
    mirror in it. Gives up quietly if the tab vanished — a subagent that
    finished before its shell was even ready. For a subagent, then keep
    watching the parent transcript for the Agent call's description and
    relabel the tab with it; that entry can land seconds later when the
    call was part of a parallel batch."""
    t0 = time.time()
    while True:
        info = herdr("pane", "process-info", "--pane", pane)
        if info is None:
            return
        fg = (info.get("process_info") or {}).get("foreground_processes") or []
        if fg and os.path.basename(fg[0].get("name", "")).lstrip("-") in SHELL_NAMES:
            break
        if time.time() > t0 + 15:
            log(f"launch: shell in {pane} never became ready")
            return
        time.sleep(0.2)
    log(f"launch: {kind} {os.path.basename(file)} -> {tab} '{short(title)}', shell ready after {time.time() - t0:.1f}s")
    cmd = ["exec", sys.executable, os.path.realpath(__file__), "mirror", tab, kind, file, title]
    # Leading space keeps the command out of shell history (HIST_IGNORE_SPACE / atuin).
    herdr("pane", "run", pane, " " + " ".join(shlex.quote(c) for c in cmd))
    if not (transcript_path and task_id):
        return
    while time.time() < t0 + 120 and os.path.exists(state_path(task_id)):
        desc = subagent_description(task_id, transcript_path)
        if desc:
            herdr("tab", "rename", tab, f"{ICON[kind]} {short(desc)}")
            log(f"launch: {tab} relabeled '{short(desc)}' after {time.time() - t0:.1f}s")
            return
        time.sleep(0.5)


class Style:
    def __init__(self):
        self.on = sys.stdout.isatty()
        self.cols = shutil.get_terminal_size((100, 40)).columns

    def _(self, code, text):
        return f"\033[{code}m{text}\033[0m" if self.on else text

    def bold(self, t):
        return self._("1", t)

    def dim(self, t):
        return self._("2", t)

    def cyan(self, t):
        return self._("1;36", t)

    def red(self, t):
        return self._("31", t)

    def green(self, t):
        return self._("32", t)


def writer_alive(file):
    """True while some process other than this one still holds the file
    open — i.e. the background shell is still running."""
    try:
        out = subprocess.run(["lsof", "-t", file], capture_output=True, text=True, timeout=10).stdout
    except (OSError, subprocess.TimeoutExpired):
        return False
    return any(pid.strip() and int(pid) != os.getpid() for pid in out.split())


def mirror_shell(file, st):
    with open(file, "rb") as f:
        while True:
            chunk = f.read()
            if chunk:
                sys.stdout.buffer.write(chunk)
                sys.stdout.flush()
                continue
            if not writer_alive(file):
                sys.stdout.buffer.write(f.read())
                sys.stdout.flush()
                log(f"mirror: shell {os.path.basename(file)} finished, closing tab")
                return
            time.sleep(0.5)


def primary_arg(name, inp):
    for key in ("command", "file_path", "pattern", "url", "description", "prompt", "query"):
        if isinstance(inp.get(key), str) and inp[key].strip():
            return inp[key]
    for v in inp.values():
        if isinstance(v, str) and v.strip():
            return v
    return ""


def render_entry(entry, st, pending):
    msg = entry.get("message") or {}
    content = msg.get("content")
    kind = entry.get("type")
    if kind == "user" and isinstance(content, str):
        print(st.bold("prompt"))
        lines = content.strip().splitlines()
        for line in lines[:20]:
            print(textwrap.fill(line, st.cols - 2, initial_indent="  ", subsequent_indent="  ") if line.strip() else "")
        if len(lines) > 20:
            print(st.dim(f"  … +{len(lines) - 20} lines"))
        print()
        return
    if not isinstance(content, list):
        return
    for block in content:
        btype = block.get("type")
        if kind == "assistant" and btype == "text" and block.get("text", "").strip():
            for para in block["text"].strip().split("\n"):
                print(textwrap.fill(para, st.cols) if para.strip() else "")
            print()
        elif kind == "assistant" and btype == "tool_use":
            name = block.get("name", "?")
            inp = block.get("input") or {}
            pending[block.get("id")] = name
            desc = inp.get("description") if name in ("Bash", "Agent", "Task") else None
            head = f"▶ {name}" + (f"  {desc}" if desc else "")
            print(st.cyan(head))
            arg = primary_arg(name, inp)
            if arg and arg != desc:
                for line in arg.strip().splitlines()[:3]:
                    print(st.dim("  " + line[: st.cols - 2]))
        elif kind == "user" and btype == "tool_result":
            name = pending.pop(block.get("tool_use_id"), "result")
            raw = block.get("content")
            if isinstance(raw, list):
                raw = "\n".join(b.get("text", "") for b in raw if isinstance(b, dict))
            raw = (raw or "").rstrip()
            lines = raw.splitlines()
            paint = st.red if block.get("is_error") else st.dim
            tag = f"  ✗ {name}" if block.get("is_error") else f"  ✓ {name}"
            print(paint(tag + (f"  ({len(lines)} lines)" if len(lines) > 12 else "")))
            for line in lines[:12]:
                print(paint("    " + line[: st.cols - 4]))
            if len(lines) > 12:
                print(paint("    …"))
            print()


def mirror_transcript(file, st):
    """Follow a subagent's JSONL transcript and print it as it grows. Runs
    until the tab is closed by the SubagentStop hook."""
    pending = {}
    with open(file, "rb") as f:
        buf = b""
        while True:
            chunk = f.read()
            if not chunk:
                time.sleep(0.25)
                continue
            buf += chunk
            *lines, buf = buf.split(b"\n")
            for line in lines:
                if not line.strip():
                    continue
                try:
                    entry = json.loads(line)
                except ValueError:
                    continue
                if entry.get("type") in ("user", "assistant"):
                    render_entry(entry, st, pending)
            sys.stdout.flush()


def mirror(tab, kind, file, title):
    st = Style()
    print(st.bold(title))
    print(st.dim(f"{'subagent' if kind == 'subagent' else 'background shell'} · {os.path.basename(file)}"))
    print()
    deadline = time.time() + 60
    while not os.path.exists(file) and time.time() < deadline:
        time.sleep(0.25)
    try:
        if os.path.exists(file):
            if kind == "shell":
                mirror_shell(file, st)
            else:
                mirror_transcript(file, st)
    except (KeyboardInterrupt, BrokenPipeError):
        pass
    finally:
        if kind == "shell":
            for stem in (os.path.basename(file).rsplit(".", 1)[0],):
                try:
                    os.remove(state_path(stem))
                except OSError:
                    pass
            herdr("tab", "close", tab)


# ── settings.json wiring ─────────────────────────────────────────────────────

SETTINGS = os.path.expanduser("~/.claude/settings.json")
HOOK_CMD = "$HOME/.claude/hooks/herdr-agent-tab.py"
HOOK_ENTRIES = {
    "SubagentStart": {"hooks": [{"type": "command", "command": f"{HOOK_CMD} subagent-start", "timeout": 10}]},
    "SubagentStop": {"hooks": [{"type": "command", "command": f"{HOOK_CMD} subagent-stop", "timeout": 5}]},
    "PostToolUse": {"matcher": "Bash", "hooks": [{"type": "command", "command": f"{HOOK_CMD} bg-shell", "timeout": 10}]},
}


def _is_ours(group):
    return any("herdr-agent-tab.py" in (h.get("command") or "") for h in group.get("hooks", []))


def configure(install):
    """Add (or remove) this script's three hook entries in settings.json.
    Existing copies are dropped first, so re-running never duplicates."""
    try:
        with open(SETTINGS) as f:
            settings = json.load(f)
    except FileNotFoundError:
        settings = {}
    hooks = settings.setdefault("hooks", {})
    for event, entry in HOOK_ENTRIES.items():
        groups = [g for g in hooks.get(event, []) if not _is_ours(g)]
        if install:
            groups.append(entry)
        if groups:
            hooks[event] = groups
        else:
            hooks.pop(event, None)
    with open(SETTINGS, "w") as f:
        json.dump(settings, f, indent=2)
        f.write("\n")
    verb = "installed into" if install else "removed from"
    print(f"herdr-agent-tab hooks {verb} {SETTINGS}")


# ── main ─────────────────────────────────────────────────────────────────────


def main(argv):
    mode = argv[1] if len(argv) > 1 else ""
    if mode == "launch":
        launch(*argv[2:9])
        return 0
    if mode == "mirror":
        mirror(*argv[2:6])
        return 0
    if mode in ("install", "uninstall"):
        configure(mode == "install")
        return 0
    if os.environ.get("HERDR_ENV") != "1":
        return 0
    if not (shutil.which("herdr") or os.path.exists("/opt/homebrew/bin/herdr")):
        return 0
    try:
        payload = json.load(sys.stdin)
    except ValueError:
        return 0
    try:
        {
            "subagent-start": hook_subagent_start,
            "subagent-stop": hook_subagent_stop,
            "bg-shell": hook_bg_shell,
        }[mode](payload)
    except KeyError:
        print(__doc__, file=sys.stderr)
        return 2
    except Exception as e:  # never fail the hook
        log(f"{mode}: {type(e).__name__}: {e}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
