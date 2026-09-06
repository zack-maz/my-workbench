# Keybindings

Caps Lock is the herdr prefix. Tap it, release, then press the next key — it is
a prefix, not a modifier you hold.

## herdr — `Caps` then…

Defined in [`herdr/config.toml`](../herdr/.config/herdr/config.toml) as
`prefix = "f18"`.

### Panes

| Keys | Action |
|---|---|
| `Caps` `v` | Split vertical |
| `Caps` `-` | Split horizontal |
| `Caps` `h` `j` `k` `l` | Focus pane in that direction |
| `Caps` `z` | Zoom pane (toggle fullscreen within the tab) |
| `Caps` `x` | Close pane |
| `Caps` `b` | Toggle sidebar |

### Tabs and sessions

| Keys | Action |
|---|---|
| `Caps` `c` | New tab |
| `Caps` `n` / `p` | Next / previous tab |
| `Caps` `1`…`9` | Switch to tab by number |
| `Caps` `w` | Workspace picker |
| `Caps` `q` | Detach (session keeps running) |

`Caps` `q` detaches — panes, agents and scrollback stay alive. To actually stop
a session: `herdr session stop <name>`.

### Commands

| Keys | Action |
|---|---|
| `Caps` `g` | lazygit in a floating popup, 90% × 90% |
| `Caps` `?` | Help |
| `Caps` `Shift+r` | Reload `config.toml` |

The lazygit binding is a `type = "popup"` command — it opens over the current
layout and disappears on exit, without disturbing any pane.

## Across herdr and Neovim

These are the same keys in both, and they cross the boundary between them. No
prefix.

| Keys | Action |
|---|---|
| `Ctrl` `h` `j` `k` `l` | Move to the split or pane in that direction |
| `Alt` `h` `j` `k` `l` | Resize in that direction |

Move left from the leftmost Neovim split and you land in the herdr pane to its
left. `at_edge = "wrap"` means moving past the last pane wraps to the first
rather than stopping.

They work from Neovim's terminal buffers too — the mapping calls `stopinsert`
first so the move registers instead of being typed into the terminal.

Outside herdr, `HERDR_ENV` is unset, the plugin doesn't load, and `Ctrl-hjkl`
falls back to LazyVim's window navigation.

## Neovim

Leader is `Space` (LazyVim default). Only the additions are listed — everything
else is [stock LazyVim](https://www.lazyvim.org/keymaps). Beginner walkthrough in
[neovim.md](neovim.md).

| Keys | Action |
|---|---|
| `<leader>` `-` | yazi, at the current file |
| `<leader>` `c` `w` | yazi, in the working directory |

> `<leader>-` **overrides** LazyVim's stock "split below" — use `<C-w>s` for a
> horizontal split. And do not also enable LazyVim's built-in yazi extra: both
> register a picker and you get two competing file managers on one key.

## yazi

Stock yazi keys — this repo adds no custom keymap. Full walkthrough in
[yazi.md](yazi.md).

| Keys | Action |
|---|---|
| `h` `j` `k` `l` | Navigate — `l` enters a directory, `h` goes up |
| `H` / `L` | Back / forward through visited directories |
| `Space` | Toggle selection (persists across directories) |
| `y` / `x` / `p` | Yank / cut / paste |
| `d` / `D` | Trash / delete permanently |
| `a` | Create file (trailing `/` creates a directory) |
| `r` | Rename |
| `.` | Toggle hidden files |
| `f` | Filter the current view |
| `/` | Find next match in this directory (`n` / `N` to step) |
| `s` / `S` | Search the tree by filename (`fd`) / by contents (`ripgrep`) |
| `z` / `Z` | Jump via fzf / via zoxide |
| `t` · `1`–`9` | New tab · switch to tab |
| `w` | Task manager |
| `~` or `F1` | Help — the full keymap |
| `q` / `Q` | Quit, taking the shell with you / quit without changing directory |

`q` leaves your shell in whatever directory you browsed to, which makes yazi a
navigation tool as much as a file manager. `Q` leaves the shell where it was.

Config sets `show_hidden = false` and `sort_dir_first = true`.

## Ghostty

Mostly stock. `macos-option-as-alt = true` is what makes `Alt-hjkl` reach herdr
instead of typing `˙∆˚¬`.

| Keys | Action |
|---|---|
| `Cmd` `Shift` `,` | Reload config |
| `Cmd` `T` / `W` | New / close tab |

Note that closing a Ghostty window does not close what's running — herdr's
session outlives it.

## Caps Lock itself

After the remap, Caps Lock no longer toggles caps and its light stays off. It
emits F18, which nothing else binds.

To type in caps, use Shift, or restore the key temporarily:

```sh
hidutil property --set '{"UserKeyMapping":[]}'   # until next login
```

The launch agent reapplies the remap at every login. See
[install.md](install.md#3-caps-lock--f18) to remove it permanently.
