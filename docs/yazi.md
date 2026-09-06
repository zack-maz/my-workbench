# yazi — a beginner's guide

**yazi is a file manager that runs in the terminal.** Think Finder, except it's
keyboard-driven, starts instantly, and you never leave the terminal to use it.

Version here: **26.5.6**. Everything below is yazi's default keymap — this repo
adds no custom bindings, only a theme.

## What it's for

Three jobs, roughly:

1. **Browsing** — moving through directories faster than `cd` and `ls`, seeing
   file contents without opening them.
2. **File operations** — copy, move, rename, delete, across directories, on many
   files at once, without composing a `cp`/`mv` command.
3. **Finding things** — fuzzy jumping to a directory, searching by filename or
   by file *contents*, filtering the current view.

If you already live in the shell, the honest pitch is: yazi is better than `cd`
and `ls` for *exploring* — somewhere unfamiliar, or when you want to see what's
in files. For paths you already know, the shell is still faster.

## Starting and stopping

```sh
yazi          # from the shell
```

Inside Neovim, `<leader>-` (Space then `-`) opens yazi at the current file.

| Key | Does |
|---|---|
| `q` | Quit — **and `cd` the shell to wherever you browsed to** |
| `Q` | Quit *without* changing the shell's directory |
| `<Esc>` | Cancel the current thing (selection, search, visual mode) |
| `~` or `F1` | Help — the full keymap, searchable |

That `q` behavior is the thing to internalize: browse to a directory, press `q`,
and your shell is now there. It's a navigation tool as much as a file manager.

`~` is your safety net. It lists every binding, and you can type to filter it.

## Reading the screen

```
┌──────────────┬────────────────────────┬─────────────────────────┐
│ parent       │ current directory      │ preview                 │
│              │                        │                         │
│  Documents   │   atuin/               │  # my-workbench         │
│ ▸dotfiles    │  ▸docs/                │                         │
│  Downloads   │   ghostty/             │  A terminal-first…      │
│              │   README.md            │                         │
└──────────────┴────────────────────────┴─────────────────────────┘
  NOR  96B  docs                              drwxr-xr-x  14%  2/14
```

Three columns: where you came from, where you are, what's under the cursor. The
preview is live — move the cursor and it re-renders. The bottom bar shows mode,
size, current directory, permissions, and position in the list.

**Previews need external programs.** yazi shows text on its own, but images need
`chafa`, PDFs need `poppler`, video needs `ffmpegthumbnailer`, archives need
`sevenzip`. They're all in this repo's `Brewfile`. If a preview pane is blank
where you expected content, a backend is missing — yazi won't tell you.

## Moving around

`h` `j` `k` `l`, as in Vim. The clever part is what `h` and `l` mean here:

| Key | Does |
|---|---|
| `j` / `k` | Down / up one file |
| `l` | **Enter** the directory under the cursor |
| `h` | **Go up** to the parent directory |
| `H` / `L` | Back / forward through visited directories (like a browser) |
| `gg` / `G` | Top / bottom of the list |
| `<C-u>` / `<C-d>` | Half page up / down |
| `K` / `J` | Scroll the *preview* pane up / down |

`h` and `l` move you *between* directories, not left and right. Once that
clicks, browsing is one hand on the home row.

Jump straight somewhere:

| Key | Does |
|---|---|
| `gh` | Home (`~`) |
| `gc` | `~/.config` |
| `gd` | `~/Downloads` |
| `z` | **fzf** — fuzzy-find a file or directory anywhere below here |
| `Z` | **zoxide** — jump to a directory you visit often, by name fragment |
| `g<Space>` | Type a path to jump to |

`z` and `Z` are the two worth learning first. `Z` in particular: type `dot`,
press Enter, and you're in `~/dotfiles` no matter where you started.

## Selecting files

Most operations act on **selected** files, or on the file under the cursor if
nothing is selected.

| Key | Does |
|---|---|
| `<Space>` | Toggle selection of the current file, move down |
| `v` | Visual mode — select a range as you move |
| `V` | Visual mode, but *un*selecting |
| `<C-a>` | Select everything in this directory |
| `<C-r>` | Invert the selection |
| `<Esc>` | Clear the selection |

Selections **persist across directories.** Select two files here, move
somewhere else, select a third, and all three are still selected. This is how
you gather files scattered across a tree before copying them.

## Doing things to files

