# Theming

One palette, defined once per tool, kept numerically identical. The goal is that
a blue directory in `ls` is the *same* blue as the directory in the prompt,
because both are literally `#7aa2f7`.

## The palette

TokyoNight over a near-black base. Canonical definition lives in
[`starship.toml`](../starship/.config/starship.toml) under
`[palettes.tokyonight_storm]`; every other tool restates these values in its own
syntax.

| Role | Hex | Where it shows up |
|---|---|---|
| base | `#0a0a0a` | terminal + editor background |
| text | `#c8d3f5` | default foreground |
| sky | `#7aa2f7` | directories, prompt path |
| mauve | `#bb9af7` | git branch, repo root, media files |
| red | `#f7768e` | git status, broken symlinks, write bits |
| green | `#9ece6a` | executables, success prompt, python |
| yellow | `#e0af68` | documents, device files, node |
| teal | `#73daca` | symlinks, config/data files |
| peach | `#ff9e64` | archives |
| overlay1 | `#7a88b8` | command duration, clock |
| overlay0 | `#414868` | dim — logs, backups, autosuggestions |

Three near-black grays separate the prompt's segments without introducing a hue:

| Token | Hex | Use |
|---|---|---|
| surface0 | `#141414` | island 1 — OS icon + directory |
| surface1 | `#1c1c1c` | island 2 — git branch + status |
| surface2 | `#242424` | island 3 — language versions |

This is the reason the prompt reads as *black* rather than the purple-gray most
Catppuccin/TokyoNight prompts land on: the islands are grayscale, and all the
color comes from the text sitting on them.

## Where each tool gets it

| Tool | File | Mechanism |
|---|---|---|
| Ghostty | [`ghostty/…/config`](../ghostty/.config/ghostty/config) | `theme = TokyoNight Night`, then `background`/`foreground` overridden |
| starship | [`starship.toml`](../starship/.config/starship.toml) | `[palettes.tokyonight_storm]` |
| zsh | [`.zshrc`](../zsh/.zshrc) | `LS_COLORS` + `EZA_COLORS` as truecolor escapes |
| Neovim | [`colorscheme.lua`](../nvim/.config/nvim/lua/plugins/colorscheme.lua) | `tokyonight-night` + `on_colors` background override |
| yazi | [`theme.toml`](../yazi/.config/yazi/theme.toml) | `tokyo-night` flavor |
| herdr | [`config.toml`](../herdr/.config/herdr/config.toml) | `vesper` theme |

Two notes on that table.

**Ghostty and Neovim both start from a stock TokyoNight and then override only
the backgrounds.** The upstream `bg` is `#1a1b26`, a blue-tinted charcoal. These
force `#0a0a0a` (and `#000000` for `bg_dark`) while leaving every syntax color
untouched — a black background with an unmodified vivid palette on top:

```lua
on_colors = function(c)
  c.bg = "#0a0a0a"
  c.bg_dark = "#000000"
  c.bg_float = "#0a0a0a"
  c.bg_sidebar = "#0a0a0a"
  c.bg_statusline = "#0a0a0a"
end,
```

**herdr is the deliberate exception.** Its chrome uses `vesper` rather than
TokyoNight, chosen because it is near-black and stays out of the way — herdr
draws frames *around* other programs, so its own palette should recede while the
content keeps the TokyoNight colors.

## LS_COLORS is generated from the palette, not picked separately

The longest block in [`.zshrc`](../zsh/.zshrc) is `LS_COLORS`, written as
truecolor SGR escapes using the same hexes as the table above. `#7aa2f7` becomes
`38;2;122;162;247`.

```sh
export LS_COLORS="\
di=1;38;2;122;162;247:\      # directories  -> sky, the prompt path color
ln=38;2;115;218;202:\        # symlinks     -> teal
ex=1;38;2;158;206;106:\      # executables  -> green
…
```

Three consumers read that single variable:

- **eza**, for filenames
- **zsh's completion menu**, via `zstyle ':completion:*' list-colors ${(s.:.)LS_COLORS}`
- **`ls`**, when eza isn't in play

`EZA_COLORS` is separate because it colors things `LS_COLORS` has no concept of —
permission bits, file sizes, dates, git status flags. Same hexes.

Files are grouped by *kind*, not extension: archives are peach, media is mauve,
documents are yellow, config/data is teal, and throwaway files (`*.log`, `*.bak`,
`*.tmp`, `*.pyc`, `.DS_Store`) are `overlay0` so they visually recede.

## The three-tier prompt path

Inside a git repo the directory renders in three colors:

```
  …/Documents/  PROJECTS  /BRAND/setup
  └ overlay0    └ mauve    └ sky
    ancestors     repo root  subpath
```

```toml
before_repo_root_style = "fg:overlay0 bg:surface0"
repo_root_style        = "bold fg:mauve bg:surface0"
repo_root_format = "[ $before_root_path]($before_repo_root_style)[$repo_root]($repo_root_style)[$path ]($style)"
```

The repo name is bold mauve — the same color as the git branch one island over —
so the two facts that answer "where am I?" share a color. Ancestors dim rather
than truncate away, so the full path stays readable without dominating.

## Ghostty's extras

```
background-opacity = 0.92
background-blur-radius = 24
window-colorspace = display-p3
bold-is-bright = true
font-thicken = true
```

Translucency plus blur puts the desktop faintly behind the terminal without
hurting contrast at 0.92. `display-p3` matters: the TokyoNight palette has
saturated blues and purples that clip in sRGB, and wide gamut renders them
noticeably more vivid on a modern display.

## Changing the palette

Editing a color in one place produces an inconsistent terminal. To change it
everywhere:

1. `[palettes.tokyonight_storm]` in `starship.toml` — the canonical list
2. `LS_COLORS` and `EZA_COLORS` in `.zshrc` — convert hex to `38;2;R;G;B`
3. `theme` / `background` / `foreground` in Ghostty's `config`
4. `on_colors` in `colorscheme.lua`
5. `[flavor]` in yazi's `theme.toml`
6. `[theme]` in herdr's `config.toml`
7. `Set Theme` in [`assets/demo.tape`](assets/demo.tape), so the demo keeps matching

Steps 1 and 2 are the ones that must agree exactly — they're the pair a reader
notices when it's wrong.
