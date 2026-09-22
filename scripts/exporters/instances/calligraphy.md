# Calligraphy (instance calligraphy)

The package `@museumwnf/calligraphy-data` is produced by
[`dxa-gallery`](../dxa-gallery/README.md) from
[`calligraphy.json`](calligraphy.json) next to this file — see
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md)
for the package specification and
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://calligraphy.museumwnf.org> (`thg_gallery` 8, legacy `link`
`calligraphy`, mwnf3 project `CAL`). Calligraphy is one of the six
galleries of
[M5 wave 1](https://github.com/museumwithnofrontiers/inventory-app/issues/1737),
run through the same [new-website recipe](../../../docs/deployment/new-website.md)
first exercised end to end on [`coins-medals`](coins-medals.md). It is
exported through the same shared `dxa-gallery` exporter as every other
gallery site — there is no per-site fork. It is the largest gallery of the
wave by a wide margin.

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **956 member items, none of them native.** Project `CAL` itself carries
  no objects — a curatorial-only project, the same shape as
  [`coins-medals`](coins-medals.md) rather than [`carpets`](carpets.md).
  Read from `items.json` `project_id` against `manifest.json`'s `projects`
  map:
  - 457 from **Explore Islamic Art Collections** (`EPM`)
  - 302 from **Discover Islamic Art** (`ISL`)
  - 70 from **Sharing History** (`awe`)
  - 49 from **Water in Islam** (`GalEx6`)
  - 28 from **With Brush and Qalam** (`EXWIT`)
  - 18 from **Discover Glass Art** (`DGA`)
  - 17 from **Discover Carpet Art** (`DCA`)
  - 10 from **The Table Is Set** (`EXTHE`)
  - 3 from **The Hijaz Railway** (`GalEx5`)
  - 2 from **Discover Baroque Art** (`BAR`)
- **Languages: 4 site languages (ar/en/es/fr), 10 languages overall**
  (`languages.json`: ar/de/el/en/es/fr/it/pt/se/tr). Item translations
  exist in all 10 — full language coverage, the same as
  [`architectural-elements`](architectural-elements.md).
- **`gallery.json`: `featured: false`, `hidden: false`,
  `has_timeline: false`, `has_country_timeline: false`.** The live
  `/api/v2/thg/galleries/self` (fetched 2026-09-21, one call) answers
  `hidden: false`, `hasTimeline: false`, `hasCountryBasedTimeline: false` —
  exact — and `featured: true`, the same documented `dxa-api` polarity
  mismatch seen on every gallery site so far.
- **37 timelines, 26 countries, 1,390 events** in `timelines.json` /
  `timeline_events.json` — the same corrected totals as every other DXA
  gallery site so far.
- **35 countries** in `countries.json`.
- **125 partners**, 26 `featured`, 0 with `item_count: 0` (the MWNF-384
  "museum created under the gallery's own project but holding nothing"
  branch is inert here too).
- **645 tags** (artist 114, dynasty 78, material 181, subject 36, type
  236), **48 dynasties**, **387 glossary entries** — the largest of every
  count so far in this wave, matching the item count.

## Slug vs. legacy link

The site slug is `calligraphy`, the npm package
`@museumwnf/calligraphy-data`. `gallery.json` carries the legacy value
verbatim: `slug: "calligraphy"` (`thg_gallery.link`) — the two happen to
coincide here, the same as `carpets`/`ceramics`, not like
`coins-medals`/`amulets` where they differ.

## Known gaps

Verified during this export, none blocking:

- **470 items have an empty English (`en`) description**, out of 956
  (`translations/items.en.json` against `items.json`). All 457 items from
  the `EPM` (Explore Islamic Art Collections) source project are among
  them (100%) — the already-documented importer-side gap (see
  [`coins-medals`](coins-medals.md#known-gaps)). 12 of the 18 `DGA`
  (Discover Glass Art) items are also affected, the same pattern seen on
  [`archaeology`](archaeology.md#known-gaps) and
  [`architectural-elements`](architectural-elements.md#known-gaps). The
  remaining 1 is a single `GalEx6` (Water in Islam) item
  (`db7e26a4-3251-5466-8971-8209285633d5`), not previously seen affected on
  another site in this wave — not investigated further, flagged for the
  gallery epic. Given the size of this gallery (956 items, the largest so
  far), the other affected ids are not listed individually here (470 in
  total); the full set is reproducible from `translations/items.en.json`
  against `items.json` as above.
- **No item is missing an English title.** All 956 items resolve a
  non-empty `name` in `translations/items.en.json`.
- **`notice` and `notice_c`** are not imported, per the standing rule
  documented on `carpets`/`amulets`; not specifically re-checked here.

## Determinism

Exported twice; the two `output/calligraphy/` trees compared with
`compare-output.mjs` (`generatedAt` excluded) were byte-identical:
`filesOnlyInA: []`, `filesOnlyInB: []`, `differing: []`, `gzMismatch: []`.

## Package contents

Same shape as [`carpets`](carpets.md#package-contents) and
[`coins-medals`](coins-medals.md#package-contents) — see either for the
full file list and what each holds. Nothing about the package shape is
different here.
