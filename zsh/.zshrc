# ~/.zshrc — Stow-owned (real file in ~/dotfiles/zsh).
# Pimped interactive shell: eza, bat, fzf, zoxide, starship prompt, plugins.

# ── PATH ─────────────────────────────────────────────────────────────────────
eval "$(/opt/homebrew/bin/brew shellenv)"
export PATH="$HOME/.local/bin:$PATH"

# ── History ──────────────────────────────────────────────────────────────────
HISTFILE="$HOME/.zsh_history"
HISTSIZE=50000
SAVEHIST=50000
setopt SHARE_HISTORY HIST_IGNORE_ALL_DUPS HIST_IGNORE_SPACE HIST_VERIFY INC_APPEND_HISTORY

# ── Directory nav ────────────────────────────────────────────────────────────
setopt AUTO_CD AUTO_PUSHD PUSHD_IGNORE_DUPS

# ── Colors ───────────────────────────────────────────────────────────────────
export CLICOLOR=1
export LSCOLORS="Gxfxcxdxbxegedabagacad"
export LESS="-R"
# Colorful, syntax-highlighted man pages via bat.
export MANPAGER="sh -c 'col -bx | bat -l man -p'"
export MANROFFOPT="-c"

# ── Completion ───────────────────────────────────────────────────────────────
autoload -Uz compinit && compinit -C
zstyle ':completion:*' menu select
zstyle ':completion:*' matcher-list 'm:{a-zA-Z}={A-Za-z}'   # case-insensitive
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"

# ── fzf (fuzzy finder) — MUST precede zoxide ─────────────────────────────────
if command -v fzf >/dev/null; then
  eval "$(fzf --zsh)"
  export FZF_DEFAULT_COMMAND='fd --type f --hidden --follow --exclude .git'
  export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
  # TokyoNight-ish fzf colors on a black background.
  export FZF_DEFAULT_OPTS="--height 40% --layout=reverse --border \
    --color=bg+:#1a1b26,bg:#0a0a0a,spinner:#bb9af7,hl:#7aa2f7 \
    --color=fg:#c0caf5,header:#7aa2f7,info:#e0af68,pointer:#bb9af7 \
    --color=marker:#9ece6a,fg+:#c0caf5,prompt:#bb9af7,hl+:#7dcfff"
fi

# ── zoxide (smart cd) — MUST follow fzf ──────────────────────────────────────
command -v zoxide >/dev/null && eval "$(zoxide init zsh)"

# ── Aliases: modern, colorful replacements ───────────────────────────────────
if command -v eza >/dev/null; then
  alias ls='eza --icons --group-directories-first'
  alias ll='eza -la --git --icons --group-directories-first --time-style=relative'
  alias la='eza -la --icons --group-directories-first'
  alias lt='eza --tree --icons --level=2 --group-directories-first'
  alias l='eza -l --git --icons --group-directories-first'
fi
command -v bat >/dev/null && alias cat='bat --paging=never'
alias ..='cd ..'
alias ...='cd ../..'
alias gs='git status'
alias gl='git log --oneline --graph --decorate -20'
alias lg='lazygit'
alias vim='nvim'
alias v='nvim'

# ── zsh plugins (autosuggestions, then syntax-highlighting LAST) ─────────────
BREW_SHARE="$(brew --prefix)/share"
[ -f "$BREW_SHARE/zsh-autosuggestions/zsh-autosuggestions.zsh" ] \
  && source "$BREW_SHARE/zsh-autosuggestions/zsh-autosuggestions.zsh"
ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE='fg=#414868'   # subtle dim

# ── Prompt: starship (config in ~/.config/starship.toml) ─────────────────────
eval "$(starship init zsh)"

# Syntax highlighting LAST so it wraps every widget above.
[ -f "$BREW_SHARE/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh" ] \
  && source "$BREW_SHARE/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh"
