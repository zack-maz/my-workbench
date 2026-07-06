# dotfiles

Personal macOS (Apple Silicon) development-environment configuration, managed
with [GNU Stow](https://www.gnu.org/software/stow/). Each tool is a self-contained
**Stow package** whose internal directory tree mirrors the path its config will
occupy under `$HOME`. Stowing a package creates symlinks — nothing is copied, so
the whole thing is fully reversible.

## Packages

| Package    | Links into                | Contents (from Phase 2 on) |
|------------|---------------------------|----------------------------|
| `ghostty`  | `~/.config/ghostty/`      | Ghostty terminal config    |
| `tmux`     | `~/.config/tmux/`         | tmux config (XDG path)     |
| `nvim`     | `~/.config/nvim/`         | Neovim / LazyVim tree      |
| `zsh`      | `~/` (home root)          | `.zshrc`                   |
| `starship` | `~/.config/`              | `starship.toml`            |

The package subpath is the contract: `ghostty/.config/ghostty/` becomes
`~/.config/ghostty/` when stowed. Packages start as empty skeletons (a `.gitkeep`
per leaf); real config is authored in later phases.

## Apply everything

Run once from the repo root:

```sh
cd ~/dotfiles
stow ghostty tmux nvim zsh starship
```

This symlinks each package's contents into `$HOME`, preserving the `.config/...`
subpaths.

## Reverse it (unstow)

Stow is fully reversible. To unlink a single package or all of them:

```sh
cd ~/dotfiles
stow -D nvim                       # remove just the Neovim symlinks
stow -D ghostty tmux nvim zsh starship   # remove everything
```

## Backup convention

Stow **will not overwrite an existing regular file** — it silently skips, so the
old file keeps winning and the new config "doesn't apply." Before letting Stow
take over a path that already has a real file, back that file up with a
timestamped copy so it can be restored:

```sh
cp ~/.tmux.conf "~/.tmux.conf.$(date +%Y%m%d%H%M%S).bak"
```

Then remove the original (or use `stow --adopt`) so the symlink can be created.

## Secrets

Secrets are gitignored and must **never** be committed: `gh` tokens,
`~/.config/gh/hosts.yml`, `~/.ssh` keys, and `.env` files are all excluded by
`.gitignore` (SETUP-03). Scan before any first push.
