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
export LSCOLORS="Gxfxcxdxbxegedabagacad"   # BSD ls fallback (when eza isn't used)
export LESS="-R"

# TokyoNight-storm LS_COLORS — same hexes as the starship palette, as truecolor.
# Read by BOTH the completion list-colors zstyle below and eza. Directories use
# the same blue (#7aa2f7) as the prompt path, so listings and prompt agree.
export LS_COLORS="\
di=1;38;2;122;162;247:\
ln=38;2;115;218;202:mh=38;2;115;218;202:\
or=1;38;2;247;118;142:mi=1;38;2;247;118;142:\
ex=1;38;2;158;206;106:fi=38;2;200;211;245:\
pi=38;2;224;175;104:bd=38;2;224;175;104:cd=38;2;224;175;104:\
so=38;2;187;154;247:do=38;2;187;154;247:\
su=38;2;247;118;142:sg=38;2;247;118;142:ca=38;2;247;118;142:\
tw=1;38;2;122;162;247:ow=1;38;2;122;162;247:st=1;38;2;122;162;247:\
*.tar=38;2;255;158;100:*.tgz=38;2;255;158;100:*.zip=38;2;255;158;100:\
*.gz=38;2;255;158;100:*.bz2=38;2;255;158;100:*.xz=38;2;255;158;100:\
*.zst=38;2;255;158;100:*.7z=38;2;255;158;100:*.rar=38;2;255;158;100:\
*.dmg=38;2;255;158;100:*.pkg=38;2;255;158;100:\
*.png=38;2;187;154;247:*.jpg=38;2;187;154;247:*.jpeg=38;2;187;154;247:\
*.gif=38;2;187;154;247:*.svg=38;2;187;154;247:*.webp=38;2;187;154;247:\
*.heic=38;2;187;154;247:*.ico=38;2;187;154;247:\
*.mp4=38;2;187;154;247:*.mov=38;2;187;154;247:*.mkv=38;2;187;154;247:\
*.webm=38;2;187;154;247:*.mp3=38;2;187;154;247:*.wav=38;2;187;154;247:\
*.flac=38;2;187;154;247:*.m4a=38;2;187;154;247:\
*.pdf=38;2;224;175;104:*.md=38;2;224;175;104:*.mdx=38;2;224;175;104:\
*.txt=38;2;224;175;104:*.epub=38;2;224;175;104:*.docx=38;2;224;175;104:\
*.json=38;2;115;218;202:*.toml=38;2;115;218;202:*.yaml=38;2;115;218;202:\
*.yml=38;2;115;218;202:*.ini=38;2;115;218;202:*.conf=38;2;115;218;202:\
*.cfg=38;2;115;218;202:*.env=38;2;115;218;202:*.lock=38;2;115;218;202:\
*.log=38;2;65;72;104:*.bak=38;2;65;72;104:*.tmp=38;2;65;72;104:\
*.swp=38;2;65;72;104:*.o=38;2;65;72;104:*.pyc=38;2;65;72;104:\
*.DS_Store=38;2;65;72;104:*~=38;2;65;72;104"

# eza-only UI elements (perms, sizes, dates, git flags) — LS_COLORS above still
# drives the filenames themselves.
export EZA_COLORS="\
ur=38;2;224;175;104:uw=38;2;247;118;142:ux=38;2;158;206;106:ue=38;2;158;206;106:\
gr=38;2;224;175;104:gw=38;2;247;118;142:gx=38;2;158;206;106:\
tr=38;2;224;175;104:tw=38;2;247;118;142:tx=38;2;158;206;106:\
uu=38;2;122;136;184:un=38;2;65;72;104:gu=38;2;122;136;184:gn=38;2;65;72;104:\
sn=38;2;115;218;202:sb=38;2;122;136;184:df=38;2;187;154;247:ds=38;2;187;154;247:\
da=38;2;122;136;184:\
ga=38;2;158;206;106:gm=38;2;224;175;104:gd=38;2;247;118;142:\
gv=38;2;187;154;247:gt=38;2;115;218;202:\
xx=38;2;65;72;104"
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

# ── GitHub MCP (Claude Code's github plugin reads this var) ──────────────────
command -v gh >/dev/null && export GITHUB_PERSONAL_ACCESS_TOKEN="$(gh auth token 2>/dev/null)"
