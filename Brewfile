# Brewfile — everything this workbench needs.
#
#   brew bundle --file=Brewfile
#
# Not stowed: this file is repo metadata, not config (see .stow-local-ignore).

# ── The core loop ────────────────────────────────────────────────────────────
cask "ghostty"                    # GPU terminal, the only GUI app in the loop
brew "herdr"                      # agent multiplexer — replaces tmux
brew "neovim"                     # editor (LazyVim distribution)
brew "yazi"                       # file manager
brew "stow"                       # symlinks this repo into $HOME

# ── Shell ────────────────────────────────────────────────────────────────────
brew "starship"                   # prompt
brew "atuin"                      # searchable, synced shell history
brew "zoxide"                     # frecency-ranked cd
brew "fzf"                        # fuzzy finder (powers zoxide + yazi pickers)
brew "zsh-autosuggestions"
brew "zsh-syntax-highlighting"

# ── Coreutils, upgraded ──────────────────────────────────────────────────────
brew "eza"                        # ls
brew "bat"                        # cat + man pager
brew "fd"                         # find
brew "ripgrep"                    # grep
brew "jq"                         # json

# ── Git ──────────────────────────────────────────────────────────────────────
brew "git"
brew "lazygit"                    # bound to Caps+g as a herdr popup
brew "gh"
brew "gitleaks"                   # scripts/secret-scan.sh runs this pre-push

# ── yazi preview backends ────────────────────────────────────────────────────
# Without these, yazi shows a filename where a preview should be.
brew "chafa"                      # images -> terminal graphics
brew "imagemagick"                # image decode
brew "poppler"                    # pdf
brew "resvg"                      # svg
brew "ffmpeg"                     # video
brew "ffmpegthumbnailer"          # video thumbnails
brew "exiftool"                   # media metadata
brew "sevenzip"                   # archive contents

# ── Fonts ────────────────────────────────────────────────────────────────────
cask "font-jetbrains-mono-nerd-font"   # Ghostty font + every icon glyph

# ── Docs ─────────────────────────────────────────────────────────────────────
brew "node"                       # required by markdown-preview.nvim
brew "vhs"                        # regenerates docs/demo.gif from docs/demo.tape
