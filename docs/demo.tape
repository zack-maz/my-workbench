# docs/demo.tape — PARKED, not yet producing a shippable GIF.
#
#   vhs docs/demo.tape
#
# KNOWN ISSUE, already diagnosed: VHS starts zsh with its own minimal prompt and
# does NOT source ~/.zshrc. A first render silently captured stock eza colors and
# a bare `>` prompt instead of starship — it looked plausible and was wrong.
# The `source ~/.zshrc` line below is the fix; the rest still needs a look.
#
# Palette is lifted from the config it documents: background/foreground are the
# values Ghostty sets (#0a0a0a / #c8d3f5), ANSI ramp is TokyoNight Night — the
# same hexes LS_COLORS, EZA_COLORS and the starship palette derive from.

Output docs/demo.gif

Set Shell "zsh"
Set FontFamily "JetBrainsMono Nerd Font"
Set FontSize 15
Set Width 1360
Set Height 800
Set Padding 26
Set TypingSpeed 55ms
Set Theme { "background": "#0a0a0a", "foreground": "#c8d3f5", "cursor": "#c8d3f5", "selection": "#2d3f76", "black": "#15161e", "red": "#f7768e", "green": "#9ece6a", "yellow": "#e0af68", "blue": "#7aa2f7", "magenta": "#bb9af7", "cyan": "#7dcfff", "white": "#a9b1d6", "brightBlack": "#414868", "brightRed": "#f7768e", "brightGreen": "#9ece6a", "brightYellow": "#e0af68", "brightBlue": "#7aa2f7", "brightMagenta": "#bb9af7", "brightCyan": "#7dcfff", "brightWhite": "#c0caf5" }

Hide
Type "source ~/.zshrc >/dev/null 2>&1; cd ~/dotfiles; clear"
Enter
Sleep 2s
Show

Sleep 2500ms
Type "eza -la --icons --git --group-directories-first"
Sleep 400ms
Enter
Sleep 3500ms
Type "clear && bat --style=numbers --paging=never --line-range=1:20 Brewfile"
Sleep 400ms
Enter
Sleep 4s
Type "clear && yazi"
Sleep 400ms
Enter
Sleep 2500ms
Down
Sleep 600ms
Down
Sleep 1200ms
Right
Sleep 1800ms
Down
Sleep 1800ms
Type "q"
Sleep 1200ms
