#!/bin/sh
# Runs the loader in the compose `search-loader` service (M15 B4). Installs
# the pinned package from the lockfile and checks its registry signatures and
# provenance, unless a local export is loaded with --from-dir.
set -e
cd /var/www/app/scripts/search

case " $* " in
    *" --from-dir "*|*" --rollback "*) ;;
    *)
        npm ci --no-fund --no-audit
        npm audit signatures
        ;;
esac

exec node loader.mjs "$@"
