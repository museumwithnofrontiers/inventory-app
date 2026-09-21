# Arms and Armoury (instance arms-armoury)

The package `@museumwnf/arms-armoury-data` is produced by
[`dxa-gallery`](../dxa-gallery/README.md) from
[`arms-armoury.json`](arms-armoury.json) next to this file — see
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md)
for the package specification and
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://arms-armoury.museumwnf.org> (`thg_gallery` 7, legacy `link`
`arms_and_armoury`, mwnf3 project `ARM`). Arms and Armoury is one of the
six galleries of
[M5 wave 1](https://github.com/museumwithnofrontiers/inventory-app/issues/1737),
run through the same [new-website recipe](../../../docs/deployment/new-website.md)
first exercised end to end on [`coins-medals`](coins-medals.md). It is
exported through the same shared `dxa-gallery` exporter as every other
gallery site — there is no per-site fork.

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **97 member items, none of them native.** Project `ARM` itself carries no
  objects — a curatorial-only project, the same shape as
  [`coins-medals`](coins-medals.md) rather than [`carpets`](carpets.md).
  Read from `items.json` `project_id` against `manifest.json`'s `projects`
  map:
  - 43 from **Sharing History** (`awe`)
  - 37 from **Explore Islamic Art Collections** (`EPM`)
  - 13 from **Discover Islamic Art** (`ISL`)
  - 3 from **MWNF Galleries** (`GALLERIES`)
  - 1 from **Discover Baroque Art** (`BAR`)
- **Languages: 4 site languages (ar/en/es/fr), 7 languages overall**
  (`languages.json`: ar/de/en/es/fr/it/pt). Item translations exist in 6 of
  the 7 (`translations/items.{ar,de,en,es,fr,pt}.json` — no `it` row for
  any of these 97 items).
- **`gallery.json`: `featured: false`, `hidden: false`,
  `has_timeline: false`, `has_country_timeline: false`.** The live
  `/api/v2/thg/galleries/self` (fetched 2026-09-21, one call) answers
  `hidden: false`, `hasTimeline: false`, `hasCountryBasedTimeline: false` —
  exact — and `featured: true`, the same documented `dxa-api` polarity
  mismatch seen on every gallery site so far.
- **37 timelines, 26 countries, 1,390 events** in `timelines.json` /
  `timeline_events.json` — the same corrected totals as every other DXA
  gallery site so far.
- **32 countries** in `countries.json`.
- **32 partners**, 13 `featured`, 0 with `item_count: 0` (the MWNF-384
  "museum created under the gallery's own project but holding nothing"
  branch is inert here too).
- **155 tags** (artist 6, dynasty 15, material 74, subject 5, type 55),
  **15 dynasties**, **96 glossary entries**.

## Slug vs. legacy link

The site slug is `arms-armoury` (kebab-case, per decision Q4), the npm
package `@museumwnf/arms-armoury-data`. `gallery.json` carries the legacy
value verbatim: `slug: "arms_and_armoury"` (`thg_gallery.link`) — the site
slug also drops "and", so the two differ both in punctuation and in word
choice; data values keep legacy identity as-is, the site slug does not
derive from it.

## Known gaps

Verified during this export, none blocking:

- **37 items have an empty English (`en`) description**, out of 97
  (`translations/items.en.json` against `items.json`) — exactly the 37
  items from the `EPM` (Explore Islamic Art Collections) source project,
  100% of them. The already-documented importer-side gap (see
  [`coins-medals`](coins-medals.md#known-gaps)): legacy keeps the short
  text in `objects.description2`, filed by the importer as the EPM-context
  translation, so an EPM-native record's long description is legitimately
  empty. No non-EPM items are affected on this site, unlike
  [`archaeology`](archaeology.md#known-gaps) and
  [`architectural-elements`](architectural-elements.md#known-gaps) where
  `DGA`-sourced items were also affected — this site simply has no `DGA`
  items. First ten affected ids (of 37):
  `aa69e40a-8b6f-5533-b199-6d9e6bc16fba`,
  `689d7b0e-6f46-5838-8061-a55cbfd196fc`,
  `1d0bb991-65bb-5ca4-a706-534f9745fd08`,
  `ea93f27b-2ec2-5723-a1f1-65b29d221852`,
  `9759fb2e-169a-5a39-8d80-11289577854b`,
  `5c632cff-a778-5f7b-80ee-620050c5a5a0`,
  `18eaab56-4106-57be-8e1b-519c5c4f9546`,
  `bbad2081-7784-53a4-806b-ff1932fc5849`,
  `c2a299db-8a3b-54b1-a698-fc2c5173928e`,
  `0e006c19-7de8-5aa1-b346-0a40a7dbcbd8`.
- **No item is missing an English title.** All 97 items resolve a
  non-empty `name` in `translations/items.en.json`.
- **`notice` and `notice_c`** are not imported, per the standing rule
  documented on `carpets`/`amulets`; not specifically re-checked here.

## Determinism

Exported twice; the two `output/arms-armoury/` trees compared with
`compare-output.mjs` (`generatedAt` excluded) were byte-identical:
`filesOnlyInA: []`, `filesOnlyInB: []`, `differing: []`, `gzMismatch: []`.

## Package contents

Same shape as [`carpets`](carpets.md#package-contents) and
[`coins-medals`](coins-medals.md#package-contents) — see either for the
full file list and what each holds. Nothing about the package shape is
different here.
