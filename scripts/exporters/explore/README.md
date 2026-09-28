# Explore Exporter

Reads the `inventory-app` database directly and writes a set of denormalized,
static JSON files for the Explore website — no API server, no auth, no
runtime database dependency. Optionally packages and publishes that output
as a public npm package (`@museumwnf/explore-data`) on npmjs.

The package is specified in
[`../docs/explore-data-package.md`](../docs/explore-data-package.md), and the
legacy behaviour it reproduces in
[`../docs/explore-legacy-analysis.md`](../docs/explore-legacy-analysis.md).

## What is particular to Explore

- **No project.** The scope is the collection tree under the Explore root
  (purpose `explore-root`), as legacy shows it, and the items it holds: its
  members, their details and the records they link to (`src/core/scope.ts`).
- **Other databases' records.** Most monuments resolve onto ISL, BAR, Sharing
  History or Travels records. A monument's content is its own record's;
  Explore's own name and texts for it ship apart, as `explore`.
- **Structure in `extra`.** The site records (home banners, featured
  partnerships, travel layer) are on the root, the historical background on a
  location, the Explore monument ids on a location's memberships: all shipped
  as they are.
- **No dynasty and no timeline** exporter.

It is a fork of the `sharinghistory` exporter (see *Why forked per dataset* in
[`../README.md`](../README.md)).

## Run (TL;DR)

```powershell
docker compose --profile jobs run --rm exporter explore --force
```

```powershell
docker compose --profile jobs run --rm exporter explore --force --publish
```

The dataset scope is hardcoded: the exporter takes no scope arguments and
always writes `output/explore/` as `@museumwnf/explore-data`. Image URLs are
built from `BASE_URL` (or `--base-url`). `--publish` bumps the version,
writes `package.json`/`README.md`/`LICENSE.md` and runs `npm publish`; see
[`NPM_PUBLISH.md`](NPM_PUBLISH.md).

## Tests

```powershell
docker compose --profile jobs run --rm --entrypoint sh exporter -c "cd /var/www/app/scripts/exporters/explore && npm test"
```
