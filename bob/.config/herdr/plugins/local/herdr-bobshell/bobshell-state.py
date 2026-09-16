#!/usr/bin/env python3
"""Custom agent state detection and session restore for IBM Bob Shell.

Covers both published Bob Shell packages, whichever are installed:

  bob   npm "bobshell"   -> <npm prefix>/lib/node_modules/bobshell/dist/bob.js
  bob2  npm "bob-shell"  -> <npm prefix>/lib/node_modules/bob-shell/dist/bob.js

Both render the same TUI, so one rule set covers them; the package directory in
the script path is only used to relaunch the right binary on restore.

Herdr's manifest system (~/.config/herdr/agent-detection/<agent>.toml) only
patches rules for agents compiled into the herdr binary; a manifest for an
unknown id is silently ignored (`herdr agent explain --agent bobshell` reports
fallback_reason=unknown_agent). So this daemon does the same job from outside:
it finds panes whose foreground process is a Bob Shell, classifies the bottom of
the detection snapshot with the rules below, and pushes the verdict back through
the same reported-state API the official integrations use.

Rules are evidence-based, captured from bob-shell 2.0.0-beta.2 and re-verified
against bobshell 2.0.0 (both render the same TUI):

  blocked  approval form: "Press Enter to confirm" plus one of the choice
           affordances ("Approve Once" / "Reject" / "Always Allow" /
           "(Tab to toggle)"). The prompt box is not rendered in this state.
  working  a braille spinner line above the prompt box, e.g. "⠸ Processing…".
  idle     the prompt box ("│ ❯") or the "Agent Mode …" status line, with no
           spinner and no approval form.

Also mirrors Bob's status line ("Agent Mode · 34k / 270k (13%) · 0.16 🅞") into
sidebar tokens: $context (same "ctx NN%" shape statusline.sh reports for
claude), plus bobshell-specific $ctx_bar, $mode, $usage, $cost, and $task (the
bound task's title from Bob's SQLite store) for [ui.sidebar.agents.rows_by_agent]
rows.

Session restore
---------------
Herdr's [session] resume_agents_on_restore only resumes agents it compiles in,
so it cannot bring a Bob pane back after a server restart or reboot. This daemon
does that too: while a pane runs Bob it records the pane's cwd, binary, and live
task id (read from Bob's own SQLite store) to a state file; on the next start it
re-runs `bob -r <task-id>` in the restored, still-empty pane. Panes where Bob was
closed on purpose are dropped from the state file, so only sessions that were
live at shutdown come back — the same rule Herdr applies to claude panes.
"""

import json
import os
import re
import signal
import socket
import sqlite3
import sys
import time

AGENT = "bobshell"
SOURCE = "herdr-bobshell"

POLL_SECONDS = float(os.environ.get("HERDR_BOBSHELL_POLL_SECONDS", "0.6"))
HEARTBEAT_SECONDS = 30.0
# Bob paints an unrecognisable screen while it boots and for a frame or two
# mid-redraw. Hold "unknown" this long before believing it, so the sidebar does
# not flicker — but still surface screens the rules genuinely do not model.
UNKNOWN_GRACE_SECONDS = 3.0
READ_LINES = 40
BOTTOM_LINES = 14
# The approval form's title sits above the window the state rules look at, so
# the title lookup gets a wider slice of its own.
TITLE_LINES = 30
SOCKET_TIMEOUT = 3.0


def config_dir():
    """Herdr's config dir: ~/.config/herdr, unless XDG or herdr says otherwise."""
    explicit = os.environ.get("HERDR_CONFIG_DIR")
    if explicit:
        return os.path.expanduser(explicit)
    base = os.environ.get("XDG_CONFIG_HOME") or "~/.config"
    return os.path.join(os.path.expanduser(base), "herdr")


def state_dir():
    base = os.environ.get("XDG_STATE_HOME") or "~/.local/state"
    return os.path.join(os.path.expanduser(base), "herdr")


LOG_PATH = os.path.expanduser(
    os.environ.get("HERDR_BOBSHELL_LOG")
    or os.path.join(config_dir(), "bobshell-state.log")
)
LOG_MAX_BYTES = 256 * 1024

# --- process matching -------------------------------------------------------

