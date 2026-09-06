# Documentation

Nine documents. Which one you want depends on why you're here.

## Start here

**[architecture.md](architecture.md)** — why the setup is shaped this way: the
session that outlives the window, Caps Lock as a prefix, why navigation crosses
the herdr/Neovim boundary, and the assumption that an agent is writing the
files. Read this first; everything else is detail hanging off it.

## Using it

| | |
|---|---|
| **[neovim.md](neovim.md)** | Beginner's guide to the editor. Modes, the leader key, finding files, LSP, and which four plugins are this setup's rather than LazyVim's. |
| **[yazi.md](yazi.md)** | Beginner's guide to the file manager. The three-column model, selection across directories, and the four different ways to find things. |
| **[keybindings.md](keybindings.md)** | The full keymap in one place — herdr, Neovim, yazi, Ghostty. Reference, not tutorial. |
| **[claude-code.md](claude-code.md)** | Claude Code inside herdr. Why its subagents and background shells show up as tabs, how the hooks do it, and the rule that gives heavyweight subtasks a real agent in a real tab. |
| **[cover-sync.md](cover-sync.md)** | The hook that keeps `images/cover.png` in step across this repo, a local folder, and the GitHub profile — including why it guards against propagating a broken file, and why the profile README carries a `?v=` on the image URL. |

If Neovim and yazi are new to you, read those two guides before the keymap —
the keymap assumes you know what the tools are for.

## Setting it up

| | |
|---|---|
| **[install.md](install.md)** | Fresh machine, start to finish. Verification steps and how to back each piece out. |
| **[stow.md](stow.md)** | How the symlink layout works, how to add a package, and the failure mode that silently does nothing. |

## Changing it

| | |
|---|---|
| **[theming.md](theming.md)** | The palette, every place each tool restates it, and the order to change them so nothing ends up inconsistent. |

## Reading paths

**"I want to try this setup."**
[install.md](install.md) → [keybindings.md](keybindings.md) → the two guides as needed.

**"I want to understand it."**
[architecture.md](architecture.md) → [claude-code.md](claude-code.md) → [theming.md](theming.md) → [stow.md](stow.md).

**"I want to steal one piece."**
[architecture.md](architecture.md) for the mechanism, then the config it links to.
The [README](../README.md#details-worth-stealing) lists the parts most worth taking.

## assets/

[`assets/demo.tape`](assets/demo.tape) is a [vhs](https://github.com/charmbracelet/vhs)
script for a terminal demo GIF. **Parked** — a first render captured stock
defaults because vhs does not source `~/.zshrc`. The fix is in the tape; it has
not been re-rendered or reviewed, and no GIF is committed.
