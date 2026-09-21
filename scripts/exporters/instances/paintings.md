# Paintings (instance paintings)

The package `@museumwnf/paintings-data` is produced by
[`dxa-gallery`](../dxa-gallery/README.md) from
[`paintings.json`](paintings.json) next to this file — see
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md)
for the package specification and
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://paintings.museumwnf.org> (`thg_gallery` 28, legacy `link`
`paintings`, mwnf3 project `PAI`). Paintings is the third site of M5 wave 4
([epic #1740](https://github.com/museumwithnofrontiers/inventory-app/issues/1740)),
run through the same shared `dxa-gallery` exporter as every other gallery
site.

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **503 member items, none of them native.** `gallery.json` carries
  `project_id: null` for `PAI` — the same curatorial-only shape as
  [`mosaics`](mosaics.md), [`musical-instruments`](musical-instruments.md),
  [`amulets`](amulets.md) and [`coins-medals`](coins-medals.md), just at a
  much larger scale (503 items against 18–100 on the smaller sites in this
  family). `PAI` itself carries no objects, so the membership union resolves
  entirely to the link-table half — a project appearing zero times in this
  list means it holds no member items here, not that it was skipped. Read
  from `items.json` `project_id` against `manifest.json`'s `projects` map:
  - 153 from **Sharing History** (project key `awe`)
  - 121 from **Explore Islamic Art Collections** (`EPM`)
  - 114 from **Discover Baroque Art** (`BAR`)
  - 38 from **Water in Islam** (`GalEx6`)
  - 29 from **MWNF Galleries** (the cross-gallery curatorial project)
  - 20 from **The Hijaz Railway** (`GalEx5`)
  - 14 from **Discover Carpet Art** (`DCA`)
  - 7 from **Discover Glass Art** (`DGA`)
  - 4 from **Discover Islamic Art** (`ISL`)
  - 2 from **The Use Of Colours In Art** (`EXHCOLOUR`)
  - 1 from **The Table Is Set** (`EXTHE`)
- **Languages: 4 site languages (ar/en/es/fr), 9 languages overall**
  (`languages.json` — the widest language spread of the wave-4 sites so
  far, matching its size). Item translations exist in all 9
  (`translations/items.{ar,cs,de,en,es,fr,it,pt,tr}.json`).
- **`gallery.json`: `featured: false`, `hidden: false`,
  `has_timeline: false`, `has_country_timeline: false`.** The live
  `/api/v2/thg/galleries/self` on `paintings.museumwnf.org` (fetched
  2026-09-21, one call) answers `featured: true`, `hidden: false`,
  `hasTimeline: false`, `hasCountryBasedTimeline: false` — timeline flags
  match exactly; `featured` shows the same polarity mismatch documented on
  [`carpets`](carpets.md#the-one-field-where-the-package-deliberately-differs-from-the-live-api),
  [`amulets`](amulets.md), [`coins-medals`](coins-medals.md),
  [`mosaics`](mosaics.md) and
  [`musical-instruments`](musical-instruments.md#numbers-from-the-staging-export-2026-09-21---base-url-httpsinventorymetanulleu).
  The package ships the documented meaning, not the live polarity.
- **37 timelines, 26 countries, 1,390 events** in `timelines.json` /
  `timeline_events.json` — the same corrected totals as every other gallery
  in this family; nothing gallery-specific about the timeline here.
- **37 countries** in `countries.json`. Verified directly: item countries
  (32) ∪ partner countries (32) ∪ timeline countries (26) = 37, the exact
  `countries.json` count (the timeline's 26 countries are a subset of the
  item/partner set here, the reverse of the mosaics/musical-instruments
  shape).
- **95 partners**, 13 `featured`, 0 with `item_count: 0`.
- **392 tags** (artist 219, dynasty 12, material 75, subject 40, type 46),
  **14 dynasties**, **181 glossary entries**.

## Slug vs. legacy link

`gallery.json`'s `slug` is `paintings`, which is already the site slug —
the two coincide here, the same as `carpets` and `mosaics`.

## Known gaps

Verified during this export, none blocking:

- **132 items have an empty English (`en`) description**, out of 503
  (`translations/items.en.json` against `items.json`). Checked against
  `project_id`: 121 of the 132 are all 121 `EPM`-sourced items — the
  already-documented EPM short-description gap (carpets/amulets/coins-medals/
  mosaics/musical-instruments). The other 11 span four projects not
  previously implicated in this gap: 7 from `Discover Glass Art` (`DGA`), 2
  from `The Use Of Colours In Art` (`EXHCOLOUR`), 1 from `Water in Islam`
  (`GalEx6`) and 1 from `Sharing History` (`awe`). These 11 were not
  investigated further this run; recorded as an open question rather than
  folded into the EPM explanation. First ten ids (of the 132, unfiltered):
  `8750b2ef-ed27-560f-a5b8-9740d8ab180c`,
  `52e50179-8187-524b-bf97-e2dc4d14855d`,
  `db7e26a4-3251-5466-8971-8209285633d5`,
  `35dafca1-8ab1-5d22-8ffd-d39248a402df`,
  `18d4f96e-d0c4-5c13-9bef-cefac9e7441f`,
  `026c87e2-b1b2-5050-b96e-a327d8e94473`,
  `5ff60937-5e79-50fd-9f4b-b979480be0f5`,
  `1a291f62-97b6-5628-b0d7-aa7f8c26f74e`,
  `6c64959a-ef24-5b36-b22d-27aafad34901`,
  `8bd2685c-4d66-5da7-a343-412c67377856`.
- **No item is missing an English title.** All 503 items resolve a
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
