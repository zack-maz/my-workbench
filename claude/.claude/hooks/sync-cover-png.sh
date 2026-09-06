#!/bin/bash
# Keep the nvim startup screenshot in step across three places:
#   A: my-workbench/images/cover.png   (the repo README embeds it)
#   B: BRAND/zack-maz/cover.png        (local working folder)
#   R: zack-maz/zack-maz on GitHub     (assets/cover.png + the profile README)
#
# A and B are mirrored newest-wins; whichever wins is pushed to R, and R's
# README is regenerated to point at it. Silent and cheap unless it changed.

A="/Users/zackmaz/Documents/PROJECTS/BRAND/setup/my-workbench/images/cover.png"
B="/Users/zackmaz/Documents/PROJECTS/BRAND/zack-maz/cover.png"
REPO="zack-maz/zack-maz"
RPATH="assets/cover.png"
WIDTH=600

# The A<->B mirror is bidirectional, so without this a truncated or half-written
# file is faithfully propagated over the good copy purely because it is newer.
is_png() {
  [ -f "$1" ] || return 1
  [ "$(wc -c < "$1" | tr -d ' ')" -ge 1024 ] || return 1
  [ "$(head -c 8 "$1" | od -An -tx1 | tr -d ' \n')" = "89504e470d0a1a0a" ]
}

# bash's -nt compares whole seconds, so two writes inside the same second tie
# and the loser wins arbitrarily. Compare with sub-second precision.
newer() {
  local m1 m2
  m1=$(stat -f '%Fm' "$1" 2>/dev/null) || return 1
  m2=$(stat -f '%Fm' "$2" 2>/dev/null) || return 1
  awk -v a="$m1" -v b="$m2" 'BEGIN { exit !(a > b) }'
}

ping_user() { osascript -e "display notification \"$1\" with title \"cover.png\"" >/dev/null 2>&1; }

# The ?v= is not decoration. GitHub serves README images through a caching
# proxy keyed on URL, so replacing the bytes at an unchanged path keeps
# serving the old image for a long time. Stamping the blob sha into the URL
# makes every new cover a new URL. The explicit width matters too: a bare
# markdown embed renders at the full column width and dominates the page.
readme_body() {
  printf '<p align="center">\n  <img src="%s?v=%s" width="%s" alt="off the grid">\n</p>\n' \
         "$RPATH" "${1:0:8}" "$WIDTH"
}

put_file() { # $1 = repo path, $2 = base64 content, $3 = commit message
  local remote_sha
  remote_sha=$(gh api "repos/$REPO/contents/$1" --jq .sha 2>/dev/null) || remote_sha=""
  jq -n --arg m "$3" --arg c "$2" --arg s "$remote_sha" \
     '{message:$m, content:$c} + (if $s == "" then {} else {sha:$s} end)' \
   | gh api --method PUT "repos/$REPO/contents/$1" --input - >/dev/null 2>&1
}

# Backgrounded by the caller: a 40KB upload would otherwise blow the hook
# timeout and stall whichever session triggered the write.
push_and_ping() {
  local blob remote_sha img_ok=1 readme_ok=1
  command -v gh >/dev/null 2>&1 || { ping_user "synced locally; gh not found"; return; }
  blob=$(git hash-object "$1" 2>/dev/null) || { ping_user "synced locally; could not hash"; return; }

  remote_sha=$(gh api "repos/$REPO/contents/$RPATH" --jq .sha 2>/dev/null) || remote_sha=""
  if [ "$blob" != "$remote_sha" ]; then
    put_file "$RPATH" "$(base64 -i "$1" | tr -d '\n')" "Sync cover.png from my-workbench" || img_ok=0
  fi

  # Regenerate the README whenever it does not already match this exact cover.
  local want cur
  want=$(readme_body "$blob")
  cur=$(gh api "repos/$REPO/contents/README.md" --jq .content 2>/dev/null | base64 -d 2>/dev/null)
  if [ "$want" != "$cur" ]; then
    put_file "README.md" "$(printf '%s' "$want" | base64 | tr -d '\n')" \
             "Regenerate profile README for the current cover" || readme_ok=0
  fi

  if [ "$img_ok" = 1 ] && [ "$readme_ok" = 1 ]; then
    ping_user "synced, pushed to $REPO, README regenerated"
  else
    ping_user "synced locally; GitHub update FAILED (image=$img_ok readme=$readme_ok)"
  fi
}

sync_to() {
  is_png "$1" || exit 0
  mkdir -p "$(dirname "$2")" 2>/dev/null || exit 0
  cp -p "$1" "$2" 2>/dev/null || exit 0
  ( push_and_ping "$1" & ) >/dev/null 2>&1
  printf '{"systemMessage":"Synced cover.png -> %s (pushing to %s)"}\n' "$2" "$REPO"
  exit 0
}

if [ -e "$A" ] && [ -e "$B" ]; then
  if cmp -s "$A" "$B"; then exit 0; fi
  if newer "$A" "$B"; then sync_to "$A" "$B"; else sync_to "$B" "$A"; fi
elif [ -e "$A" ]; then
  sync_to "$A" "$B"
elif [ -e "$B" ]; then
  sync_to "$B" "$A"
fi
exit 0
