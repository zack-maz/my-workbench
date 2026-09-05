# Install

macOS on Apple Silicon. Assumes [Homebrew](https://brew.sh) is present.

## Fresh machine

```sh
git clone https://github.com/zack-maz/my-workbench.git ~/dotfiles
cd ~/dotfiles
```

### 1. Tools

```sh
brew bundle --file=Brewfile
```

This installs the terminal, multiplexer, editor, file manager, shell tooling and
— easy to miss — yazi's preview backends. Without `chafa`, `poppler`, `resvg`,
`ffmpegthumbnailer`, `exiftool` and `sevenzip`, yazi runs fine but shows a
filename where a preview should be, with no error explaining why.

### 2. Symlink the configs

```sh
stow ghostty herdr nvim yazi zsh starship atuin git karabiner
```

Run from the repo root. See [stow.md](stow.md) for what this does and how to
back out.

> **Stow will not overwrite an existing regular file.** It skips silently, the
> old file keeps winning, and the new config looks like it "didn't apply." If a
> real file already sits at a target path, back it up and remove it first:
>
> ```sh
> cp ~/.zshrc "~/.zshrc.$(date +%Y%m%d%H%M%S).bak" && rm ~/.zshrc
> ```
>
> Or hand the file to Stow with `stow --adopt <package>`, which moves the
> existing file into the repo and symlinks it back — then check `git diff` to
> see what it just absorbed.

### 3. Caps Lock → F18

```sh
cp keymap/Library/LaunchAgents/com.zackmaz.capslock-f18.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.zackmaz.capslock-f18.plist
```

Applies immediately and on every login. Verify by pressing Caps Lock — it should
do nothing at all, including not toggling the Caps Lock light.

If you already run Karabiner-Elements, use `stow karabiner` **instead of** this
launch agent, not in addition to it.

To undo:

```sh
launchctl unload ~/Library/LaunchAgents/com.zackmaz.capslock-f18.plist
rm ~/Library/LaunchAgents/com.zackmaz.capslock-f18.plist
hidutil property --set '{"UserKeyMapping":[]}'
```

### 4. herdr ↔ nvim navigation

```sh
herdr plugin install lmilojevicc/herdr-splits.nvim --yes
```

The matching Neovim side is already in
[`nvim/.config/nvim/lua/plugins/herdr-splits.lua`](../nvim/.config/nvim/lua/plugins/herdr-splits.lua)
and loads itself only inside a herdr pane. Both halves must be present —
installing one without the other gives you `Ctrl-hjkl` that works in one
direction and stops at the boundary.

### 5. Open Ghostty

It launches straight into herdr. Neovim installs its plugins on first run.

## Verify

```sh
stow -n -v ghostty herdr nvim yazi zsh starship atuin git   # dry run, expect no output
herdr config check                                          # config.toml parses
readlink ~/.config/ghostty/config                           # -> ../../dotfiles/...
```

A working setup: Caps Lock does nothing on its own, `Caps` `v` splits a pane,
`Caps` `g` opens lazygit in a popup, `Ctrl-l` crosses from Neovim into the pane
to its right, and the prompt shows a tiered path with a right-aligned clock.

## Fonts

`font-jetbrains-mono-nerd-font` is in the Brewfile and is not optional. Ghostty,
starship, yazi and Neovim all use Nerd Font glyphs for icons and powerline
separators; without it the prompt renders as boxes and question marks.

## After changing a config

Because Stow symlinks rather than copies, editing `~/.config/ghostty/config`
edits the file in this repo. There is no sync step — `git status` in `~/dotfiles`
shows what you changed.

Reload without restarting:

| Change | Reload |
|---|---|
| Ghostty | `Cmd+Shift+,` |
| herdr | `Caps` `Shift+r`, or `herdr server reload-config` |
| zsh / starship | `source ~/.zshrc` |
| Neovim | restart, or `:Lazy reload <plugin>` |