# Both wrappers are symlinks to a node script, so a pane may show the wrapper
# name (argv0 "bob"/"bob2"), or "node <path>/dist/bob.js" — normally the latter.
BOB_COMMANDS = ("bob", "bob2")
BOB_PATH_RE = re.compile(r"(bobshell|bob-shell)[/\\](?:dist[/\\])?bob\.js")
# bobshell installs `bob`, bob-shell installs `bob2`; the package directory in
# the script path is what tells the two apart when argv0 is just "node".
PACKAGE_COMMANDS = {"bobshell": "bob", "bob-shell": "bob2"}

SHELL_NAMES = {"zsh", "bash", "sh", "fish", "dash", "ksh"}

# --- screen rules -----------------------------------------------------------

RULE_LINE_RE = re.compile(r"^\s*─{10,}\s*$")
SPINNER_RE = re.compile(r"^\s*[⠀-⣿]\s+(\S.*?)\s*$")
PROMPT_BOX_RE = re.compile(r"^\s*│\s*❯")
# "Agent Mode · 75k / 270k (28%) · 2.02 🅞" — the mode is "Agent" out of the
# box, but custom_modes.yaml modes render their own name ("IBM Researcher").
STATUS_LINE_RE = re.compile(r"^\s*(\S(?:.*?\S)?) Mode(?:\s|·|$)")
CONTEXT_RE = re.compile(r"\((\d{1,3})%\)")
USAGE_RE = re.compile(r"(\d+(?:\.\d+)?[kKmM]?)\s*/\s*(\d+(?:\.\d+)?[kKmM]?)")
COST_RE = re.compile(r"(\d+\.\d{2})\s*🅞")

CTX_BAR_CELLS = 5
MODE_MAX_CHARS = 14
TASK_MAX_CHARS = 28

BLOCKED_CONFIRM = "press enter to confirm"
BLOCKED_CHOICES = (
    "approve once",
    "always allow",
    "reject",
    "(tab to toggle)",
)

# --- session restore --------------------------------------------------------

RESTORE_ENABLED = os.environ.get("HERDR_BOBSHELL_RESTORE", "1") != "0"
STATE_PATH = os.path.expanduser(
    os.environ.get("HERDR_BOBSHELL_STATE")
    or os.path.join(state_dir(), "bobshell-sessions.json")
)
PID_PATH = os.path.expanduser(
    os.environ.get("HERDR_BOBSHELL_PID")
    or os.path.join(state_dir(), "bobshell-state.pid")
)
BOB_DB_PATH = os.path.expanduser(
    os.environ.get("HERDR_BOBSHELL_DB", "~/.bob/db/bob.db")
)
# Panes are recreated a moment after the server comes up, and their shells need
# to reach a prompt, so the restore pass stays open this long after startup.
RESTORE_WINDOW_SECONDS = float(os.environ.get("HERDR_BOBSHELL_RESTORE_WINDOW", "120"))
# A restored pane's screen is essentially empty. More content than this means
# something else is going on there (a leftover pane, or the user already typing)
# and the pane is left alone.
RESTORE_MAX_SCREEN_LINES = 3
# Bob's task id is only re-read this often: it changes rarely (a new task, /new)
# and the query touches the same SQLite file Bob is writing to.
TASK_REFRESH_SECONDS = 15.0


def log(message):
    try:
        if os.path.exists(LOG_PATH) and os.path.getsize(LOG_PATH) > LOG_MAX_BYTES:
            os.replace(LOG_PATH, LOG_PATH + ".1")
        with open(LOG_PATH, "a", encoding="utf-8") as handle:
            handle.write("%s %s\n" % (time.strftime("%Y-%m-%dT%H:%M:%S"), message))
    except Exception:
        pass


def socket_path():
    explicit = os.environ.get("HERDR_SOCKET_PATH")
    if explicit:
        return explicit
    return os.path.join(config_dir(), "herdr.sock")


_request_counter = 0


