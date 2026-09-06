# Neovim + LazyVim — a beginner's guide

**Neovim is a modal text editor.** This setup runs
[LazyVim](https://lazyvim.org), which is a *distribution*: Neovim with ~35
plugins, an LSP setup, and a keymap already assembled and working. You are not
configuring an editor from scratch — you're learning one that's already built.

That distinction matters when you search for help. Most Neovim tutorials teach
vanilla Neovim; LazyVim adds a layer on top with its own keys. When something
here doesn't match a tutorial, LazyVim's layer is usually why.

## The one idea: modes

A normal editor is always inserting text. Neovim has **modes**, and most of the
time you are *not* in the one that types.

| Mode | Enter with | You're doing |
|---|---|---|
| **Normal** | `<Esc>` | Moving, deleting, copying — keys are commands |
| **Insert** | `i` | Typing text |
| **Visual** | `v` | Selecting |
| **Command** | `:` | Running a command like `:w` |

You start in Normal mode. `i` starts typing, `<Esc>` stops. If a keypress does
something bizarre, you were probably in Normal mode when you meant to type —
press `i` and try again.

**When lost: `<Esc>` then `:q!` then Enter** quits without saving.

## Survival keys

Enough to edit a file today.

| Key | Does |
|---|---|
| `i` / `a` | Insert before / after the cursor |
| `<Esc>` | Back to Normal mode |
| `h` `j` `k` `l` | Left, down, up, right (arrows work too) |
| `w` / `b` | Forward / back one word |
| `0` / `$` | Start / end of line |
| `gg` / `G` | Top / bottom of file |
| `x` | Delete character |
| `dd` / `yy` / `p` | Delete line / copy line / paste |
| `u` / `<C-r>` | Undo / redo |
| `/text` | Search; `n` next, `N` previous |
| `<C-s>` | Save |
| `:q` | Quit |

Commands compose: `d` (delete) + `w` (word) = `dw`. `d3w` deletes three words.
That grammar is the thing that eventually makes Vim worth it.

## Leader is Space

Nearly every LazyVim feature hangs off the **leader key**, mapped to `<Space>`.

> **Press `<Space>` and wait one second.** A menu pops up showing every key you
> can press next, with descriptions. Keep pressing, keep getting menus.

That's [which-key](https://github.com/folke/which-key.nvim), and it means you
don't have to memorize this document — the editor tells you. `<leader>?` shows
every binding for the current buffer.

The groups:

| Prefix | Group |
|---|---|
| `<leader>f` | **f**ind — files, buffers, recent |
| `<leader>s` | **s**earch — grep, symbols, help, keymaps |
| `<leader>g` | **g**it |
| `<leader>c` | **c**ode — LSP actions, format, rename |
| `<leader>b` | **b**uffers |
| `<leader>x` | diagnostics / lists |
| `<leader>u` | **u**i toggles |
| `<leader>q` | sessions / quit |

## Finding things

The keys you'll use most.

| Key | Does |
|---|---|
| `<leader><leader>` | **Find files** in the project |
| `<leader>/` | **Grep** — search file *contents* across the project |
| `<leader>,` | Switch buffer (an open file) |
| `<leader>fr` | Recently opened files |
| `<leader>e` | Toggle the file **explorer** sidebar |
| `<leader>sk` | Search keymaps — "what was that key?" |
| `<leader>sh` | Search help |

`<leader><leader>` and `<leader>/` cover most navigation. You rarely need the
file tree once fuzzy-finding is a habit.

## Code intelligence (LSP)

A language server gives real understanding of your code — go-to-definition,
rename, errors. LazyVim installs servers automatically per filetype via
[Mason](https://github.com/mason-org/mason.nvim) (`<leader>cm` to manage).

| Key | Does |
|---|---|
| `gd` | **Go to definition** |
| `gr` | Find **references** |
| `gI` | Go to implementation |
| `gy` | Go to type definition |
| `K` | **Hover** — docs for the symbol under the cursor |
| `<leader>ca` | **Code action** — the fixes offered at this spot |
| `<leader>cr` | **Rename** the symbol everywhere |
| `<leader>cf` | Format the file |
| `<leader>cl` | LSP info — is a server even attached? |
| `<C-o>` / `<C-i>` | Jump back / forward after a `gd` |

`gd` then `<C-o>` to come back is the loop you'll run hundreds of times a day.

Errors and warnings:

| Key | Does |
|---|---|
| `]d` / `[d` | Next / previous diagnostic |
| `<leader>cd` | Show the full message on this line |
| `<leader>xx` | All diagnostics in a list (Trouble) |

## Windows, buffers, tabs

- **Buffer** — an open file. Most of the time you want these.
- **Window** — a split view onto a buffer.
- **Tab** — a layout of windows. Rarely needed.

| Key | Does |
|---|---|
| `<S-h>` / `<S-l>` | Previous / next buffer |
| `<leader>bd` | Close buffer |
| `<C-w>s` / `<leader>\|` | Split horizontal / vertical |
| `<C-h/j/k/l>` | Move between splits — **and herdr panes**, see below |
| `<leader>wd` | Close window |

> LazyVim normally binds `<leader>-` to "split below", but here it opens yazi
> (see below). For a horizontal split use `<C-w>s`.

## Git

[gitsigns](https://github.com/lewis6991/gitsigns.nvim) marks changed lines in
the gutter.

| Key | Does |
|---|---|
| `<leader>gs` | Git status |
| `<leader>gd` | Diff of the current hunk |
| `<leader>gb` | Blame this line |
| `]h` / `[h` | Next / previous changed hunk |

For real git work, `Caps` `g` opens lazygit in a herdr popup — outside Neovim,
over the whole session. See [keybindings.md](keybindings.md).

## The four plugins this repo adds

LazyVim ships ~31 plugins of its own — treesitter, blink.cmp, snacks, trouble,
which-key and the rest. **Four are added here**, in
[`lua/plugins/`](../nvim/.config/nvim/lua/plugins):

### tokyonight (colorscheme)

[`colorscheme.lua`](../nvim/.config/nvim/lua/plugins/colorscheme.lua) — TokyoNight
Night, with backgrounds forced to `#0a0a0a` so the editor matches the terminal
exactly, while syntax colors stay stock. Comments and keywords are italic.
See [theming.md](theming.md).

### yazi.nvim

[`yazi.lua`](../nvim/.config/nvim/lua/plugins/yazi.lua) — opens
[yazi](yazi.md) inside Neovim as a file manager, instead of a tree sidebar.

| Key | Does |
|---|---|
| `<leader>-` | yazi, at the current file |
| `<leader>cw` | yazi, at the working directory |

Pick files, hit Enter, they open as buffers. `open_for_directories = false`, so
`nvim somedir/` still uses the normal explorer.

> Two notes. `<leader>-` **overrides** LazyVim's "split below" — that's the
> tradeoff for a one-key file manager. And don't also enable LazyVim's built-in
> yazi extra: both register a picker and you get two competing file managers on
> one key.

### herdr-splits.nvim

[`herdr-splits.lua`](../nvim/.config/nvim/lua/plugins/herdr-splits.lua) — makes
`<C-h/j/k/l>` cross the boundary between Neovim splits and herdr panes. Move
left from the leftmost split and you land in the terminal pane to its left, same
keystroke.

`<M-h/j/k/l>` (Alt) resizes across the same boundary.

Loaded only when `HERDR_ENV == "1"` — inside a herdr pane. Run Neovim over SSH
or in a plain terminal and it never loads, so stock LazyVim navigation is
untouched. Requires the herdr side too:
`herdr plugin install lmilojevicc/herdr-splits.nvim --yes`.

### markdown-preview.nvim

[`markdown-preview.lua`](../nvim/.config/nvim/lua/plugins/markdown-preview.lua) —
renders the current markdown file in a browser, live.

| Key | Does |
|---|---|
| `<leader>mp` | Toggle the preview |

Configured with `mkdp_refresh_slow = 0`, so it tracks the buffer as you type
rather than only on save. Paired with a custom autocmd in
[`autocmds.lua`](../nvim/.config/nvim/lua/config/autocmds.lua) that reloads
markdown buffers when an **external process** writes them — so a file an agent
is editing updates in both the editor and the browser without you touching
anything. That machinery is explained in
[architecture.md](architecture.md#the-editor-as-an-agents-collaborator).

## Where config goes

```
nvim/.config/nvim/
├── init.lua                    entry point, don't touch
├── lua/config/
│   ├── options.lua             settings (:set …)
│   ├── keymaps.lua             your key bindings
│   ├── autocmds.lua            automatic actions
│   └── lazy.lua                plugin manager bootstrap
└── lua/plugins/                one file per plugin, or group them
```

To add a plugin, drop a file in `lua/plugins/`:

```lua
-- lua/plugins/example.lua
return {
  { "github-user/plugin-name", opts = {} },
}
```

Restart, and [lazy.nvim](https://lazy.folke.io) installs it. To change a
LazyVim-provided plugin, specify it again with new `opts` — they get merged, not
replaced.

`example.lua` in this repo is LazyVim's stock sample file. Its third line is
`if true then return {} end`, so **it's disabled** — it's there as a reference,
not as active config.

## Managing it

| Command | Does |
|---|---|
| `:Lazy` | Plugin manager — install, update (`U`), profile startup |
| `:Mason` | Language servers and formatters |
| `:LazyHealth` | Diagnose a broken setup |
| `:LazyExtras` | LazyVim's optional language/feature packs (none enabled here) |

`lazy-lock.json` pins every plugin version and is committed, so a fresh machine
installs the exact set that works. `:Lazy update` changes it; commit the result.

## Learning more

- `<Space>` and wait — the fastest reference is the editor itself
- `:Tutor` — Neovim's built-in 20-minute tutorial, worth doing once
- `<leader>sk` — search all keymaps
- [LazyVim keymaps](https://www.lazyvim.org/keymaps) — the full stock list
- [LazyVim docs](https://www.lazyvim.org)
