# Architecture

How the pieces fit, and why they're arranged this way.

## The session model

Most terminal setups treat the window as the thing that exists and the shell as
its contents. This one inverts that.

```
Ghostty window          Ghostty window          Ghostty window
      │                       │                       │
      └───────────────┬───────┴───────────────────────┘
                      │  all attach to
              ┌───────▼────────┐
              │ herdr session  │   ← the thing that actually exists
              │  panes, agents │
              │  scrollback    │
              └────────────────┘
```

Ghostty's config sets:

```
command = /opt/homebrew/bin/herdr
```

so a new window launches herdr rather than a shell. herdr with no arguments
*launches-or-attaches*: the first window starts the session, every later window
attaches to the same one. Closing a window detaches; it doesn't kill anything.

The consequence worth internalizing: **an agent running in a pane survives you
closing the terminal.** Quitting Ghostty is not quitting your work. To actually
end things you stop the session (`herdr session stop <name>`), not the window.

## The prefix key

Caps Lock is remapped to **F18** — a keycode no application binds — and herdr
takes F18 as its prefix:

```
Caps Lock ──hidutil──> F18 ──herdr──> prefix
```

Two properties make this work. F18 collides with nothing, so the prefix never
fights an application shortcut the way `Ctrl-b` or `Ctrl-a` do. And Caps Lock
sits under the left pinky on the home row — the most reachable key on the
keyboard, spent on a function nobody uses.

The remap is a `hidutil` command run by a launch agent at login
(`keymap/Library/LaunchAgents/com.zackmaz.capslock-f18.plist`). It is
OS-level, so it applies everywhere, needs no running application, and costs
nothing — which is why it, and not Karabiner, is the default.

`karabiner/` carries the same remap as a Karabiner-Elements rule, for people
already running Karabiner for other reasons. It is an **alternative, not a
second layer**: it is not in the `Brewfile`, not in the default `stow` line, and
running both would mean two things claiming the same physical key.

## Navigation across two split systems

herdr splits panes. Neovim splits windows. Normally these are separate
hierarchies with separate keys, and you have to know which one you're in before
you press anything.

[`herdr-splits.nvim`](../nvim/.config/nvim/lua/plugins/herdr-splits.lua) merges
them. `Ctrl-h/j/k/l` asks: is there a Neovim split in that direction? Move
there. Otherwise, tell herdr to move to the pane in that direction. From the
edge of Neovim you cross into a herdr pane with the same keystroke that moves
between Neovim splits.

The plugin is loaded conditionally:

```lua
cond = vim.env.HERDR_ENV == "1",
```

`HERDR_ENV` is set only inside a herdr-managed pane. Run Neovim outside herdr —
over SSH, in a plain terminal — and the plugin never loads, so LazyVim's stock
`Ctrl-hjkl` window navigation is untouched. Nothing has to be unlearned for the
case where herdr isn't there.

`Alt-h/j/k/l` resizes across the same boundary, `default_amount = 0.03` on the
herdr side and `neovim_amount = 3` on the Neovim side, tuned so a keypress moves
a visually similar distance in both.

## The editor as an agent's collaborator

The assumption throughout is that **something other than you is writing files.**

LazyVim only runs `:checktime` on `FocusGained`, so a file an agent rewrites
while your terminal is unfocused doesn't reload — you look back at a stale
buffer. [`autocmds.lua`](../nvim/.config/nvim/lua/config/autocmds.lua) fixes this
for markdown:

1. Watch the buffer's **directory** with a libuv `fs_event`. Directory, not
   file: agents and formatters typically write to a temp file and rename over
   the original, which destroys the inode a file watch is holding.
2. Debounce 100 ms, because writes come in bursts.
3. Bail if `vim.bo[buf].modified` — never destroy your unsaved edits. LazyVim's
   `FocusGained` check will raise the conflict when you return.
4. `:checktime` to reload.

`markdown-preview.nvim` refreshes on cursor movement, which never happens if
you aren't touching the keyboard, so a `FileChangedShellPost` autocmd calls
`mkdp#rpc#preview_refresh()` explicitly after the reload. With
`mkdp_refresh_slow = 0`, the browser tracks the buffer rather than the last save.

The result: an agent writes a document and you watch it change in the editor and
the browser without touching anything.

## Agents get tabs

The same assumption, one level up: **something other than you is running
work**, and it should be visible where everything else is visible — in the
tab bar.

Claude Code's subagents and background shells run inside the `claude`
process. No PTY, so herdr can't see them. What Claude Code does expose is a
live file per task and a hook event when one starts and stops:

```
claude (main pane)
  ├─ Agent tool ───▶ SubagentStart ──▶ herdr tab create --no-focus ──▶ ⚙ tab renders the transcript
  │                  SubagentStop  ──▶ herdr tab close
  └─ Bash, bg ─────▶ PostToolUse   ──▶ herdr tab create --no-focus ──▶ $ tab tails the output,
                                                                         closes when the shell exits
```

[`herdr-agent-tab.py`](../claude/.claude/hooks/herdr-agent-tab.py) is the
hook on all three events. It talks to herdr over the same socket API the
`herdr` CLI uses, in the workspace the agent is running in (`HERDR_WORKSPACE_ID`
is inherited by hooks). The tabs never take focus, and they close the moment
the task does — they answer "what is it doing *right now*", not "what did it
do".

For a subtask worth supervising, the global [`CLAUDE.md`](../claude/.claude/CLAUDE.md)
tells Claude to skip the in-process Agent tool and start a real `claude` in a
real tab with `herdr agent start`, which herdr then tracks as a first-class
agent. Mechanism and install: [claude-code.md](claude-code.md).

## Layering

```
hidutil / Karabiner   Caps Lock -> F18            OS keyboard layer
        │
Ghostty               window, GPU render, font    launches herdr, not a shell
        │
herdr                 session, panes, agents      owns F18 as prefix
        │
zsh                   shell, colors, history      starship prompt
        │
nvim / yazi / lazygit                             share Ctrl-hjkl with herdr
claude                agent                       hooks open herdr tabs for its subagents
```

Each layer knows only about the one beneath it. Ghostty doesn't know what herdr
does with the keys it forwards; herdr doesn't know Neovim is running in a pane.
The deliberate exceptions are `herdr-splits`, which exists precisely to make
two adjacent layers agree about direction keys, and the Claude Code hooks,
which reach back up to herdr to give subagents a place on screen.

## Further reading

Full index: [docs/](README.md)

- [neovim.md](neovim.md) — beginner's guide to the editor and the four plugins added here
- [yazi.md](yazi.md) — beginner's guide to the file manager
- [keybindings.md](keybindings.md) — the full keymap
- [claude-code.md](claude-code.md) — Claude Code inside herdr: subagents as tabs
- [theming.md](theming.md) — the palette and where each tool restates it
- [stow.md](stow.md) — how the symlink layout works
