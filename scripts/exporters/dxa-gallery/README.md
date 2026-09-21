# DXA Gallery Exporter

Reads the `inventory-app` database directly and writes a set of denormalized,
static JSON files for a DXA thematic-gallery website — no API server, no
auth, no runtime database dependency. Optionally packages and publishes that
output as a public npm package on npmjs.

This is the parameterised replacement for the forked DXA gallery exporters
([`../carpets`](../carpets/README.md), [`../amulets`](../amulets/README.md)),
built for [epic #1734](https://github.com/museumwithnofrontiers/inventory-app/issues/1734)
(story #1911). The package specification it implements is
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md).

## The instance mechanism

Everything that used to be a hardcoded constant in a forked exporter — which
collection to export, the site slug, the display name, the npm package name —
now lives in an "instance" file instead, passed with `--instance <name|path>`.
No legacy id appears anywhere in this exporter's own source: the collection is
resolved by UUID, supplied by the instance file.

See [`../instances/README.md`](../instances/README.md) for the instance file
shape, how the five fields validate, and how to obtain a `collection_id` for a
new site. `../instances/carpets.json` and `../instances/amulets.json` ship
with this exporter.

## Run

The exporter runs inside Docker; there is no host-side Node tooling required
for a normal export run (host tooling is only needed for `npm ci` /
type-check / lint / test during development).

```bash
docker compose --profile jobs run --rm exporter dxa-gallery --instance carpets --force
docker compose --profile jobs run --rm exporter dxa-gallery --instance amulets --force
```

Or, pointing at a path instead of a bare instance name:

```bash
docker compose --profile jobs run --rm exporter dxa-gallery --instance ../instances/carpets.json --force
```

On the host, from this directory (`.env` pointing at the target database):

```bash
npm run export -- --instance carpets --force
```

Add `--publish` to bump the version, generate `package.json`/`README.md` and
push to npmjs — see [`NPM_PUBLISH.md`](NPM_PUBLISH.md).

The compose service points at the **staging** database (`staging-mysql`),
which is where the exporter should be developed and verified. `.env` is only
consulted when running outside compose, and by convention such files point at
**production** — read it before running anything that way.

## Output layout

Each instance exports to its own subdirectory under `output/`, named after
the instance's `slug` (which need not match the instance filename):

```
output/<slug>/
├── manifest.json, gallery.json, items.json, tags.json, partners.json, …
└── translations/
    └── <entity>.<lang>.json
```

The version counter for `--publish` is `output/.version-<slug>` — one counter
per site, outside the site's own output directory so `--force` (which
deletes and recreates `output/<slug>/`) does not reset it. See
[`NPM_PUBLISH.md`](NPM_PUBLISH.md) for the publishing mechanics.

## Site-specific notes

The package shape and the exporter's general behaviour are documented here
and in [`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md).
Notes specific to a given site — figures, known gaps, validation records —
still live with the fork that site was built from for now:
[`../carpets/README.md`](../carpets/README.md),
[`../amulets/README.md`](../amulets/README.md). A later story retires the
fork directories and moves what is still relevant.

## Licence

The published package is Content of the MWNF Website under the
[MWNF legal notice](https://www.museumwnf.org/about/legal-notice) (story
museumwithnofrontiers/inventory-app#1690): `package.json`'s `license` defaults
to `SEE LICENSE IN LICENSE.md` (override with `PACKAGE_LICENSE`), the notice
text itself ships as `LICENSE.md` — a copy of the single shared
`scripts/exporters/docs/LICENSE.md.template` every exporter copies from, so
the terms cannot drift between packages — and `manifest.json` carries a
`rights` block (`rights_holder`, `terms_url`, `attribution`) a consuming
website reads to render a source credit.
