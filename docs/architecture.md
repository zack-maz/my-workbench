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
nothing. `karabiner/` carries the same remap as a Karabiner-Elements rule —
an alternative for people already running Karabiner, **not** a second layer to
stack on top. Running both means two things are claiming the same key.

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
```

Each layer knows only about the one beneath it. Ghostty doesn't know what herdr
does with the keys it forwards; herdr doesn't know Neovim is running in a pane.
The one deliberate exception is `herdr-splits`, which exists precisely to make
two adjacent layers agree about direction keys.
