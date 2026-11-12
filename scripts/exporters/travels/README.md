# Travels Exporter

Reads the inventory database (read-only) and writes the static JSON files of
the Travels website, which replaces the Exhibition Trails of
travels.museumwnf.org: no API server, no auth, no database at runtime. The
output is published as the npm package `@museumwnf/travels-data` in
[data-packages](https://github.com/museumwithnofrontiers/data-packages).

The package is specified in
[`../docs/travels-data-package.md`](../docs/travels-data-package.md); the
site's note is [`../instances/travels.md`](../instances/travels.md).

## What is particular to Travels

- **A fork of `explore`.** The same tree walk, rooted at the collection of
  purpose `travels-root`, with none of Explore's rules for hidden
  collections: legacy shows the whole tree (see *Why forked per dataset* in
  [`../README.md`](../README.md)).
- **Its own items are the locations' monuments.** A trail's own members, its
  entries, are Islamic Art's records: they ship as references
  (`references.json`) from the shared rule in
  [`../shared/sites.mjs`](../shared/sites.mjs), never as items.
- **Links out.** Each trail carries its "Starting point" partner and its
  publications, each with its page on the Publications site.

## Run (TL;DR)

```powershell
docker compose --profile jobs run --rm exporter travels --force
```

```powershell
docker compose --profile jobs run --rm exporter travels --force --publish --base-url https://inventory.metanull.eu
```

The dataset scope is hardcoded: the exporter takes no scope arguments and
always writes `output/travels/` as `@museumwnf/travels-data`. Image URLs are
built from `BASE_URL` (or `--base-url`). `--publish` stages the export,
with the next version, into the data-packages checkout, and merging the pull
request that carries it publishes the version; see
[`NPM_PUBLISH.md`](NPM_PUBLISH.md).

## Tests

```powershell
docker compose --profile jobs run --rm --no-deps --entrypoint sh exporter -c "cd /var/www/app/scripts/exporters/travels && npm test"
```
