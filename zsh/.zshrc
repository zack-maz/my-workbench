# ~/.zshrc — Stow-owned (real file in ~/dotfiles/zsh).
# Interactive zsh: prompt (starship), history, completion, colors, plugins.

# ── PATH (Homebrew on Apple Silicon) ─────────────────────────────────────────
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"

# ── History ──────────────────────────────────────────────────────────────────
HISTFILE="$HOME/.zsh_history"
HISTSIZE=50000
SAVEHIST=50000
setopt SHARE_HISTORY          # share history across all sessions/panes (great with herdr)
setopt HIST_IGNORE_ALL_DUPS   # drop older duplicate commands
setopt HIST_IGNORE_SPACE      # commands starting with a space aren't recorded
setopt HIST_VERIFY            # show a history-expansion result before running it
setopt INC_APPEND_HISTORY

# ── Directory nav quality-of-life ────────────────────────────────────────────
setopt AUTO_CD               # type a dir name to cd into it
setopt AUTO_PUSHD            # cd pushes onto the dir stack
setopt PUSHD_IGNORE_DUPS

# ── Colors ───────────────────────────────────────────────────────────────────
export CLICOLOR=1                     # colored BSD ls
export LSCOLORS="Gxfxcxdxbxegedabagacad"
export LESS="-R"                      # keep color in pagers

# ── Completion ───────────────────────────────────────────────────────────────
autoload -Uz compinit && compinit -C
zstyle ':completion:*' menu select
zstyle ':completion:*' matcher-list 'm:{a-zA-Z}={A-Za-z}'   # case-insensitive
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"

# ── Aliases ──────────────────────────────────────────────────────────────────
alias ls='ls -G'
alias ll='ls -lhG'
alias la='ls -lhAG'
alias ..='cd ..'
alias ...='cd ../..'
alias gs='git status'
alias gl='git log --oneline --graph --decorate -20'
alias vim='nvim'
alias v='nvim'

# ── Plugins (order matters: syntax-highlighting must be sourced LAST) ─────────
BREW_SHARE="$(brew --prefix 2>/dev/null)/share"
[ -f "$BREW_SHARE/zsh-autosuggestions/zsh-autosuggestions.zsh" ] \
  && source "$BREW_SHARE/zsh-autosuggestions/zsh-autosuggestions.zsh"
ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE='fg=#4a4a4a'   # Vesper dim gray, subtle

# ── Prompt: starship (Catppuccin Macchiato config in ~/.config/starship.toml) ─
eval "$(starship init zsh)"

# Syntax highlighting LAST so it wraps everything above.
[ -f "$BREW_SHARE/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh" ] \
  && source "$BREW_SHARE/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh"
