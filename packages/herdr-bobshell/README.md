# herdr-bobshell-connector

Makes [IBM Bob Shell](https://www.ibm.com/products/bob) behave in
[herdr](https://herdr.dev) the way Claude Code does:

- **Sidebar** — every pane running `bob` / `bob2` shows up as agent
  `bobshell` with live `idle` / `working` / `blocked` state and Bob's context
  percentage (`$context` token).
- **Subagent tabs** — when Bob calls `spawn_subagent`, a `--no-focus` tab opens
  in the same workspace, shows the subagent's prompt and its tool calls as they
  happen, and closes when the subagent finishes.

Node only, no dependencies (uses the built-in `node:sqlite`).

## Requirements

| | |
|---|---|
| node | 22.13+ (developed on 26.8) |
| herdr | 0.9.0+ |
| Bob Shell | `bobshell` 2.0.x (`bob`) and/or `bob-shell` 2.0.x (`bob2`) |

## Install

Published to npm as
[`@zack-maz/herdr-bobshell-connector`](https://www.npmjs.com/package/@zack-maz/herdr-bobshell-connector).

```bash
npm install -g @zack-maz/herdr-bobshell-connector
herdr-bobshell install
herdr-bobshell status
```

From a local clone, use `npm install -g ~/dotfiles/packages/herdr-bobshell`
instead. That links the checkout, so edits take effect after
`herdr-bobshell install` restarts the daemon.

`install` is idempotent. It

1. adds a `SessionStart`, `PreToolUse` and `PostToolUse` hook to Bob's global
   settings, `~/.bob/settings/settings.json` (a backup is written next to it
   as `settings.json.herdr-bobshell.bak`),
2. runs `herdr plugin link` on the installed package, so herdr starts the
   daemon with the server from now on. If the plugin was linked from somewhere
   else, it is re-linked,
3. starts the daemon right away, so you don't have to restart the herdr
   server (that would kill live panes).

Bob sessions that were already running only pick up the hooks after you
restart them. Until then, their subagents still get tabs by matching the
directory (see below).

**Updating.** `npm install -g @zack-maz/herdr-bobshell-connector@latest`, then `herdr-bobshell install`.
The hooks and the plugin link point at the installed path, so run `install`
again whenever that path changes.

**Removing.** Run `herdr-bobshell uninstall` (add `--purge` to also delete the
state directory), then `npm uninstall -g @zack-maz/herdr-bobshell-connector`.

## How it works

```
 bob (in a herdr pane)                       herdr server
 ├─ hooks ──> herdr-bobshell hook            ▲
 │            ├─ bindings/<pane>.json        │ pane.report_agent / report_metadata
 │            └─ activity/<task>.jsonl       │ tab.create / tab.close
 └─ ~/.bob/db/bob.db ─────────┐              │
                              ▼              │
              herdr-bobshell daemon ─────────┘   (herdr plugin [[startup]])
                              │
                              └─ tab: herdr-bobshell mirror <subagent id>
```

**Sidebar.** herdr can't learn a new agent from a detection manifest (those
only patch agents built into herdr), so the daemon does the detection itself.
Every 600 ms it finds panes whose foreground process is Bob, reads the bottom
of the screen and classifies it, in this order:

| state | evidence |
|---|---|
| `blocked` | `Press Enter to confirm` plus an approval choice, or a row in Bob's `task_pending_approvals` for the pane's task |
| `working` | a braille spinner line (`⠸ Processing…`); the text becomes the message |
| `idle` | the `│ ❯` prompt box or the `Agent Mode · … (13%)` status line |

`unknown` is held back for 3 s so Bob's startup frames don't make the sidebar
flicker.

**Subagent tabs.** Bob has no subagent hook, but `spawn_subagent` inserts a
`tasks` row (`task_type = 'subagent'`, `status = 'running'`) before the
subagent starts, and marks it `completed` when it ends. The daemon polls for
those rows every second. The hook runs inside Bob's process, so it knows
`HERDR_PANE_ID` and records which pane owns which Bob task. That tells the
daemon which workspace should get the tab. For a Bob session started before
the hooks were installed, the daemon falls back to the one Bob pane whose
directory matches the task. If more than one pane matches, no tab is opened.

**What the tab shows.** Bob doesn't save a subagent's messages while it runs;
they only appear in the parent's tool result afterwards. Subagents do trigger
the parent's `PreToolUse` / `PostToolUse` hooks, though, and the parent is
paused inside `spawn_subagent` while they run. So the hook's activity log is a
live feed of the subagent's tool calls. When the subagent finishes, the tab
prints its duration, tool-call count, cost and result. Then the tab closes.

## Configuration

Environment variables read by the daemon. Put them in the environment herdr
runs in, or run the daemon by hand.

| variable | default | meaning |
|---|---|---|
| `HERDR_BOBSHELL_TABS` | `1` | `0` turns off subagent tabs (sidebar only) |
| `HERDR_BOBSHELL_TAB_LINGER` | `0` | seconds a finished subagent's tab stays open |
| `HERDR_BOBSHELL_POLL_SECONDS` | `0.6` | screen poll interval |
| `HERDR_BOBSHELL_DB` | `~/.bob/db/bob.db` | Bob's task store |
| `HERDR_BOBSHELL_BOB_SETTINGS` | `~/.bob/settings/settings.json` | where `install` writes hooks |
| `HERDR_BOBSHELL_STATE_DIR` | `~/.local/state/herdr/bobshell` | bindings, activity, tabs, pid, log |
| `HERDR_BOBSHELL_NODE` | first `node` on PATH, then Homebrew | node the herdr plugin starts the daemon with |
| `HERDR_SOCKET_PATH` | `~/.config/herdr/herdr.sock` | herdr control socket |

## Known limits

- **Parallel subagents share one feed.** Bob's hook payload names only the
  root task, not which subagent made a tool call. When several subagents run
  at once, every tab shows all of their tool calls, with a note explaining
  why. The prompt and the final result are still exact for each tab.
- **Failed tool calls don't appear.** Bob skips `PostToolUse` for failed
  calls, so the feed shows the call (`▶`) with no `✓` line after it.
- **No background shells.** Claude Code also opens tabs for
  `run_in_background` shells. Bob has no such feature, so there's nothing to
  mirror.
- **Screen rules** were captured against Bob 2.0.x. If a screen shows up as
  `unknown`, capture it with
  `herdr pane read <pane> --source detection > test/fixtures/<state>-<what>.txt`
  and run `npm test`.
- **Session restore** (re-running `bob -r <task>` after a herdr restart) is not
  part of this package.

## Troubleshooting

Start with `herdr-bobshell status`, then check the log at
`~/.local/state/herdr/bobshell/connector.log`.

| symptom | check |
|---|---|
| Bob pane not in the sidebar | daemon running? (`status`) |
| No tab for a subagent | Is the Bob session newer than the install? Is more than one Bob pane in the same directory? See the log. |
| Tab opens but shows no tool calls | `status` shows whether the hooks are present, and whether `disableGlobalHooks` is on in Bob |
| Tab opened and closed at once | the mirror exited; run `herdr-bobshell mirror <id>` by hand to see why |

## Development

```bash
npm test                                   # classifier, hook, installer
node bin/herdr-bobshell.js daemon          # foreground; takes over a running daemon
node bin/herdr-bobshell.js mirror <id>     # render any subagent, finished or not
```

## Releasing

Bump `version` in `package.json`, commit and push, then run `npm run release`.
It checks the version isn't on npm yet, runs the tests, and pushes a
`herdr-bobshell-v<version>` tag. The tag triggers
[`.github/workflows/publish-herdr-bobshell.yml`](../../.github/workflows/publish-herdr-bobshell.yml),
which tests again, publishes to npm and to GitHub Packages (that's what lists
the package on the repo page), and creates the GitHub release.

The workflow uses [npm trusted publishing](https://docs.npmjs.com/trusted-publishers),
so no npm token is stored in the repo. On the package's npm settings page, the
trusted publisher is set to GitHub Actions, `zack-maz/my-workbench`, workflow
`publish-herdr-bobshell.yml`. npm attaches a provenance statement to each
version published this way.
