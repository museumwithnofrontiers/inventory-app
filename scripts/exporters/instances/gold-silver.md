# Gold and Silver (instance gold-silver)

The package `@museumwnf/gold-silver-data` is produced by
[`dxa-gallery`](../dxa-gallery/README.md) from
[`gold-silver.json`](gold-silver.json) next to this file — see
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md)
for the package specification and
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://gold-silver.museumwnf.org> (`thg_gallery` 19, legacy `link`
`gold_and_silver`, mwnf3 project `GOL`). Part of M5 wave 2
([epic #1738](https://github.com/museumwithnofrontiers/inventory-app/issues/1738)),
exported through the same shared `dxa-gallery` exporter as every other
gallery site, and the last of the five in legacy-id order.

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **120 member items, none of them native.** `GOL` itself carries no
  objects — a curatorial-only project, the same shape as
  [`communication`](communication.md), [`funerary-objects`](funerary-objects.md)
  and [`woodwork`](woodwork.md). Read from `items.json` `project_id` against
  `manifest.json`'s `projects` map:
  - 58 from **Explore Islamic Art Collections** (`EPM`)
  - 30 from **Sharing History** (`awe`)
  - 14 from **Discover Baroque Art** (`BAR`)
  - 9 from **Discover Islamic Art** (`ISL`)
  - 5 from **The Hijaz Railway** (`GalEx5`)
  - 4 from **MWNF Galleries** (the cross-gallery curatorial project)
- **Languages: 4 site languages (ar/en/es/fr), 10 languages overall**
  (`languages.json`) — the widest language spread of this wave.
- **`gallery.json`: `featured: false`, `hidden: false`.** The live
  `/api/v2/thg/galleries/self` (fetched 2026-09-21, one call) answers
  `featured: true`, `hidden: false` — the same documented polarity mismatch
  as [`communication`](communication.md). `hasTimeline`/
  `hasCountryBasedTimeline` both `false` on the live endpoint, matching
  `has_timeline`/`has_country_timeline` in `gallery.json`.
- **37 timelines, 26 countries, 1,390 events** in `timelines.json` /
  `timeline_events.json` — the same corrected totals as every other DXA
  gallery so far.
- **35 countries** in `countries.json`.
- **50 partners**, 15 `featured`, 0 with `item_count: 0` — the MWNF-384
  branch is inert here: no `mwnf3.museums` row has `project_id = 'GOL'`.
- **222 tags** (artist 20, dynasty 16, material 71, subject 17, type 98),
  **15 dynasties**, **109 glossary entries**.

## Slug vs. legacy link

The site slug is `gold-silver` (kebab-case), the npm package
`@museumwnf/gold-silver-data`. `gallery.json` carries the legacy value
verbatim: `slug: "gold_and_silver"` (`thg_gallery.link`) — a shortened,
chosen name, not derived from the legacy one, the same pattern as
[`communication`](communication.md#slug-vs-legacy-link).

## Known gaps

Verified during this export, none blocking:

- **58 items have an empty English (`en`) description**, out of 120
  (`translations/items.en.json` against `items.json`), and all 58 are the
  gallery's full complement of `EPM`-sourced items (58 of 58) — the same,
  already-documented importer-side gap as on carpets/coins-medals: legacy
  keeps the short text in `objects.description2`, which the importer files as
  the EPM-context translation, so an EPM-native record's only row is that
  short one and its long description is legitimately empty. As on
  [`funerary-objects`](funerary-objects.md), the EPM rule explains the gap
  completely here — no unexplained remainder. Ten sample ids:
  `aa69e40a-8b6f-5533-b199-6d9e6bc16fba`,
  `6b91356f-d7c7-598c-9081-59fee1195ec8`,
  `87a220a9-b576-558f-8ef5-a66e51fa7a04`,
  `9d4974ab-f811-5127-ae3d-e1895f9c8e80`,
  `a98d0e50-3029-5377-a2cf-b09ed33dce7b`,
  `ae99d9d0-3fe4-5ee1-a611-4a4095e1961a`,
  `c8cfe806-d0a6-52f3-8548-dbfaefacc927`,
  `a65ae972-d872-5b79-975c-3a0ac79cc20b`,
  `ea93f27b-2ec2-5723-a1f1-65b29d221852`,
  `f5c3cafb-6809-579d-8000-390c6200afa9`.
- **No item is missing an English title.** All 120 items resolve a
  non-empty `name` in `translations/items.en.json`.
- **EPM author attribution** — same importer-side gap as carpets/coins-medals:
  `preparedBy`/`copyEditedBy` file only onto the Arabic row for EPM items, so
  `author`/`copy_editor` are absent from the English translation of the 58
  EPM-sourced records here too. Not re-verified item by item on this site.
- **`notice` and `notice_c`** are not imported, per the standing rule
  documented on carpets/coins-medals; not specifically re-checked here.

## Package contents

Same shape as [`carpets`](carpets.md#package-contents) and
[`coins-medals`](coins-medals.md#package-contents) — see either for the full
file list and what each holds. Nothing about the package shape is different
here.
