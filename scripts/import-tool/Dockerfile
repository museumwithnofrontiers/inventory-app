# Dedicated tool image for the legacy-data import pipeline: `stage` builds a
# local copy from the legacy source, `ship` sends that copy to the deployed
# host. See scripts/import-tool/README.md.
#
# Build from the REPO ROOT (not this directory), since it needs to copy
# scripts/importer:
#   docker build -f scripts/import-tool/Dockerfile -t import-tool:latest .

FROM node:26-alpine

# mysql-client provides mysql/mysqldump — used only by `ship` mode, to dump
# staging-mysql (a `stage` build) before handing it to the deployed host.
RUN apk add --no-cache openssh-client rsync bash mysql-client

WORKDIR /opt/import-tool/importer

# Install importer dependencies first (better layer caching on source changes).
# NOT --omit=dev: tsx (the TypeScript runner this CLI is invoked through) is
# a devDependency but genuinely needed at runtime here — omitting it forces
# `npx tsx` to silently fetch an unpinned copy from the registry on every run.
COPY scripts/importer/package.json scripts/importer/package-lock.json ./
RUN npm ci

# Importer source. tsx runs TypeScript directly — no build step.
COPY scripts/importer/tsconfig.json ./
COPY scripts/importer/src ./src

# language-importer.ts / country-importer.ts resolve these two files via a
# relative path assuming the full repo checkout (5 levels up from their own
# source file to the repo root, then database/seeders/data/*.json) — they
# are NOT importer-owned data, but the importer reads them directly as its
# single source of truth for reference data (same files a Laravel seeder
# would use). Placed at /opt/database/seeders/data to land exactly where
# that relative resolution expects, without pulling in the rest of
# database/seeders/data (e.g. ~800KB of unrelated dev-seeder sample images).
COPY database/seeders/data/languages.json /opt/database/seeders/data/languages.json
COPY database/seeders/data/countries.json /opt/database/seeders/data/countries.json

COPY scripts/import-tool/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

# No CMD on purpose: there is no safe default mode. Run this image through a
# compose service from the `import` profile, each of which names its own mode.
# Without arguments the entrypoint prints the three valid modes and exits.
