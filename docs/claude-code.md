# Claude Code inside herdr

What happens when Claude Code runs in a herdr pane, and why it's set up that
way. The mechanism is one script, `claude/.claude/hooks/herdr-agent-tab.py`,
plus a global `CLAUDE.md`; both are the `claude` Stow package.

## The problem

Claude Code has two ways of doing work off to the side: the **Agent tool**,
which spins up a subagent with its own context, and **background shells**
(`run_in_background`), which run a command while the main conversation
continues. Both run *inside* the `claude` process. There is no PTY, so herdr —
which sees processes in panes — sees nothing. You get a spinner in the main
pane and no idea what the subagent is actually doing.

Two things Claude Code *does* expose make this fixable:

- **One live file per task.** Every background task writes to
  `<session>/tasks/<id>.output` next to the session's scratchpad. For a
  subagent it's a symlink to the subagent's JSONL transcript, appended as it
  works; for a shell it's the captured stdout.
- **Hook events.** `SubagentStart`, `SubagentStop`, and `PostToolUse` fire
  with JSON on stdin naming the agent or the background task id. Hooks inherit
  the environment of the `claude` process — including `HERDR_WORKSPACE_ID`,
  so a hook always knows which workspace its agent is in.

## What the hooks do

| Event | Effect |
|---|---|
| `SubagentStart` | `herdr tab create --no-focus` in the current workspace. The tab runs a renderer that follows the transcript and prints the prompt, the agent's text, each tool call (`▶ Bash  description`) and each result (`✓`/`✗`) as they land. Labeled `⚙ <the Agent call's description>`. |
| `SubagentStop` | The tab closes. |
| `PostToolUse` on `Bash`, when `run_in_background` was set | A tab labeled `$ <description>` tails the output file. It closes itself when the shell exits. |

Some details that matter:

**Focus never moves.** Every tab is created `--no-focus`. The tabs appear in
the sidebar and the tab bar; you switch to one when you want to watch.

**The hook returns immediately.** A fresh tab's shell takes a moment to reach
its prompt, and Claude Code waits for hooks. So the hook creates the tab,
records the tab id, and hands the "wait for the shell, then start the renderer"
step to a detached child process. Claude is never blocked on herdr.

**The label upgrades itself.** `SubagentStart` fires *before* the parent
transcript records the Agent call — by a few hundred milliseconds normally,
by several seconds when the call was part of a parallel batch. So the tab
opens as `⚙ Explore` and the detached child keeps watching the transcript,
renaming it to `⚙ Verify the widget layer` once the description is visible.
The match is exact — the transcript entry that records the launch carries the
agent id — so parallel subagents never swap labels.

**A shell tab knows when its shell is done.** Nothing announces a background
command's exit to a hook, but the shell holds its output file open for its
whole life. The renderer polls `lsof` on the file and closes the tab when no
process other than itself has it open.

**Nothing leaks into history.** The renderer is started with `herdr pane run`,
which types into the tab's shell. The command is prefixed with a space so
`HIST_IGNORE_SPACE` keeps it out of `~/.zsh_history` and atuin.

**It's inert everywhere else.** Outside a herdr pane (`HERDR_ENV` unset), or
without a `herdr` binary, every hook exits 0 without doing anything. Errors
are logged to `~/.local/state/herdr/claude-tabs/hook.log`, never raised — a
broken hook must not take Claude Code down with it.

## A window, not a log

Tabs close the moment the task ends. A subagent that takes three seconds is a
tab that flashes for three seconds. That is deliberate: these tabs answer
"what is it doing *right now*", and the result comes back to the main
conversation anyway. Leaving them open would mean a workspace full of dead
tabs after a busy session.

When you want something you can keep, read, and talk to, that's the second
half of the setup.

## Heavyweight subtasks get a real agent

[`claude/.claude/CLAUDE.md`](../claude/.claude/CLAUDE.md) is stowed to
`~/.claude/CLAUDE.md`, Claude Code's global instruction file. Its rule: for a
subtask that is long-running or that you might want to talk to directly, don't
use the in-process Agent tool at all. Start a real `claude` in a real tab:

```sh
created=$(herdr tab create --workspace "$HERDR_WORKSPACE_ID" --no-focus --cwd "$PWD" --label "<task>")
pane=$(printf '%s' "$created" | jq -r .result.root_pane.pane_id)
sleep 1
herdr agent start <name> --kind claude --pane "$pane"
herdr agent prompt <name> "<the task>" --wait --timeout 900000
herdr agent read <name> --source recent-unwrapped --lines 200
```

That agent is a first-class herdr agent: it shows up in the agent panel with
`idle` / `working` / `blocked` state, you can switch to its tab and type at it,
and it survives the main conversation ending. The mirror tabs cover the small
stuff automatically; this covers the work you'd want to supervise.

## Install

```sh
cd ~/dotfiles
stow claude
~/.claude/hooks/herdr-agent-tab.py install     # merges three hook entries into ~/.claude/settings.json
```

`stow claude` links `~/.claude/CLAUDE.md` and
`~/.claude/hooks/herdr-agent-tab.py`. If you already have a `~/.claude/CLAUDE.md`,
Stow will skip it silently — back it up and remove it first, or fold its
contents into the repo copy (see [stow.md](stow.md)).

`~/.claude/settings.json` is **not** stowed. It also holds machine-specific
state — plugin registrations, permission grants, other people's hooks — that
doesn't belong in a public repo. The `install` subcommand edits it in place and
is idempotent: run it again after a Claude Code update and you get exactly one
copy of each entry. `uninstall` removes them.

Claude Code reloads hooks from `settings.json` without a restart.

Requirements beyond the Brewfile: `python3` and `lsof`, both shipped with
macOS. `jq` (in the Brewfile) is used by the `CLAUDE.md` rule.

## Verify

Inside a herdr pane, ask Claude to run something in the background:

> run `sleep 20; echo done` in the background

A `$ …` tab appears within a second, shows the output as it arrives, and
disappears when the command exits. For the subagent path, ask Claude to
"spawn a subagent to list the files in this directory" and watch for the `⚙`
tab.

From the shell, without Claude:

```sh
herdr tab list --workspace "$HERDR_WORKSPACE_ID"      # mirror tabs are labeled ⚙ … or $ …
tail ~/.local/state/herdr/claude-tabs/hook.log        # one line per tab; errors if any
```

## What this is not

herdr has its own agent integrations (`herdr integration install claude`).
Those teach herdr to read an agent's *lifecycle state* — idle, working,
blocked — from a pane it already owns. They don't create tabs, and they aren't
needed for this. The two are independent and can coexist.

The hooks are Claude Code-specific. Other agents with hook systems (Codex,
Copilot, Cursor …) expose different events and different task files; the
pattern ports, the script doesn't.
