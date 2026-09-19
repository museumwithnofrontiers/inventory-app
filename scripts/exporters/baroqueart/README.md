# Baroque Art Exporter

Reads the `inventory-app` database directly and writes a set of denormalized,
static JSON files for public-facing frontends to consume — no API server, no
auth, no runtime database dependency. Optionally packages and publishes that
output as a public npm package (`@museumwnf/baroqueart-data`) on npmjs, for any consumer to install.

This exporter produces the Discover Baroque Art data-package (one exporter
per dataset lives under `scripts/exporters/<dataset>`).

## The BAR data-package

The package is shaped by what the Baroque Art dataset actually contains:

- **Single project key** — hardcoded to `BAR`; there is no companion project.
- **No dynasties** — the Baroque Art dataset has no dynasty entity, so there
  is no `dynasties.json` and no `translations/dynasties.*`.
- **Exhibitions root** — the collection export includes the per-project
  exhibitions root marker (`purpose: "exhibitions-root"`, created by the
  importer's `project-exhibition-root-keying` step; legacy key
  `mwnf3:exhibitions:root:BAR` kept as informational
  `backward_compatibility`) with the 9 BAR exhibitions under it. Consumers
  resolve the marker by `purpose` (#1505).
- **Timelines/glossary** — BAR timelines are always collection-bound, and
  glossary entries are usage-scoped to BAR items/collections/timeline events
  (the glossary is kept — BAR item pages use glossary tooltips).
- **Multilingual** — every translation present for the BAR context is exported
  (the legacy DBA site was English-only in its UI, but the data layer is
  multilingual).

## Run (TL;DR)

```powershell
cd scripts/exporters/baroqueart
npm install                # first run only
npm run export -- `
  --force `
  --publish
```

The dataset scope is hardcoded — this exporter is single-purpose and takes
no scope arguments: it always exports the `BAR` project to
`output/baroqueart/` as `@museumwnf/baroqueart-data`. Image URLs in the
exported JSON are built from
`BASE_URL` in `.env` (or `--base-url`). `--publish` does everything in one
go: version bump, `package.json`/`README.md` generation, and the actual
`npm publish` — no separate manual publish step. (`--package-version` is
optional — omit it to auto-increment instead; see
[`NPM_PUBLISH.md`](NPM_PUBLISH.md).)

## What it exports

One JSON file per entity type, plus a manifest and per-language translation
files, written to `output/baroqueart/`:

| File                                      | Exporter             | Contents                                                                                                                                                                                                                                         |
| ----------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `manifest.json`                           | `ManifestExporter`   | Metadata about the export itself (project keys, generated-at timestamp, available languages). Also `projects`: one entry per referenced project UUID, with a per-language name and the three URL columns (epic #1727 phase 2, additive) |
| `languages.json`                          | `LanguageExporter`   | Language reference data                                                                                                                                                                                                                          |
| `countries.json`                          | `CountryExporter`    | Country reference data + translations                                                                                                                                                                                                            |
| `timelines.json` / `timeline_events.json` | `TimelineExporter`   | Per-country BAR timelines and their events                                                                                                                                                                                                       |
| `partners.json`                           | `PartnerExporter`    | Museums/institutions + translations + images. One shape across every dataset (museumwithnofrontiers/inventory-app#1699): `level`/`parent_id`/`project_ids`, plus `item_count`/`featured`/`project_uuids` (epic #1727 phase 2, additive)                                                                     |
| `items.json`                              | `ItemExporter`       | Items (objects/monuments), with images, tag links, related-item links; monument details are embedded as `details[]` on the parent monument, never as top-level rows (#1515 — the legacy site only ever showed them inline as "Special Features") |
| `collections.json`                        | `CollectionExporter` | Collections (project, exhibitions root + exhibitions), with images and item membership                                                                                                                                                           |
| `glossary.json`                           | `GlossaryExporter`   | Glossary terms used by BAR content + translations                                                                                                                                                                                                |
| `translations/<entity>.<lang>.json`       | (several)            | Per-language translation fields, lazy-loadable separately                                                                                                                                                                                        |

There is deliberately **no `dynasties.json`** (see above).

Every JSON file is also written gzip-compressed (`.json.gz`) alongside the
plain version — the compressed copies aren't part of the npm package (see
below) but are there for CDN/static-hosting use.

### Project scoping

The export is scoped to the hardcoded project key `BAR`, resolved against
`projects.backward_compatibility` (`mwnf3:projects:{KEY}`) — nothing else in
the database is exported. The same key resolves a matching set of context
IDs, used internally to exclude explore-context translations from
overwriting the canonical project translations for items/collections.

## Configure

```bash
cp .env.example .env
# edit .env
```

- `DB_*` — the inventory database to read from (same variables/meaning as
  the [importer](../../importer/README.md)'s target-DB connection — point this
  at a tunnel or a local dev DB interchangeably, since the exporter only ever
  reads)
- `BASE_URL` — prepended to image paths in the exported JSON (defaults to
  `./images`, relative to wherever the JSON is served from)
- `PACKAGE_AUTHOR` / `PACKAGE_LICENSE` / `PACKAGE_REPO_URL` / `NPM_REGISTRY`
  — npm package metadata, only used with `--publish`

## Usage

```bash
npm run export -- [options]
```

```bash
# Standard export
npm run export -- --force

# Custom output location and image base URL
npm run export -- --force --output-dir /tmp/export --base-url https://cdn.example.com/storage

# Export, bump the package version, generate package.json/README.md, and publish
npm run export -- --force --publish
```

| Option                       | Description                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `--force`                    | Overwrite the output directory if it already exists (refuses to run otherwise)                    |
| `--output-dir <path>`        | Base output directory (default: `output`, relative to cwd)                                        |
| `--base-url <url>`           | Base URL prepended to image paths (default: `BASE_URL` env var, then `./images`)                  |
| `--publish`                  | Bump version, generate `package.json`/`README.md`, and `npm publish` the output as an npm package |
| `--package-version <semver>` | Set an explicit version instead of auto-incrementing                                              |
| `--npm-registry <url>`       | Override the publish registry (default: `NPM_REGISTRY` env var, then npmjs)             |

See [`NPM_PUBLISH.md`](NPM_PUBLISH.md) for the full publishing workflow —
version-file mechanics, package structure, npmjs authentication,
and the consumer-side install/import story.

## How this fits together

```
inventory-app DB
      │  (exporter reads directly — no API involved)
      ▼
scripts/exporters/baroqueart  ──npm publish──▶  @museumwnf/baroqueart-data (npmjs)
                                                       │  npm install
                                                       ▼
                                                 any consumer
```

The exporter and its consumers are decoupled entirely through the published
package — a consumer never talks to the exporter or the database, it just
depends on whatever version of the data package it installs. A routine
content update is one re-export with `--publish --force` (which publishes by
itself); consumers pick the new version up on their own schedule.

## Troubleshooting

**`Output directory already exists`** — pass `--force` to overwrite it, or
pick a different `--output-dir`.

**Export completes with `EXPORT COMPLETED WITH ERRORS`** — one or more
exporters failed independently (the CLI continues through all exporters
regardless, then reports every failure at the end); `--publish` is skipped
entirely if any exporter errored. Check the per-exporter error line in the
final summary for which one failed and why.

**`collections.json` is missing the exhibitions root** — the importer's
`project-exhibition-root-keying` step has not been run against this database
yet; run `npm run import -- --only project-exhibition-root-keying` from
`scripts/importer` (after verifying the `.env` target) and re-export.

**`npm publish` fails with "not authorized"** — not logged in to npmjs; see [`NPM_PUBLISH.md`](NPM_PUBLISH.md#npmjs-authentication).

**Database connection fails** — same `DB_*` variables and troubleshooting as
the [importer](../../importer/README.md#troubleshooting).

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
