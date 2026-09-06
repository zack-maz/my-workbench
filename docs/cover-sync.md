# The cover sync rule

`images/cover.png` is the Neovim startup screen — the Zima portrait this repo's
README opens with. The same image is also the cover of the GitHub profile at
[zack-maz/zack-maz](https://github.com/zack-maz/zack-maz). Keeping one image
correct in three places by hand is the kind of chore that silently rots, so a
Claude Code hook does it.

## What it keeps in step

| | |
|---|---|
| **A** | `my-workbench/images/cover.png` — embedded by this repo's README |
| **B** | `BRAND/zack-maz/cover.png` — the local working folder |
| **R** | `zack-maz/zack-maz` on GitHub — `assets/cover.png`, plus its README |

A and B are mirrored locally. Whichever of them wins is then pushed to R, and
R's README is rewritten to point at it.

## When it runs

It is a `PostToolUse` hook on `Bash|Write|Edit|MultiEdit` in
`~/.claude/settings.json`, so it fires after any tool call in any Claude Code
session — not just one working in this repo. That breadth is deliberate: the
image is usually produced by a shell command (`magick`, `cp`), not by an editor
write, so a hook watching only `Write|Edit` would never see it.

Nearly every run is a no-op. The first thing it does is `cmp` the two local
copies; if they match it exits without touching anything.

## The mirror, and why it is guarded

A and B sync **newest wins**, in either direction. That is what makes it
convenient — you can drop a new cover in either place — and it is also the
dangerous part, so two guards exist.

**Only a real PNG may win.** Without this, a truncated or half-written file is
faithfully propagated over the good copy purely because it is newer. This is
not hypothetical: it happened during development, and a 9-byte text stub
overwrote the real image in the repo. The guard checks the PNG magic bytes and
a plausible minimum size before any copy.

**Timestamps compare with sub-second precision.** Bash's `-nt` operator
compares whole seconds, so two writes inside the same second tie, and on a tie
the wrong file wins arbitrarily. The rule compares `stat -f '%Fm'` instead.
Files 12 milliseconds apart were being resolved backwards before this.

Note what the guards do *not* do: a *valid* wrong image still propagates. If
you overwrite either copy with a real PNG you did not mean to publish, the rule
will dutifully push it. If you want that closed, make the repo authoritative
and B a pure mirror — a two-line change in the script.

## The push, and the `?v=` in the README

When the image changes, the rule pushes it to `assets/cover.png` on the profile
repo through the GitHub API, then regenerates that repo's README:

```html
<p align="center">
  <img src="assets/cover.png?v=6a5ba3cf" width="600" alt="off the grid">
</p>
```

Both details are load-bearing.

**The `?v=` is the blob SHA of the current image.** GitHub serves README images
through a caching proxy keyed on URL. Replace the bytes at an unchanged path
and the old image keeps being served — the push succeeds, the repo is correct,
and the page still shows the previous cover. Stamping the SHA into the URL
makes every new cover a new URL, so the cache has nothing to serve.

**The explicit `width` is not cosmetic.** A bare markdown embed renders at the
full column width. The cover is 1400×934, so at a profile column of ~880px it
would occupy about 590px of vertical space; earlier, when the image was
portrait, it took over a thousand. The width attribute is the only control over
how much of the page it eats.

The push runs in the background. A 40KB upload takes longer than the hook's
timeout, and a hook that blocks stalls whichever session tripped it.

## Being told it happened

Because any session can trigger a sync, the in-transcript message may land in a
window you are not looking at. So the rule also sends a macOS notification
saying whether the local mirror, the push, and the README regeneration each
succeeded.

## Where it lives

| | |
|---|---|
| Script | `claude/.claude/hooks/sync-cover-png.sh` (stow package, symlinked to `~/.claude/hooks/`) |
| Wiring | `~/.claude/settings.json`, under `hooks.PostToolUse` |

`~/.claude/settings.json` is **not** in this repo — it holds machine-local and
unrelated configuration. On a fresh machine the script arrives with `stow
claude`, but the `PostToolUse` entry has to be added by hand, and the three
paths at the top of the script are absolute and will need editing.

## Turning it off

Delete the `sync-cover-png.sh` entry from `hooks.PostToolUse`, or run `/hooks`
in Claude Code to disable it interactively. The script is inert on its own.

## Related

`images/cover-full.png` is the uncropped capture the cover is cropped from. It
is kept because the crop is not reversible, and it is deliberately *not* part
of the sync — only `cover.png` is.
