<h1 align="center">my-workbench</h1>

<p align="center">
  A terminal-first workbench for pair-programming with coding agents.<br>
  <sub>Ghostty · herdr · LazyVim · yazi · zsh — one palette, one prefix key, managed with GNU Stow.</sub>
</p>

<p align="center">
  <a href="docs/architecture.md">Architecture</a> ·
  <a href="docs/install.md">Install</a> ·
  <a href="docs/keybindings.md">Keybindings</a> ·
  <a href="docs/theming.md">Theming</a> ·
  <a href="docs/stow.md">Stow layout</a> ·
  <a href="docs/">All docs</a><br>
  <sub>New to these tools? <a href="docs/neovim.md">Neovim guide</a> · <a href="docs/yazi.md">yazi guide</a></sub>
</p>

---

## The idea

Four ideas hold this together. Everything else is detail.

**Caps Lock is the prefix.** A `hidutil` login agent remaps Caps Lock to F18 — a
keycode no application binds — and herdr takes F18 as its prefix. The least
useful key on the keyboard, sitting under the strongest finger, becomes the way
into the whole workspace. Nothing has to fight `Ctrl-b` for it.

**The session outlives the window.** Ghostty launches `herdr` instead of a
shell, and herdr attaches to a persistent session rather than creating one. So
closing a window doesn't kill anything — the panes, the agents and their
scrollback are all still there in the next one. Windows become views onto a
session rather than containers for it, which matters when a pane holds an agent
that's been working for twenty minutes.

**One palette, everywhere.** `LS_COLORS`, `EZA_COLORS`, starship, Ghostty, yazi
and Neovim all draw from the same TokyoNight hexes over a near-black `#0a0a0a`.
Directory blue in `ls` is the same blue as the directory in the prompt, because
both are literally `#7aa2f7`. Nothing looks bolted on.

