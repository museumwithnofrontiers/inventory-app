# Clothing and Costume (instance clothing)

The package `@museumwnf/clothing-data` is produced by
[`dxa-gallery`](../dxa-gallery/README.md) from
[`clothing.json`](clothing.json) next to this file — see
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md)
for the package specification and
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://clothing.museumwnf.org> (`thg_gallery` 12, legacy `link`
`clothing_and_costume`, mwnf3 project `CLO`). Clothing and Costume is one
of the six galleries of
[M5 wave 1](https://github.com/museumwithnofrontiers/inventory-app/issues/1737),
run through the same [new-website recipe](../../../docs/deployment/new-website.md)
first exercised end to end on [`coins-medals`](coins-medals.md). It is
exported through the same shared `dxa-gallery` exporter as every other
gallery site — there is no per-site fork.

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **221 member items, none of them native.** Project `CLO` itself carries
  no objects — a curatorial-only project, the same shape as
  [`coins-medals`](coins-medals.md) rather than [`carpets`](carpets.md).
  Read from `items.json` `project_id` against `manifest.json`'s `projects`
  map:
  - 114 from **Sharing History** (`awe`)
  - 57 from **Explore Islamic Art Collections** (`EPM`)
  - 25 from **Discover Islamic Art** (`ISL`)
  - 14 from **MWNF Galleries** (`GALLERIES`)
  - 7 from **The Hijaz Railway** (`GalEx5`)
  - 2 from **Water in Islam** (`GalEx6`)
  - 1 from **Discover Baroque Art** (`BAR`)
  - 1 from **The Use Of Colours In Art** (`EXHCOLOUR`)
- **Languages: 4 site languages (ar/en/es/fr), 9 languages overall**
  (`languages.json`: ar/de/el/en/es/fr/it/pt/tr). Item translations exist
  in 8 of the 9 (`translations/items.{ar,de,el,en,es,fr,it,tr}.json` — no
  `pt` row for any of these 221 items).
- **`gallery.json`: `featured: false`, `hidden: false`,
  `has_timeline: false`, `has_country_timeline: false`.** The live
  `/api/v2/thg/galleries/self` (fetched 2026-09-21, one call) answers
  `hidden: false`, `hasTimeline: false`, `hasCountryBasedTimeline: false` —
  exact — and `featured: true`, the same documented `dxa-api` polarity
  mismatch seen on every gallery site so far.
- **37 timelines, 26 countries, 1,390 events** in `timelines.json` /
  `timeline_events.json` — the same corrected totals as every other DXA
  gallery site so far.
- **31 countries** in `countries.json`.
- **56 partners**, 14 `featured`, 0 with `item_count: 0` (the MWNF-384
  "museum created under the gallery's own project but holding nothing"
  branch is inert here too).
- **250 tags** (artist 1, dynasty 11, material 103, subject 12, type 123),
  **11 dynasties**, **145 glossary entries**.

## Slug vs. legacy link

The site slug is `clothing` (kebab-case, per decision Q4), the npm package
`@museumwnf/clothing-data`. `gallery.json` carries the legacy value
verbatim: `slug: "clothing_and_costume"` (`thg_gallery.link`) — the site
slug is a shortened form, the same pattern as `coins-medals`/`amulets`
(data values keep legacy identity as-is, the site slug does not derive
from it), just a truncation rather than a full rename.

## Known gaps

Verified during this export, none blocking:

- **57 items have an empty English (`en`) description**, out of 221
  (`translations/items.en.json` against `items.json`) — exactly the 57
  items from the `EPM` (Explore Islamic Art Collections) source project,
  100% of them. The already-documented importer-side gap (see
  [`coins-medals`](coins-medals.md#known-gaps)). No non-EPM items are
  affected on this site. First ten affected ids (of 57):
  `9ff5077e-cf93-5273-8105-87762d317700`,
  `7f2fed78-da3c-5a60-9d84-6fa3d3fadd64`,
  `6b90a9c0-f193-55c4-9a03-d29b7b481484`,
  `123265a3-960f-5c76-9487-14f718823b74`,
  `19c733fc-08e0-52fa-a832-d08a38cebc5d`,
  `70de6de0-cb62-5e26-a637-a4597cda72ee`,
  `a399cdfb-dda0-5b17-89ab-56d6fc1c5bcb`,
  `2363b57a-3e83-58d6-add7-b8e17a845595`,
  `65ef6d27-a41c-53d2-98a2-dab87b965982`,
  `80deca91-898b-5c5f-bbd8-e342f80ead7f`.
- **No item is missing an English title.** All 221 items resolve a
  non-empty `name` in `translations/items.en.json`.
- **`notice` and `notice_c`** are not imported, per the standing rule
  documented on `carpets`/`amulets`; not specifically re-checked here.

## Determinism

Exported twice; the two `output/clothing/` trees compared with
`compare-output.mjs` (`generatedAt` excluded) were byte-identical:
`filesOnlyInA: []`, `filesOnlyInB: []`, `differing: []`, `gzMismatch: []`.

## Package contents

Same shape as [`carpets`](carpets.md#package-contents) and
[`coins-medals`](coins-medals.md#package-contents) — see either for the
full file list and what each holds. Nothing about the package shape is
different here.
