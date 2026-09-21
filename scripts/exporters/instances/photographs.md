# Photographs (instance photographs)

The package `@museumwnf/photographs-data` is produced by
[`dxa-gallery`](../dxa-gallery/README.md) from
[`photographs.json`](photographs.json) next to this file — see
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md)
for the package specification and
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://photographs.museumwnf.org> (`thg_gallery` 29, legacy `link`
`photographs`, mwnf3 project `PHO`). Photographs is the fourth site of M5
wave 4
([epic #1740](https://github.com/museumwithnofrontiers/inventory-app/issues/1740)),
run through the same shared `dxa-gallery` exporter as every other gallery
site.

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **572 member items, none of them native.** `gallery.json` carries
  `project_id: null` for `PHO` — the same curatorial-only shape as every
  other wave-4 site so far. `PHO` itself carries no objects, so the
  membership union resolves entirely to the link-table half. Read from
  `items.json` `project_id` against `manifest.json`'s `projects` map:
  - 458 from **Sharing History** (project key `awe`) — dominant here, unlike
    any other wave-4 site
  - 68 from **The Hijaz Railway** (`GalEx5`)
  - 21 from **Water in Islam** (`GalEx6`)
  - 13 from **Explore Islamic Art Collections** (`EPM`)
  - 7 from **MWNF Galleries** (the cross-gallery curatorial project)
  - 4 from **Discover Carpet Art** (`DCA`)
  - 1 from **Discover Islamic Art** (`ISL`)
- **Languages: 4 site languages (ar/en/es/fr), 8 languages overall**
  (`languages.json`), but item translations exist in only those same 4
  (`translations/items.{ar,en,es,fr}.json`) — narrower than every other
  wave-4 site, where at least one borrowed-source language beyond the site
  languages carried an item translation. Not investigated further; recorded
  as an observation rather than a gap, since the site itself only needs its
  4 languages.
- **`gallery.json`: `featured: false`, `hidden: false`,
  `has_timeline: false`, `has_country_timeline: false`.** The live
  `/api/v2/thg/galleries/self` on `photographs.museumwnf.org` (fetched
  2026-09-21, one call) answers `featured: true`, `hidden: false`,
  `hasTimeline: false`, `hasCountryBasedTimeline: false` — timeline flags
  match exactly; `featured` shows the same polarity mismatch documented on
  [`carpets`](carpets.md#the-one-field-where-the-package-deliberately-differs-from-the-live-api)
  and every other wave-4 site so far
  ([`mosaics`](mosaics.md#numbers-from-the-staging-export-2026-09-21---base-url-httpsinventorymetanulleu),
  [`musical-instruments`](musical-instruments.md),
  [`paintings`](paintings.md)). The package ships the documented meaning,
  not the live polarity.
- **37 timelines, 26 countries, 1,390 events** in `timelines.json` /
  `timeline_events.json` — the same corrected totals as every other gallery
  in this family; nothing gallery-specific about the timeline here.
- **29 countries** in `countries.json`. Verified directly: item countries
  (21) ∪ partner countries (21) ∪ timeline countries (26) = 29, the exact
  `countries.json` count.
- **68 partners, 0 featured** — the first wave-4 site with no featured
  partner at all; 0 with `item_count: 0`.
- **150 tags** (artist 73, dynasty 2, material 49, subject 8, type 18), **2
  dynasties**, **79 glossary entries**.

## Slug vs. legacy link

`gallery.json`'s `slug` is `photographs`, which is already the site slug —
the two coincide here, the same as `carpets`, `mosaics` and `paintings`.

## Known gaps

Verified during this export, none blocking:

- **22 items have an empty English (`en`) description**, out of 572
  (`translations/items.en.json` against `items.json`). Checked against
  `project_id`: 13 of the 22 are all 13 `EPM`-sourced items — the
  already-documented EPM short-description gap (carpets/amulets/coins-medals/
  mosaics/musical-instruments/paintings). The other 9 are all from `The
  Hijaz Railway` (`GalEx5`), 9 of its 68 member items — the same source
  project coins-medals flagged 2 unexplained items from (there called
  `GalEx5`); this project's connection to the EPM short-description rule
  was not established there either, and is not established here. First ten
  ids: `aabb4c5f-7b18-5d94-a2c9-d82eb2eb1616`,
  `23fa41ec-b0ae-57aa-b230-d5ba2e0f4a72`,
  `e22b8e87-2e89-5216-be3f-0b349a0bf625`,
  `a43697f3-629f-54a0-ad35-dca00abfe608`,
  `1af2dd04-8576-5d3d-9ef0-7c42ddce54b3`,
  `aa4878d5-82c1-50ac-a798-91386bc0bd59`,
  `447b3071-8472-521a-b586-24ed31569284`,
  `fe87deef-c455-5755-9f18-175550fef06e`,
  `3dcfae1b-7081-54c3-beee-e83c87032c40`,
  `4b722a97-03c6-569f-b940-b4b7d60e5867`.
- **No item is missing an English title.** All 572 items resolve a
  non-empty `name` in `translations/items.en.json`.
- **`notice` and `notice_c`** are not imported, per the standing rule
  documented on carpets/amulets/coins-medals; not specifically re-checked
  here.

## Package contents

Same shape as [`carpets`](carpets.md#package-contents),
[`amulets`](amulets.md#package-contents) and
[`coins-medals`](coins-medals.md#package-contents) — see any of those for
the full file list and what each holds. Nothing about the package shape is
different here.
