# How Stow is used here

[GNU Stow](https://www.gnu.org/software/stow/) is a symlink manager. Everything
in this repo follows one rule, and if you understand it you can add a package
without reading anything else.

## The rule

**Each top-level directory is a package. Its inner tree is the path the config
occupies under `$HOME`.**

```
repo                                    →   home
────────────────────────────────────────    ─────────────────────────────
ghostty/.config/ghostty/config          →   ~/.config/ghostty/config
starship/.config/starship.toml          →   ~/.config/starship.toml
zsh/.zshrc                              →   ~/.zshrc
keymap/Library/LaunchAgents/…plist      →   ~/Library/LaunchAgents/…plist
```

The package name (`ghostty`, `zsh`) is only a label — it is stripped off. Stow
recreates everything *below* it relative to the target directory, which defaults
to the parent of the repo (`~/dotfiles` → `~`).

So `zsh/.zshrc` lands at `~/.zshrc`, not `~/zsh/.zshrc`. The extra `.config/`
levels inside most packages exist because that's where those tools actually
read from.

## What stowing produces

```sh
stow ghostty
```

```
~/.config/ghostty/config -> ../../dotfiles/ghostty/.config/ghostty/config
```

A **relative** symlink. Nothing is copied. Editing `~/.config/ghostty/config`
edits the file in the repo, so `git status` is the only place you need to look
to know what you've changed. There is no sync step and no way for the two to
drift apart.

Relative links also mean the repo can be moved as long as the symlinks are
rebuilt (`stow -D`, move, `stow`) — but moving it *without* re-stowing breaks
every link at once.

## Adding a package

Say you want to manage `~/.config/bat/config`.

```sh
cd ~/dotfiles
mkdir -p bat/.config/bat                                    # mirror the path
cp ~/.config/bat/config "$HOME/.config/bat/config.bak"      # keep an escape hatch
mv ~/.config/bat/config bat/.config/bat/config              # move the real file in
stow bat                                                    # link it back
```

Move, don't copy. If a real file stays at the target path, Stow refuses to
overwrite it and **silently skips** — you end up editing a repo file that
nothing reads, and the config appears not to work. That failure is quiet and
confusing, which is why the backup-then-move order is worth following every
time.

Verify:

```sh
readlink ~/.config/bat/config     # should point into ../../dotfiles/bat/...
```

Then add the package to the `stow` line in [install.md](install.md) and the
README so a fresh machine picks it up.

## Removing

```sh
stow -D nvim      # unlink one package; files stay in the repo
```

```sh
stow -D ghostty herdr nvim yazi zsh starship atuin git karabiner
```

Unstowing removes symlinks only. Nothing in the repo is deleted, and any `.bak`
files you left behind can be moved back into place.

## Dry runs

```sh
stow -n -v bat    # show what would happen, change nothing
```

Worth doing before stowing a package you just built. On an already-correct
setup it prints nothing, which makes it a decent health check.

## What never gets stowed

`.stow-local-ignore` lists repo metadata that must not be symlinked into `$HOME`:

```
\.git
\.gitignore
\.stow-local-ignore
README.md
Brewfile
```

Patterns are regexes matched against basenames, so `\.git` needs the escaped
dot and does not match the `git/` **package** — which is why a package named
`git` can coexist with the ignore entry for `.git`.

`docs/` is not listed because it isn't a package: Stow only ever looks inside
the package directories named on the command line, and `docs` is never one of
them.

## Gotchas

**Folding.** If a target directory doesn't exist, Stow may symlink the whole
directory rather than its contents. Later, a second package wanting to write
into that directory forces Stow to "unfold" it. This is normal and handled
automatically, but it's why `~/.config/ghostty` is sometimes a symlinked
directory and sometimes a real directory of symlinked files.

**Target directory.** Stow assumes the target is the parent of the repo. This
repo lives at `~/dotfiles`, so the target is `~` and everything works with no
flags. From anywhere else you need `stow -t ~`.

**Runtime artifacts.** Tools write state next to their config. herdr drops
`*.log`, `session.json`, `plugins.json` and `release-notes.json` into
`~/.config/herdr/` — which is the repo. These are gitignored; only
`config.toml` is tracked. Check `git status` after a tool update, because new
artifact filenames show up as untracked and need adding to `.gitignore`.
