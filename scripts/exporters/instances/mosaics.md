# Mosaics (instance mosaics)

The package `@museumwnf/mosaics-data` is produced by
[`dxa-gallery`](../dxa-gallery/README.md) from
[`mosaics.json`](mosaics.json) next to this file — see
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md)
for the package specification and
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://mosaics.museumwnf.org> (`thg_gallery` 26, legacy `link` `mosaics`,
mwnf3 project `MOS`). Mosaics is the first site of M5 wave 4
([epic #1740](https://github.com/museumwithnofrontiers/inventory-app/issues/1740)),
run through the same shared `dxa-gallery` exporter as every other gallery
site, following the [new-website recipe](../../../docs/deployment/new-website.md)
first exercised end to end on [`coins-medals`](coins-medals.md).

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **18 member items, none of them native.** `gallery.json` carries
  `project_id: null` for `MOS` — the same curatorial-only shape as
  [`amulets`](amulets.md) and [`coins-medals`](coins-medals.md), not like
  [`carpets`](carpets.md) where the gallery's own project holds objects.
  `MOS` itself carries no objects, so the membership union (items of the
  gallery's own project OR items listed in the `thg_gallery_*` link tables)
  resolves entirely to the second half. Read from `items.json` `project_id`
  against `manifest.json`'s `projects` map:
  - 6 from **Sharing History** (project key `awe`)
  - 5 from **Discover Islamic Art** (`ISL`)
  - 5 from **Explore Islamic Art Collections** (`EPM`)
  - 1 from **Discover Baroque Art** (`BAR`)
  - 1 from **Discover Carpet Art** (`DCA`)
- **Languages: 4 site languages (ar/en/es/fr), 8 languages overall**
  (`languages.json`). Item translations exist in 5 of the 8
  (`translations/items.{ar,en,es,fr,it}.json`).
- **`gallery.json`: `featured: false`, `hidden: false`,
  `has_timeline: false`, `has_country_timeline: false`.** The live
  `/api/v2/thg/galleries/self` on `mosaics.museumwnf.org` (fetched
  2026-09-21, one call) answers `featured: true`, `hidden: false`,
  `hasTimeline: false`, `hasCountryBasedTimeline: false` — the timeline
  flags match exactly; `featured` shows the same polarity mismatch already
  documented on [`carpets`](carpets.md#the-one-field-where-the-package-deliberately-differs-from-the-live-api),
  [`amulets`](amulets.md) and [`coins-medals`](coins-medals.md#numbers-from-the-staging-export-2026-09-21---base-url-httpsinventorymetanulleu):
  `dxa-api` copies the `hidden` projection into `featured` without flipping
  it. The package ships the documented meaning, not the live polarity.
- **37 timelines, 26 countries, 1,390 events** in `timelines.json` /
  `timeline_events.json` — the same corrected totals as every other gallery
  in this family, confirming the global-timeline merge applies unchanged to
  this instance; nothing gallery-specific about the timeline here.
- **27 countries** in `countries.json`. Verified directly: item countries
  (7) ∪ partner countries (7) ∪ timeline countries (26) = 27, the exact
  `countries.json` count.
- **12 partners**, 5 `featured`, 0 with `item_count: 0`.
- **49 tags** (artist 2, dynasty 6, material 14, subject 7, type 20), **5
  dynasties**, **41 glossary entries**.

## Slug vs. legacy link

`gallery.json`'s `slug` is `mosaics`, which is already the site slug — the
two coincide here, the same as `carpets`, so there is no remark needed
beyond this line.

## Known gaps

Verified during this export, none blocking:

- **5 items have an empty English (`en`) description**, out of 18
  (`translations/items.en.json` against `items.json`):
  `55dc9af5-2f7e-57e8-aec1-9a5889250732`,
  `c258b71a-ed5a-5e3f-a8b3-0c790492d086`,
  `5722c4e0-76c3-5fb1-8956-11019061b77b`,
  `25ddcf33-765c-5e79-96ad-5108a6555de1`,
  `4159a293-3ddf-5001-9a68-0994c000b7d3`. Checked against `project_id`: all
  5 are `EPM`-sourced — the already-documented EPM short-description gap
  (carpets/amulets/coins-medals): legacy keeps the short text in
  `objects.description2`, which the importer files as the EPM-context
  translation, so an EPM-native record's only row is that short one and its
  long description is legitimately empty.
- **No item is missing an English title.** All 18 items resolve a non-empty
  `name` in `translations/items.en.json`.
- **`notice` and `notice_c`** are not imported, per the standing rule
  documented on carpets/amulets/coins-medals; not specifically re-checked
  here.

## Package contents

Same shape as [`carpets`](carpets.md#package-contents),
[`amulets`](amulets.md#package-contents) and
[`coins-medals`](coins-medals.md#package-contents) — see any of those for
the full file list and what each holds. Nothing about the package shape is
different here.
