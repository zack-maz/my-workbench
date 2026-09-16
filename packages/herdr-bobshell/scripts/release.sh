#!/usr/bin/env bash
# Release the package: tag the pushed commit and let GitHub Actions publish it.
#
# Pushing a herdr-bobshell-v<version> tag runs
# .github/workflows/publish-herdr-bobshell.yml, which tests the package,
# publishes @zack-maz/herdr-bobshell-connector to npm (via npm trusted
# publishing, so no token is stored anywhere) and creates the matching
# GitHub release.
#
# Bump "version" in package.json and push first; this tags the pushed commit.
set -euo pipefail

cd "$(dirname "$0")/.."
name=$(node -p 'require("./package.json").name')
version=$(node -p 'require("./package.json").version')
tag="herdr-bobshell-v$version"

if [ -n "$(git status --porcelain -- .)" ]; then
  echo "uncommitted changes under $(pwd); commit and push first" >&2
  exit 1
fi
git fetch -q --tags origin
if [ "$(git rev-parse HEAD)" != "$(git rev-parse @{u})" ]; then
  echo "HEAD is not what's pushed; push first" >&2
  exit 1
fi
if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
  echo "$tag already exists; bump the version in package.json" >&2
  exit 1
fi
if npm view "$name@$version" version >/dev/null 2>&1; then
  echo "$name@$version is already on npm; bump the version in package.json" >&2
  exit 1
fi

npm test
git tag -a "$tag" -m "$name $version"
git push -q origin "$tag"
echo "pushed $tag; watch the publish with: gh run watch --repo zack-maz/my-workbench"
