#!/bin/sh
# herdr starts plugins with its own, often minimal, PATH. Find a node that
# can run this package (22.13+ for node:sqlite) and hand over to the daemon.
cd "$(dirname "$0")/.." || exit 1
for node in "$HERDR_BOBSHELL_NODE" "$(command -v node 2>/dev/null)" \
            /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node; do
  [ -n "$node" ] && [ -x "$node" ] && exec "$node" bin/herdr-bobshell.js daemon
done
echo "herdr-bobshell: no node found (set HERDR_BOBSHELL_NODE)" >&2
exit 1
