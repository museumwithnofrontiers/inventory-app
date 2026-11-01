# Islamic Art Exporter

Reads the `inventory-app` database directly and writes a set of denormalized,
static JSON files for public-facing frontends to consume — no API server, no
auth, no runtime database dependency. Optionally stages that output as the
public npm package `@museumwnf/islamicart-data` in
[data-packages](https://github.com/museumwithnofrontiers/data-packages), which
publishes it on npmjs for any consumer to install.

This exporter produces the Discover Islamic Art data-package (one exporter
per dataset lives under `scripts/exporters/<dataset>`).

## Run (TL;DR)

```powershell
cd scripts/exporters/islamicart
npm install                # first run only
npm run export -- `
  --force `
  --publish `
  --data-packages ../../../../data-packages `
  --base-url https://inventory.metanull.eu
```

The dataset scope is hardcoded — this exporter is single-purpose and takes
no scope arguments: it always exports the projects `ISL` (Discover Islamic
Art) **and** `EPM` (Explore Islamic Art Collections) together as
`@museumwnf/islamicart-data`. They are one dataset: an ISL-only export would
silently drop the EPM project collection and every `partner_group:museums:*`
collection, which is exactly why the keys are not configurable.
`manifest.json` always lists `"projectKeys": ["ISL", "EPM"]`.

Image URLs in the exported JSON are built from `BASE_URL` in `.env` (or
`--base-url`). `--publish` writes the export, with the next patch version,
into `packages/islamicart-data/` of a data-packages checkout; merging the pull
request that carries it publishes the version. `--package-version` is
optional — omit it to auto-increment the patch version; see
[`NPM_PUBLISH.md`](NPM_PUBLISH.md).

## What it exports

One JSON file per entity type, plus a manifest and per-language translation
files, written to `output/islamicart/`:

| File | Exporter | Contents |
|---|---|---|
| `manifest.json` | `ManifestExporter` | Metadata about the export itself (project keys, generated-at timestamp, available languages) and `site` — the languages the items carry, in switcher order with native labels, and the project's name per language: what the website reads before it mounts. Also `projects`: one entry per referenced project UUID, with a per-language name and the three URL columns (epic #1727 phase 2, additive) |
| `languages.json` | `LanguageExporter` | Language reference data |
| `countries.json` | `CountryExporter` | Country reference data + translations |
| `dynasties.json` | `DynastyExporter` | Dynasty reference data + translations |
| `timelines.json` | `TimelineExporter` | Timelines and their events |
| `partners.json` | `PartnerExporter` | Museums/institutions + translations + images. One shape across every dataset (museumwithnofrontiers/inventory-app#1699): `level`/`parent_id`/`project_uuids`, plus `item_count`/`featured` |
| `items.json` | `ItemExporter` | Items (objects/monuments/details), with images, dynasty/tag links, related-item links |
| `collections.json` | `CollectionExporter` | Collections (exhibitions/themes/galleries), with images and item membership |
| `glossary.json` | `GlossaryExporter` | Glossary terms + translations |
| `translations/items.<lang>.json` | `ItemExporter` | Per-language item translation fields, lazy-loadable separately from `items.json` |
| `translations/collections.<lang>.json` | `CollectionExporter` | Per-language collection translation fields |

Every JSON file is also written gzip-compressed (`.json.gz`) alongside the
plain version — the compressed copies aren't part of the npm package (see
below) but are there for CDN/static-hosting use.

### Project scoping

The export is scoped to the hardcoded project keys `ISL` and `EPM`, resolved
against `projects.backward_compatibility` (`mwnf3:projects:{KEY}`) — nothing
else in the database is exported. The same keys resolve a matching set of
context IDs, used internally to exclude explore-context translations from
overwriting the canonical project translations for items/collections.

## Configure

```bash
cp .env.example .env
# edit .env
```

- `DB_*` — the inventory database to read from (same variables/meaning as
  the [importer](../importer/README.md)'s target-DB connection — point this
  at a tunnel, a local dev DB, or [import-tool](../import-tool/README.md)'s
  `local-mysql` interchangeably, since the exporter only ever reads)
- `BASE_URL` — prepended to image paths in the exported JSON (defaults to
  `./images`, relative to wherever the JSON is served from)
- `DATA_PACKAGES_DIR` — the data-packages checkout `--publish` stages into
- `PACKAGE_AUTHOR` / `PACKAGE_LICENSE` / `NPM_REGISTRY` — npm package
  metadata and the registry asked for the latest version, only used with
  `--publish`

## Usage

```bash
npm run export -- [options]
```

```bash
# Standard export
npm run export -- --force

# Custom output location and image base URL
npm run export -- --force --output-dir /tmp/export --base-url https://cdn.example.com/storage

# Export and stage the package, with the next version, into data-packages
npm run export -- --force --publish --data-packages ../data-packages --base-url https://inventory.metanull.eu
```

| Option | Description |
|---|---|
| `--force` | Overwrite the output directory if it already exists (refuses to run otherwise) |
| `--output-dir <path>` | Base output directory (default: `output`, relative to cwd) |
| `--base-url <url>` | Base URL prepended to image paths (default: `BASE_URL` env var, then `./images`) |
| `--publish` | Stage the export, with the next version, into the data-packages checkout for its release workflow to publish |
| `--data-packages <path>` | The data-packages checkout (default: `DATA_PACKAGES_DIR` env var) |
| `--package-version <semver>` | Set an explicit version instead of auto-incrementing |
| `--npm-registry <url>` | The registry asked for the latest published version (default: `NPM_REGISTRY` env var, then npmjs) |

See [`NPM_PUBLISH.md`](NPM_PUBLISH.md) for the full publishing workflow —
versions, package structure, how data-packages publishes,
and the consumer-side install/import story.

## How this fits together

```
inventory-app DB
      │  (exporter reads directly — no API involved)
      ▼
scripts/exporters/islamicart  ──--publish──▶  data-packages: packages/islamicart-data
                                                       │  pull request merged: release workflow
                                                       ▼
                                             @museumwnf/islamicart-data (npmjs)
                                                       │  npm install
                                                       ▼
                                                 any consumer
```

The exporter and its consumers are decoupled entirely through the published
package — a consumer never talks to the exporter or the database, it just
depends on whatever version of the data package it installs. A routine
content update is one re-export with `--publish --force` and one merged pull
request in data-packages; consumers pick the new version up on their own
schedule.

## Troubleshooting

**Content missing from the package (e.g. the "Explore Islamic Art
Collections" project or `partner_group:*` collections)** — the installed
package predates the exporter hardcoding its `ISL EPM` scope and was
exported with `ISL` only; check `manifest.json`'s `projectKeys` (must be
`["ISL", "EPM"]`) and re-export/republish — the current exporter cannot
produce a wrongly-scoped package.

**`Output directory already exists`** — pass `--force` to overwrite it, or
pick a different `--output-dir`.

**Export completes with `EXPORT COMPLETED WITH ERRORS`** — one or more
exporters failed independently (the CLI continues through all exporters
regardless, then reports every failure at the end); `--publish` is skipped
entirely if any exporter errored. Check the per-exporter error line in the
final summary for which one failed and why.

**`--publish` refuses to start: "is not a checkout of museumwithnofrontiers/data-packages"** — see [`../docs/publishing.md`](../docs/publishing.md#troubleshooting).

**Database connection fails** — same `DB_*` variables and troubleshooting as
the [importer](../importer/README.md#troubleshooting); this exporter has no
`validate` command of its own, so a quick `--force` export against a small
single project is the fastest way to confirm connectivity.

## Licence

The published package is Content of the MWNF Website under the
[MWNF legal notice](https://www.museumwnf.org/about/legal-notice) (story
museumwithnofrontiers/inventory-app#1690): `package.json`'s `license` defaults to
`SEE LICENSE IN LICENSE.md` (override with `PACKAGE_LICENSE`), the notice
text itself ships as `LICENSE.md` — a copy of the single shared
`scripts/exporters/docs/LICENSE.md.template` all seven exporters copy from,
so the terms cannot drift between packages — and `manifest.json` carries a
`rights` block (`rights_holder`, `terms_url`, `attribution`) a consuming
website reads to render a source credit.