**The editor assumes an agent is writing the files.** Neovim watches markdown
buffers for external writes and reloads them live, pushing the change through to
the browser preview — see [details worth stealing](#details-worth-stealing).

## The stack

| Tool | Role | Config |
|---|---|---|
| [Ghostty](https://ghostty.org) | GPU terminal — the only GUI app in the loop | [`ghostty/`](ghostty/.config/ghostty/config) |
| [herdr](https://herdr.dev) | Agent multiplexer; replaces tmux | [`herdr/`](herdr/.config/herdr/config.toml) |
| [Neovim](https://neovim.io) + [LazyVim](https://lazyvim.org) | Editor — [guide](docs/neovim.md) | [`nvim/`](nvim/.config/nvim) |
| [yazi](https://yazi-rs.github.io) | File manager, in and out of the editor — [guide](docs/yazi.md) | [`yazi/`](yazi/.config/yazi) |
| [starship](https://starship.rs) | Prompt | [`starship/`](starship/.config/starship.toml) |
| [atuin](https://atuin.sh) | Searchable shell history | [`atuin/`](atuin/.config/atuin/config.toml) |
| zsh | Shell — eza, bat, fd, ripgrep, fzf, zoxide | [`zsh/`](zsh/.zshrc) |
| [Karabiner](https://karabiner-elements.pqrs.org) / `hidutil` | Caps Lock → F18 | [`karabiner/`](karabiner/.config/karabiner) · [`keymap/`](keymap/Library/LaunchAgents) |

## How it fits together

```
┌─ Ghostty ──────────────────────────────────────────────────┐
│  launches `herdr` instead of a shell, so every window       │
│  attaches to the same persistent session                    │
│                                                             │
│  ┌─ herdr session ───────────────────────────────────────┐  │
│  │                          │                            │  │
│  │   nvim (LazyVim)         │   agent                    │  │
│  │   └ <leader>- → yazi     │                            │  │
│  │                          ├────────────────────────────┤  │
│  │                          │   shell                    │  │
│  │                          │   └ Caps+g → lazygit       │  │
│  └──────────────────────────┴────────────────────────────┘  │
│         ↑                                                   │
│    Ctrl-hjkl moves across BOTH herdr panes and nvim splits   │
│    — one keymap, no thinking about which you're in           │
└─────────────────────────────────────────────────────────────┘
```

[Architecture →](docs/architecture.md)

## Keymap

Caps Lock is the prefix — tap it, then a key.

| Keys | Action |
|---|---|
| `Caps` `v` / `-` | Split vertical / horizontal |
| `Caps` `h j k l` | Focus pane |
| `Caps` `z` / `x` | Zoom / close pane |
| `Caps` `c` · `n` `p` · `1`–`9` | New tab · next/prev · switch |
| `Caps` `g` | lazygit in a floating popup |
| `Caps` `w` / `q` | Workspace picker / detach |

These work identically in a herdr pane and inside Neovim:

| Keys | Action |
|---|---|
| `Ctrl` `h j k l` | Move between panes **and** splits |
| `Alt` `h j k l` | Resize |
| `<leader>-` | yazi at the current file |

[Full keybindings →](docs/keybindings.md) · New to these tools? [Neovim](docs/neovim.md) · [yazi](docs/yazi.md)

## Install

macOS, Apple Silicon.

```sh
git clone https://github.com/zack-maz/my-workbench.git ~/dotfiles
cd ~/dotfiles

brew bundle --file=Brewfile          # every tool, including yazi's preview backends
stow ghostty herdr nvim yazi zsh starship atuin git karabiner

# Caps Lock -> F18, now and at every login
cp keymap/Library/LaunchAgents/com.zackmaz.capslock-f18.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.zackmaz.capslock-f18.plist

# seamless herdr <-> nvim navigation
herdr plugin install lmilojevicc/herdr-splits.nvim --yes
```

Open Ghostty. It launches straight into herdr.

> **Stow will not overwrite an existing regular file** — it skips silently, so
> the old config keeps winning and the new one looks like it "didn't apply."
> Back up and remove any real file at a target path first, or use `stow --adopt`.

[Full install, verification and rollback →](docs/install.md)

## Details worth stealing

**Markdown that reloads while an agent writes it.**
LazyVim only runs `:checktime` on `FocusGained`, so a file rewritten by an agent
while the terminal is unfocused never reloads on screen.
[`autocmds.lua`](nvim/.config/nvim/lua/config/autocmds.lua) watches the buffer's
*directory* with libuv — a directory, not the file, so atomic write-and-rename
is still caught — debounces 100 ms, and refuses to reload over unsaved edits.
`markdown-preview.nvim` only refreshes on cursor movement, so a
`FileChangedShellPost` hook pushes the refresh to the browser explicitly. Write
a doc with an agent and watch it update live in both places.

**Navigation that doesn't care what it's moving through.**
[`herdr-splits.lua`](nvim/.config/nvim/lua/plugins/herdr-splits.lua) loads with
`cond = vim.env.HERDR_ENV == "1"` — only inside a herdr pane. Outside herdr,
LazyVim's stock `Ctrl-hjkl` is untouched. The same fingers work in both worlds
and nothing has to be unlearned for the case where herdr isn't there.

**`LS_COLORS` derived from the prompt palette.**
[`.zshrc`](zsh/.zshrc) writes `LS_COLORS` and `EZA_COLORS` as truecolor escapes
using the exact hexes in the starship palette, and zsh's completion menu reads
the same variable through `zstyle list-colors`. Listings, completions and prompt
agree because they share one source of color.

**yazi's preview backends are invisible dependencies.**
`chafa`, `poppler`, `resvg`, `ffmpegthumbnailer`, `exiftool` and `sevenzip` are
what stand between a real preview and a filename in an empty pane — and their
absence produces no error. They're grouped and commented in the
[`Brewfile`](Brewfile) so a fresh machine gets them.

**A three-tier prompt path.** Inside a repo the path renders as dim ancestors →
bold mauve repo root → blue subpath, so the repository name pops out of a long
path without truncating it away. The repo root shares its color with the git
branch one segment over.

[Theming →](docs/theming.md)

## Repo layout

Each top-level directory is a **Stow package** whose inner tree mirrors the path
it occupies under `$HOME`. The subpath is the contract:

```
ghostty/.config/ghostty/config   →   ~/.config/ghostty/config
zsh/.zshrc                       →   ~/.zshrc
```

Stow creates symlinks, so nothing is copied, editing the linked file edits the
repo, and the whole thing is reversible:

```sh
stow -D nvim     # unlink one package
stow -D ghostty herdr nvim yazi zsh starship atuin git karabiner   # unlink all
```

`Brewfile`, `README.md` and `docs/` are repo metadata and are never stowed.

[Stow layout, adding a package, gotchas →](docs/stow.md)

## Secrets

Tokens, SSH material, `gh` host config and `.env` files are excluded in
`.gitignore` and never enter the tree.
[`scripts/secret-scan.sh`](scripts/secret-scan.sh) and `gitleaks` run over the
full history before any push.

The one credential-adjacent line is in `.zshrc`, which exports
`GITHUB_PERSONAL_ACCESS_TOKEN` by *calling* `gh auth token` at shell startup —
read at runtime, never stored here.