def call(method, params=None):
    """One request per connection: the server closes the stream after replying."""
    global _request_counter
    _request_counter += 1
    request = {
        "id": "%s:%d" % (SOURCE, _request_counter),
        "method": method,
        "params": params or {},
    }
    client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    client.settimeout(SOCKET_TIMEOUT)
    try:
        client.connect(socket_path())
        stream = client.makefile("rwb")
        stream.write((json.dumps(request) + "\n").encode("utf-8"))
        stream.flush()
        line = stream.readline()
    finally:
        try:
            client.close()
        except Exception:
            pass
    if not line:
        return None
    try:
        return json.loads(line.decode("utf-8"))
    except Exception:
        return None


def result_of(response, key):
    if not response or "result" not in response:
        return None
    return response["result"].get(key)


def process_names(process_info):
    """argv0s and argv/cmdline basenames of a pane's foreground processes."""
    for process in (process_info or {}).get("foreground_processes") or []:
        argv0 = (process.get("argv0") or "").lstrip("-")
        if argv0:
            yield argv0, None
        cmdline = process.get("cmdline") or ""
        args = list(process.get("argv") or [])
        if cmdline and not args:
            args = cmdline.split()
        for arg in args:
            yield os.path.basename(arg), arg


def bob_command(process_info):
    """Return "bob"/"bob2" for a pane running Bob Shell, else None."""
    for name, arg in process_names(process_info):
        if name in BOB_COMMANDS:
            return name
        match = BOB_PATH_RE.search(arg or name)
        if match:
            return PACKAGE_COMMANDS[match.group(1)]
    return None


def is_shell(process_info):
    """True when the pane is sitting at its own shell with nothing running."""
    processes = (process_info or {}).get("foreground_processes") or []
    if len(processes) != 1:
        return False
    return (processes[0].get("argv0") or "").lstrip("-") in SHELL_NAMES


# --- screen classification --------------------------------------------------


def bottom_lines(text, count=BOTTOM_LINES):
    lines = [line for line in (text or "").splitlines() if line.strip()]
    return lines[-count:]


def approval_title(text):
    """Bob brackets the form title in horizontal rules: ───/title/───."""
    lines = bottom_lines(text, TITLE_LINES)
    title = None
    for index in range(len(lines) - 2):
        if (
            RULE_LINE_RE.match(lines[index])
            and RULE_LINE_RE.match(lines[index + 2])
            and not RULE_LINE_RE.match(lines[index + 1])
        ):
            title = lines[index + 1].strip()
    return title


def classify(text):
    """Return (state, message). Order matters: blocked > working > idle."""
    lines = bottom_lines(text)
    lowered = [line.lower() for line in lines]

    has_confirm = any(BLOCKED_CONFIRM in line for line in lowered)
    has_choice = any(
        choice in line for line in lowered for choice in BLOCKED_CHOICES
    )
    if has_confirm and has_choice:
        title = approval_title(text)
        return "blocked", ("awaiting approval: %s" % title) if title else "awaiting approval"

    for line in reversed(lines):
        match = SPINNER_RE.match(line)
        if match:
            return "working", match.group(1)

    for line in reversed(lines):
        if PROMPT_BOX_RE.match(line) or STATUS_LINE_RE.match(line):
            return "idle", None

    return "unknown", None


def truncate(text, limit):
    return text if len(text) <= limit else text[: limit - 1] + "…"


