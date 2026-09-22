# Ceramics (instance ceramics)

The package `@museumwnf/ceramics-data` is produced by
[`dxa-gallery`](../dxa-gallery/README.md) from
[`ceramics.json`](ceramics.json) next to this file — see
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md)
for the package specification and
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://ceramics.museumwnf.org> (`thg_gallery` 11, legacy `link`
`ceramics`, mwnf3 project `CER`). Ceramics is one of the six galleries of
[M5 wave 1](https://github.com/museumwithnofrontiers/inventory-app/issues/1737),
run through the same [new-website recipe](../../../docs/deployment/new-website.md)
first exercised end to end on [`coins-medals`](coins-medals.md). It is
exported through the same shared `dxa-gallery` exporter as every other
gallery site — there is no per-site fork.

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **685 member items, none of them native.** Project `CER` itself carries
  no objects — a curatorial-only project, the same shape as
  [`coins-medals`](coins-medals.md) rather than [`carpets`](carpets.md).
  Read from `items.json` `project_id` against `manifest.json`'s `projects`
  map:
  - 250 from **Explore Islamic Art Collections** (`EPM`)
  - 240 from **Discover Islamic Art** (`ISL`)
  - 64 from **The Table Is Set** (`EXTHE`)
  - 60 from **Sharing History** (`awe`)
  - 50 from **Water in Islam** (`GalEx6`)
  - 11 from **Discover Baroque Art** (`BAR`)
  - 7 from **Discover Carpet Art** (`DCA`)
  - 2 from **The Hijaz Railway** (`GalEx5`)
  - 1 from **MWNF Galleries** (`GALLERIES`)
- **Languages: 4 site languages (ar/en/es/fr), 10 languages overall**
  (`languages.json`: ar/cs/de/el/en/es/fr/it/pt/tr — the only gallery in
  this wave carrying Czech, `cs`). Item translations exist in all 10 —
  full language coverage, the same as
  [`architectural-elements`](architectural-elements.md) and
  [`calligraphy`](calligraphy.md).
- **`gallery.json`: `featured: false`, `hidden: false`,
  `has_timeline: false`, `has_country_timeline: false`.** The live
  `/api/v2/thg/galleries/self` (fetched 2026-09-21, one call) answers
  `hidden: false`, `hasTimeline: false`, `hasCountryBasedTimeline: false` —
  exact — and `featured: true`, the same documented `dxa-api` polarity
  mismatch seen on every gallery site so far.
- **37 timelines, 26 countries, 1,390 events** in `timelines.json` /
  `timeline_events.json` — the same corrected totals as every other DXA
  gallery site so far.
- **37 countries** in `countries.json`.
- **107 partners**, 27 `featured`, 0 with `item_count: 0` (the MWNF-384
  "museum created under the gallery's own project but holding nothing"
  branch is inert here too).
- **292 tags** (artist 28, dynasty 55, material 86, subject 24, type 99),
  **35 dynasties**, **225 glossary entries**.

## Slug vs. legacy link

The site slug is `ceramics`, the npm package `@museumwnf/ceramics-data`.
`gallery.json` carries the legacy value verbatim: `slug: "ceramics"`
(`thg_gallery.link`) — the two happen to coincide here, the same as
`carpets`/`calligraphy`.

## Known gaps

Verified during this export, none blocking:

- **250 items have an empty English (`en`) description**, out of 685
  (`translations/items.en.json` against `items.json`) — exactly the 250
  items from the `EPM` (Explore Islamic Art Collections) source project,
  100% of them. The already-documented importer-side gap (see
  [`coins-medals`](coins-medals.md#known-gaps)). No non-EPM items are
  affected on this site — unlike `archaeology`, `architectural-elements`
  and `calligraphy`, this site has no `DGA` items, and its `GalEx6` (Water
  in Islam) items are unaffected. First ten affected ids (of 250):
  `94f76ace-8af6-5ec8-aec6-d15a08b2f250`,
  `8825752a-6526-5ec0-8840-5242549e083b`,
  `4285852d-bdc9-521a-a814-ba8b902153a3`,
  `fbb80300-6593-572b-a139-40b31becb5db`,
  `78c10c6a-90c0-51eb-966c-99cb0239f706`,
  `78426513-4220-51b8-99aa-4f7ba05f6c3a`,
  `b1ea078d-e766-5285-80c6-1d829833078f`,
  `8f458da9-54d7-5f9f-b148-b999f3b4cd27`,
  `045254ba-cb4b-504a-ab29-8546af52208c`,
  `da5156d7-a825-5d2f-bce3-fb298aee2108`.
- **No item is missing an English title.** All 685 items resolve a
  non-empty `name` in `translations/items.en.json`.
- **`notice` and `notice_c`** are not imported, per the standing rule
  documented on `carpets`/`amulets`; not specifically re-checked here.

## Determinism

Exported twice; the two `output/ceramics/` trees compared with
`compare-output.mjs` (`generatedAt` excluded) were byte-identical:
`filesOnlyInA: []`, `filesOnlyInB: []`, `differing: []`, `gzMismatch: []`.

## Package contents

Same shape as [`carpets`](carpets.md#package-contents) and
[`coins-medals`](coins-medals.md#package-contents) — see either for the
full file list and what each holds. Nothing about the package shape is
different here.