| Key | Does |
|---|---|
| `y` | Yank (copy) |
| `x` | Cut |
| `p` | Paste into the current directory |
| `P` | Paste, overwriting existing files |
| `Y` / `X` | Cancel a pending yank/cut |
| `d` | **Trash** — recoverable, goes to macOS Trash |
| `D` | **Delete permanently** — not recoverable |
| `a` | Create a file; end the name with `/` to make a directory instead |
| `r` | Rename |
| `o` / `<Enter>` | Open with the default application |
| `O` | Open with — choose the application |
| `<Tab>` | "Spot" the hovered file: fuller detail than the preview |

Copy is a two-step: `y` where the files are, move, `p` where they should go.
Same as Vim, and unlike Finder there's no drag involved.

`d` vs `D` is the one to be careful about. `d` is the safe one.

## Finding things

Four different mechanisms, which is the most confusing part of yazi for
beginners. They do genuinely different jobs:

| Key | Name | What it does |
|---|---|---|
| `f` | **Filter** | Hides non-matching files from the current view, live |
| `/` | **Find** | Jumps the cursor to the next match in this directory |
| `s` | **Search by name** | Searches the whole tree below here, via `fd` |
| `S` | **Search by content** | Searches *inside* files, via `ripgrep` |
| `z` | **fzf** | Fuzzy-jump to a path below here |

Rules of thumb: `f` to narrow a long directory down. `s` when you know part of
the filename but not where it is. `S` when you know a string that's *in* the
file but not which file. `n` / `N` step through results from `/`.

`<C-s>` cancels a search that's taking too long.

## Tabs

| Key | Does |
|---|---|
| `t` | New tab in the current directory |
| `1`…`9` | Switch to tab N |
| `[` / `]` | Previous / next tab |
| `<C-c>` | Close the current tab (quits if it's the last) |

Useful for a copy between two distant directories: open the destination in a
second tab, yank in one, switch, paste.

## A few more

| Key | Does |
|---|---|
| `.` | Toggle hidden (dot)files |
| `,` then a key | Change sort — `,s` size, `,m` modified time, `,a` alphabetical |
| `m` then a key | Change what the middle column shows — `ms` size, `mp` permissions, `mm` mtime |
| `cf` / `cc` | Copy the filename / full path to the clipboard |
| `;` | Run a shell command on the selected files |
| `:` | Same, but wait for it to finish before returning |
| `w` | Task manager — watch long copies progress |

## What this repo configures

Deliberately very little. yazi's defaults are good, so only three things change.

**[`yazi.toml`](../yazi/.config/yazi/yazi.toml)**

```toml
[mgr]
show_hidden = false      # dotfiles hidden until you press `.`
sort_dir_first = true    # directories above files
```

**[`theme.toml`](../yazi/.config/yazi/theme.toml)** selects the `tokyo-night`
flavor, so yazi matches the terminal, prompt and editor. See
[theming.md](theming.md).

**[`flavors/tokyo-night.yazi/`](../yazi/.config/yazi/flavors)** is that flavor,
vendored into the repo rather than installed separately — it's a theme package
(colors plus a `tmtheme.xml` for syntax highlighting in previews), and keeping it
in-tree means a fresh machine gets the right colors from `stow` alone, with no
extra install step.

### Plugins

**None.** yazi has a plugin system (`ya pkg add …`), and this setup doesn't use
it. The `tokyo-night.yazi` directory is a *flavor* — a theme — not a plugin,
despite the matching `.yazi` suffix.

The integration with Neovim isn't a yazi plugin either; it's a *Neovim* plugin
(`yazi.nvim`) that launches yazi. See [neovim.md](neovim.md#yazinvim).

## Common tasks

| Goal | Keys |
|---|---|
| Get my shell to this directory | browse there, `q` |
| Copy 3 scattered files into one folder | `<Space>` each, navigate, `p` |
| Find a file when I forget where it is | `s`, type part of the name |
| Find which file contains a string | `S`, type the string |
| Jump to a project I use often | `Z`, type a fragment |
| Look inside a PDF or image | move the cursor onto it |
| Rename a lot of files | `<C-a>`, then `r` |
| Delete something safely | `d` (not `D`) |
| I'm lost | `<Esc>`, then `~` for help |

## Learning more

- Press `~` — the built-in help is the fastest reference
- [Official docs](https://yazi-rs.github.io/docs/quick-start)
- [Full default keymap](https://github.com/sxyazi/yazi/blob/main/yazi-config/preset/keymap-default.toml)
