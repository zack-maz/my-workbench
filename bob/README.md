# bob — IBM Bob Shell in the herdr sidebar

**Optional package.** Not in the default `stow` line, and `bob` is not in the
`Brewfile` — same convention as [`karabiner/`](../karabiner). Stow it only on a
machine that runs Bob Shell.

Herdr's agent-detection manifests only patch agents compiled into the binary, so
Bob can't be described declaratively. This package installs a herdr plugin that
classifies Bob's state out of process and pushes it back through
`pane.report_agent` — the same reported-state API the bundled `claude`, `codex`
and `droid` integrations use.

It gives you:

- **Agent recognition** — a pane running `bob` appears in the sidebar and in
  `herdr agent list` as agent `bobshell`, with live `idle` / `working` /
  `blocked` state and Bob's context percentage.
- **Persistent sessions** — each Bob pane's task id is recorded, and on the next
  server start `bob -r <task-id>` is re-run in the pane that held it. Bob
  conversations survive a herdr restart or a reboot.

```
┌─ sidebar ────────────────────┐
│ ◍ wP  1  bobshell  ctx 47%   │   ← working, 47% of context used
│ ○ wM  1  bobshell  ctx 25%   │   ← idle
│ ◍ wR  3  claude    ctx 7%    │
└──────────────────────────────┘
```

## Requirements

| | |
|---|---|
| herdr | 0.7.0+ |
| python3 | any 3.x — **stdlib only**, nothing to `pip install` |
| Bob Shell | `bob` (npm `bobshell`) and/or `bob2` (npm `bob-shell`), v2.x |
| OS | macOS or Linux |

Both packages report as agent `bobshell`. Fixture coverage exists for
`bobshell` 2.0.0 and `bob-shell` 2.0.0-beta.2.

## Install

```sh
cd ~/dotfiles
stow bob
herdr server reload-config      # or prefix+shift+r
```

Verify:

```sh
python3 ~/.config/herdr/plugins/local/herdr-bobshell/test-rules.py   # 6 fixtures, 0 failures
herdr agent list                                                    # a bob pane shows as `bobshell`
```

## Sidebar rows

The plugin reports the agent label and context meter, but **nothing renders them
until the sidebar has a row layout that uses them.** That layout lives in
`~/.config/herdr/config.toml`, which the [`herdr`](../herdr) package owns — two
packages cannot both own one file, so add this by hand:

```toml
[ui.sidebar.agents]
rows = [
  ["state_icon", "workspace", "tab"],
  [{ token = "$agent_bob", fg = "#4589ff", bold = true },
   { token = "$ctx_bar",   fg = "#ffc799", bold = true }],
]
```

Both tokens come from this plugin, so the block is self-contained — it needs
nothing from the `claude` package. To show Claude panes in the same layout, add
`$agent_claude` and `$mode` alongside and supply them from a Claude Code
statusline hook.

> `rows_by_agent` would be the natural way to key this per agent, but it only
> accepts herdr's compiled-in agent ids and so can't match a plugin-declared one.

## Uninstall

```sh
cd ~/dotfiles && stow -D bob
rm -rf ~/.local/state/herdr/bobshell-*
herdr server reload-config
```

## Upstream

Developed at `~/Documents/TOOLS/bobshell-herdr` (install/uninstall/doctor scripts,
`docs/PROTOCOL.md`, and the state-machine notes). Only the plugin itself is
vendored here. `capslock-prefix/` from that project is deliberately **not**
included — this repo's [`keymap`](../keymap) package owns the Caps Lock remap.
