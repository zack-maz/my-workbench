#!/usr/bin/env bash
# Publish the package as a GitHub release asset on zack-maz/my-workbench.
#
# The package is private, so it never goes to the npm registry, and npm can't
# install a subdirectory of a GitHub repo (it fetches the whole-repo tarball
# and ignores `#path:`). A packed .tgz attached to a release is installable:
#
#   npm install -g https://github.com/zack-maz/my-workbench/releases/download/herdr-bobshell-v<version>/herdr-bobshell-connector-<version>.tgz
#
# Bump "version" in package.json and push first; this tags the pushed commit.
set -euo pipefail

cd "$(dirname "$0")/.."
repo=zack-maz/my-workbench
version=$(node -p 'require("./package.json").version')
tag="herdr-bobshell-v$version"

if [ -n "$(git status --porcelain -- .)" ]; then
  echo "uncommitted changes under $(pwd); commit and push first" >&2
  exit 1
fi
git fetch -q origin
if [ "$(git rev-parse HEAD)" != "$(git rev-parse @{u})" ]; then
  echo "HEAD is not what's pushed; push first" >&2
  exit 1
fi
if gh release view "$tag" --repo "$repo" >/dev/null 2>&1; then
  echo "$tag already exists; bump the version in package.json" >&2
  exit 1
fi

npm test
out=$(mktemp -d)
tgz="$out/$(npm pack --silent --pack-destination "$out")"

gh release create "$tag" "$tgz" --repo "$repo" --target "$(git rev-parse HEAD)" \
  --title "herdr-bobshell $version" \
  --notes "Install or update:

\`\`\`sh
npm install -g https://github.com/$repo/releases/download/$tag/$(basename "$tgz")
herdr-bobshell install
\`\`\`"
echo "released $tag"
