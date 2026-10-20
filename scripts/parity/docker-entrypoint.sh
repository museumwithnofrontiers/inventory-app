#!/bin/sh
# Entry point of the `parity` compose service (see README.md).
#   parity [mode…] [options]       node run.mjs …
#   parity tools/<tool>.mjs …      one tool on its own (samples.mjs, reasons.mjs, rawpeek.mjs …)
#   parity npm …                   npm in this project (npm test, npm run lint:check)
set -e
cd /var/www/app/scripts/parity

# node_modules is a named volume: install again only when the lockfile changed.
stamp=node_modules/.lock-sha1
want=$(sha1sum package-lock.json | cut -d' ' -f1)
if [ "$(cat "$stamp" 2>/dev/null)" != "$want" ]; then
  # Production only: the linter needs a newer Node than this image's (lint on node:24).
  npm ci --omit=dev --no-fund --no-audit
  echo "$want" > "$stamp"
fi

case "$1" in
  *.mjs) exec node --max-old-space-size=4096 "$@" ;;
  npm|node|sh) exec "$@" ;;
  *) exec node run.mjs "$@" ;;
esac