def status_tokens(text):
    """Parse Bob's status line into sidebar tokens.

    Always returns the full key set, with None for anything the line does not
    show — report() sends the whole dict, and a null value clears the token in
    herdr, so stale values never outlive the screen they came from.

      context  "ctx 47%"            same shape claude's statusline hook pushes,
                                    so the shared $context row serves both
      ctx_bar  "▰▰▰▱▱ 47%"          five-cell meter for bobshell-specific rows
      mode     "Agent"              current mode, custom modes included
      usage    "75k/270k"           tokens used / context window
      cost     "🅞 2.02"            Bob's session cost readout
    """
    tokens = {"context": None, "ctx_bar": None, "mode": None, "usage": None, "cost": None}
    for line in reversed(bottom_lines(text)):
        match = STATUS_LINE_RE.match(line)
        if not match:
            continue
        tokens["mode"] = truncate(match.group(1), MODE_MAX_CHARS)
        percent = CONTEXT_RE.search(line)
        if percent:
            value = int(percent.group(1))
            filled = max(0, min(CTX_BAR_CELLS, (value * CTX_BAR_CELLS + 50) // 100))
            tokens["context"] = "ctx %d%%" % value
            tokens["ctx_bar"] = "%s%s %d%%" % (
                "▰" * filled,
                "▱" * (CTX_BAR_CELLS - filled),
                value,
            )
        usage = USAGE_RE.search(line)
        if usage:
            tokens["usage"] = "%s/%s" % usage.groups()
        cost = COST_RE.search(line)
        if cost:
            tokens["cost"] = "🅞 %s" % cost.group(1)
        break
    return tokens


def context_token(text):
    return status_tokens(text)["context"]


# --- Bob task lookup --------------------------------------------------------


def latest_task_id(cwd, since=None, exclude=()):
    """The (task id, title) Bob is holding open in a pane on this workspace.

    Bob keys tasks by project ("file:<workspace dir>") and stamps updated_at on
    every message, so the conversation a pane is having is the project's newest
    row — with two corrections:

      * every Bob start writes an empty placeholder task, even when the session
        it opens is a resumed one, so rows without messages are skipped;
      * `since` (when the daemon first saw the pane) prefers a task that has
        moved while the pane has been up, which is the pane's own conversation.
        Panes that have sat idle since startup fall back to the project's most
        recent conversation — the same one Bob's own `-r` picker offers first.

    `exclude` keeps two panes on the same project from claiming one task.
    """
    if not cwd or not os.path.exists(BOB_DB_PATH):
        return None
    try:
        connection = sqlite3.connect(
            "file:%s?mode=ro" % BOB_DB_PATH, uri=True, timeout=1.0
        )
    except sqlite3.Error:
        return None
    try:
        rows = connection.execute(
            "select id, updated_at, title from tasks"
            " where project_id = ? and task_type = 'normal' and time_archived is null"
            "   and exists (select 1 from messages where messages.task_id = tasks.id)"
            " order by updated_at desc limit 20",
            ("file:%s" % cwd,),
        ).fetchall()
    except sqlite3.Error:
        return None
    finally:
        connection.close()

    candidates = [row for row in rows if row[0] not in exclude]
    if not candidates:
        return None
    if since:
        active = [row for row in candidates if row[1] >= int(since * 1000)]
        if active:
            candidates = active
    return candidates[0][0], candidates[0][2]


def task_title_token(title):
    """Bob titles a task with its first prompt; squeeze that into one row."""
    text = " ".join((title or "").split())
    return truncate(text, TASK_MAX_CHARS) if text else None


# --- restore state file -----------------------------------------------------


def claim_singleton():
    """Newest instance wins: stop a daemon a previous server left behind.

    Two daemons would double-report state and fight over the restore file, and
    a startup process can outlive the server that spawned it (live handoff, a
    hand-started copy), so the incoming one takes over.
    """
    previous = None
    try:
        with open(PID_PATH, encoding="utf-8") as handle:
            previous = int(handle.read().strip())
    except Exception:
        previous = None

    if previous and previous != os.getpid():
        alive = True
        try:
            os.kill(previous, 0)
        except OSError:
            alive = False
        if alive:
            log("taking over from pid %d" % previous)
            try:
                os.kill(previous, signal.SIGTERM)
            except OSError:
                pass
            for _ in range(30):
                time.sleep(0.1)
                try:
                    os.kill(previous, 0)
                except OSError:
                    break

    try:
        os.makedirs(os.path.dirname(PID_PATH), exist_ok=True)
        with open(PID_PATH, "w", encoding="utf-8") as handle:
            handle.write("%d\n" % os.getpid())
    except Exception as error:
        log("pidfile write failed: %r" % (error,))


def load_state():
    try:
        with open(STATE_PATH, encoding="utf-8") as handle:
            data = json.load(handle)
    except Exception:
        return {}
    if not isinstance(data, dict) or data.get("version") != 1:
        return {}
    panes = data.get("panes")
    return panes if isinstance(panes, dict) else {}


def save_state(panes):
    payload = {"version": 1, "saved_at": int(time.time()), "panes": panes}
    try:
        os.makedirs(os.path.dirname(STATE_PATH), exist_ok=True)
        temporary = STATE_PATH + ".tmp"
        with open(temporary, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=1, sort_keys=True)
        os.replace(temporary, STATE_PATH)
    except Exception as error:
        log("state write failed: %r" % (error,))


class PaneState(object):
    __slots__ = (
        "state",
        "message",
        "tokens",
        "reported_at",
        "unknown_since",
        "command",
        "cwd",
        "task_id",
        "task_title",
        "task_checked_at",
        "first_seen",
    )

    def __init__(self):
        self.state = None
        self.message = None
        self.tokens = None
        self.task_title = None
        self.reported_at = 0.0
        self.unknown_since = None
        self.command = None
        self.cwd = None
        self.task_id = None
        self.task_checked_at = 0.0
        self.first_seen = time.time()


tracked = {}
running = True

# Panes that were running Bob when this daemon last stopped, waiting to be
# relaunched into their task. Emptied as they are restored or ruled out.
pending_restore = {}
restore_deadline = 0.0
persisted = None


def stop(_signum, _frame):
    global running
    running = False


def persist():
    """Write the record of live Bob panes that the next start restores from."""
    global persisted
    snapshot = {}
    for pane_id, pane in tracked.items():
        if not pane.command:
            continue
        snapshot[pane_id] = {
            "command": pane.command,
            "cwd": pane.cwd,
            "task_id": pane.task_id,
        }
    if snapshot != persisted:
        save_state(snapshot)
        persisted = snapshot


def release(pane_id):
    call(
        "pane.release_agent",
        {
            "pane_id": pane_id,
            "source": SOURCE,
            "agent": AGENT,
            "seq": time.time_ns(),
        },
    )
    tracked.pop(pane_id, None)
    log("released %s" % pane_id)


def bind_task(pane_id, pane, now):
    """Keep the pane's Bob task id current, and mirror it to herdr."""
    if (now - pane.task_checked_at) < TASK_REFRESH_SECONDS:
        return
    pane.task_checked_at = now
    claimed = set(
        other.task_id
        for other_id, other in tracked.items()
        if other_id != pane_id and other.task_id
    )
    found = latest_task_id(pane.cwd, since=pane.first_seen, exclude=claimed)
    if not found:
        return
    task_id, title = found
    # The title lands with the first prompt, after the task is first bound, so
    # it refreshes even when the id hasn't changed.
    pane.task_title = task_title_token(title)
    if task_id == pane.task_id:
        return
    pane.task_id = task_id
    log("%s task %s (%s)" % (pane_id, task_id, pane.cwd))
    # herdr 0.7.5 accepts this and drops it for agents it does not compile in;
    # the state file above is what actually survives a restart. Reported anyway
    # so the ref lands in herdr's own session data once bobshell is known to it.
    call(
        "pane.report_agent_session",
        {
            "pane_id": pane_id,
            "source": SOURCE,
            "agent": AGENT,
            "agent_session_id": task_id,
            "session_start_source": SOURCE,
            "seq": time.time_ns(),
        },
    )


def report(pane_id, state, message, tokens):
    now = time.time()
    previous = tracked.get(pane_id)
    if previous is None:
        previous = PaneState()
        tracked[pane_id] = previous

    if state == "unknown":
        if previous.unknown_since is None:
            previous.unknown_since = now
        if (now - previous.unknown_since) < UNKNOWN_GRACE_SECONDS:
            return
    else:
        previous.unknown_since = None

    changed = previous.state != state or previous.message != message
    stale = (now - previous.reported_at) > HEARTBEAT_SECONDS
    if changed or stale:
        params = {
            "pane_id": pane_id,
            "source": SOURCE,
            "agent": AGENT,
            "state": state,
            "seq": time.time_ns(),
        }
        if message:
            params["message"] = message
        call("pane.report_agent", params)
        previous.state = state
        previous.message = message
        previous.reported_at = now
        if changed:
            log("%s -> %s%s" % (pane_id, state, (" (%s)" % message) if message else ""))

    tokens = dict(tokens)
    tokens["task"] = previous.task_title
    # The sidebar's shared rows can't style the built-in "agent" label per
    # agent (rows_by_agent rejects custom ids), so each reporter pushes its
    # own name token and the config colors them independently.
    tokens["agent_bob"] = AGENT
    if tokens != previous.tokens:
        call(
            "pane.report_metadata",
            {
                "pane_id": pane_id,
                "source": SOURCE,
                "applies_to_source": SOURCE,
                "tokens": tokens,
                "seq": time.time_ns(),
            },
        )
        previous.tokens = tokens


def read_pane(pane_id):
    read = result_of(
        call(
            "pane.read",
            {
                "pane_id": pane_id,
                "source": "detection",
                "lines": READ_LINES,
                "strip_ansi": True,
            },
        ),
        "read",
    )
    return (read or {}).get("text") or ""


def restore_pane(pane_id, record):
    """Relaunch Bob into its task in a pane the server just restored."""
    command = record.get("command") or "bob"
    task_id = record.get("task_id")
    line = "%s -r %s" % (command, task_id) if task_id else command
    if not call("pane.send_text", {"pane_id": pane_id, "text": line}):
        return False
    call("pane.send_keys", {"pane_id": pane_id, "keys": ["enter"]})
    log("restored %s: %s" % (pane_id, line))
    return True


def try_restore(pane_id, pane_info, process_info):
    """Restore one pending pane once it is an empty shell in the same cwd."""
    record = pending_restore.get(pane_id)
    if not record:
        return
    if record.get("cwd") and pane_info.get("cwd") != record["cwd"]:
        # The pane came back somewhere else; it is not the session we recorded.
        pending_restore.pop(pane_id, None)
        return
    if not is_shell(process_info):
        return
    if len(bottom_lines(read_pane(pane_id), RESTORE_MAX_SCREEN_LINES + 1)) > (
        RESTORE_MAX_SCREEN_LINES
    ):
        # Something already ran here — leave the pane to whoever is using it.
        pending_restore.pop(pane_id, None)
        return
    if restore_pane(pane_id, record):
        pending_restore.pop(pane_id, None)


def sweep():
    global restore_deadline
    panes = result_of(call("pane.list"), "panes")
    if panes is None:
        return
    now = time.time()
    live = set()
    restoring = bool(pending_restore) and now < restore_deadline

    for pane in panes:
        pane_id = pane.get("pane_id")
        if not pane_id:
            continue
        live.add(pane_id)

        process_info = result_of(
            call("pane.process_info", {"pane_id": pane_id}), "process_info"
        )
        command = bob_command(process_info)
        if not command:
            if pane_id in tracked:
                release(pane_id)
                persist()
            if restoring:
                try_restore(pane_id, pane, process_info)
            continue

        # Bob is running here, so there is nothing to restore into this pane.
        pending_restore.pop(pane_id, None)

        text = read_pane(pane_id)
        state, message = classify(text)
        report(pane_id, state, message, status_tokens(text))
        entry = tracked.get(pane_id)
        if entry is not None:
            entry.command = command
            entry.cwd = pane.get("cwd")
            bind_task(pane_id, entry, now)
    persist()

    for pane_id in [p for p in tracked if p not in live]:
        tracked.pop(pane_id, None)
    for pane_id in [p for p in pending_restore if p not in live]:
        pending_restore.pop(pane_id, None)
    if restoring and not pending_restore:
        log("restore pass complete")


def main():
    global pending_restore, restore_deadline, persisted
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    log("started (poll=%ss socket=%s)" % (POLL_SECONDS, socket_path()))

    claim_singleton()
    persisted = load_state()
    if RESTORE_ENABLED and persisted:
        pending_restore = dict(persisted)
        restore_deadline = time.time() + RESTORE_WINDOW_SECONDS
        log("restore pending for %s" % ", ".join(sorted(pending_restore)))

    backoff = POLL_SECONDS
    while running:
        try:
            sweep()
            backoff = POLL_SECONDS
        except (socket.error, OSError) as error:
            # Server restarts and handoffs are expected; back off and retry.
            backoff = min(backoff * 2, 10.0)
            log("socket error: %s (retry in %.1fs)" % (error, backoff))
        except Exception as error:  # never let one bad frame kill the daemon
            log("error: %r" % (error,))
        time.sleep(backoff)

    for pane_id in list(tracked):
        try:
            call(
                "pane.release_agent",
                {
                    "pane_id": pane_id,
                    "source": SOURCE,
                    "agent": AGENT,
                    "seq": time.time_ns(),
                },
            )
        except Exception:
            pass
    log("stopped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
