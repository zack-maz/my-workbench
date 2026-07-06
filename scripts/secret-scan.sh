#!/usr/bin/env bash
#
# secret-scan.sh — blocking secret-hygiene gate for the ~/dotfiles repo (SETUP-03).
#
# Two checks, both fail CLOSED (non-zero exit on ANY finding):
#   (a) PATH check   — no git-tracked file may match a sensitive path shape
#                      (gh auth/host config, SSH material, tokens, env files).
#   (b) CONTENT check — no tracked file body may contain a token-shaped string
#                      (GitHub token prefixes, AWS access keys, PEM private-key blocks).
#
# Run this AFTER staging (`git add -A`) and BEFORE the first commit/push. A finding
# OR any scan error must be treated as a hard STOP — never as a pass.
#
# Design note: every token pattern below is stored as *data* the scanner reads (array
# elements / variables), never embedded as a literal example credential value in a
# comment, so the gate can never flag or leak against itself (T-01-07).

set -euo pipefail

# Operate on the repo this script lives in, regardless of caller cwd.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
cd "$REPO_ROOT"

fail=0

# ── (a) Sensitive-path patterns (POSIX ERE, matched against tracked file paths) ──
path_patterns=(
  'hosts\.yml'
  '(^|/)gh/'
  '(^|/)\.ssh/'
  '(^|/)id_rsa'
  '(^|/)id_ed25519'
  '\.pem$'
  '\.key$'
  '(^|/)\.env(\.|$)'
  '\.token$'
  'credentials'
)

# Files git currently tracks (index + committed). If nothing is tracked yet, this is empty.
# Read into an array without `mapfile`/`readarray` so this runs on macOS's bash 3.2.
tracked=()
while IFS= read -r _f; do
  tracked+=("$_f")
done < <(git ls-files)

# Guard the array expansion: under bash 3.2 with `set -u`, "${arr[@]}" on an empty
# array raises "unbound variable". Only iterate when there is at least one tracked file.
if [ "${#tracked[@]}" -gt 0 ]; then
  for f in "${tracked[@]}"; do
    for pat in "${path_patterns[@]}"; do
      if printf '%s\n' "$f" | grep -Eiq -- "$pat"; then
        echo "SECRET-SCAN: sensitive path matched ('$pat'): $f" >&2
        fail=1
      fi
    done
  done
fi

# ── (b) Token-shaped content patterns (POSIX ERE, matched against tracked file bodies) ──
content_patterns=(
  'gh[opsu]_[A-Za-z0-9]{20,}'          # GitHub token prefixes (gho_/ghp_/ghs_/ghu_)
  'AKIA[0-9A-Z]{12,}'                  # AWS access key IDs
  'BEGIN [A-Z ]*PRIVATE KEY'           # PEM private-key blocks
)

if [ "${#tracked[@]}" -gt 0 ]; then
  for pat in "${content_patterns[@]}"; do
    # -I skips binary files; scan only tracked files.
    if git grep -I -nE -- "$pat" -- "${tracked[@]}" >/dev/null 2>&1; then
      echo "SECRET-SCAN: token-shaped content matched pattern: $pat" >&2
      git grep -I -nE -- "$pat" -- "${tracked[@]}" >&2 || true
      fail=1
    fi
  done
fi

if [ "$fail" -ne 0 ]; then
  echo "SECRET-SCAN: FAILED — do NOT commit. Remove/ignore the offending file(s) and re-run." >&2
  exit 1
fi

echo "SECRET-SCAN: clean — no sensitive paths or token-shaped content in the tracked tree."
exit 0
