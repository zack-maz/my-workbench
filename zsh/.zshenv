# PATH for every zsh, including non-interactive `ssh mini <cmd>` and herdr --remote.
# (.zprofile/.zshrc are skipped in that mode.)
[ -x /opt/homebrew/bin/brew ] && eval "$(/opt/homebrew/bin/brew shellenv)"
case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) export PATH="$HOME/.local/bin:$PATH" ;; esac
