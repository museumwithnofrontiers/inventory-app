# Manuscripts (instance manuscripts)

The package `@museumwnf/manuscripts-data` is produced by
[`dxa-gallery`](../dxa-gallery/README.md) from
[`manuscripts.json`](manuscripts.json) next to this file — see
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md)
for the package specification and
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://manuscripts.museumwnf.org> (`thg_gallery` 24, legacy `link`
`manuscripts`, mwnf3 project `MAN`). Manuscripts is the fifth gallery of
[M5 wave 3](https://github.com/museumwithnofrontiers/inventory-app/issues/1739)
(ivory, jewellery, landscapes, leatherworks, manuscripts, metalwork, in
legacy-gallery-id order) and the largest membership in the wave. Exported
through the same shared `dxa-gallery` exporter as every other gallery site —
see [`ivory`](ivory.md) for the wave.

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **386 member items, none of them native.** `MAN` itself carries no
  objects — a curatorial-only project, the same shape as the rest of this
  wave rather than [`carpets`](carpets.md). Read from `items.json`
  `project_id` against `manifest.json`'s `projects` map:
  - 212 from **Explore Islamic Art Collections** (`EPM`)
  - 65 from **Sharing History** (`awe`)
  - 47 from **Discover Islamic Art** (`ISL`)
  - 43 from **Water in Islam** (`GalEx6`)
  - 8 from **The Table Is Set** (`EXTHE`)
  - 8 from **The Hijaz Railway** (`GalEx5`)
  - 1 from **Discover Baroque Art** (`BAR`)
  - 1 from **The Use Of Colours In Art** (`EXHCOLOUR`)
  - 1 from **MWNF Galleries** (the cross-gallery curatorial project)
- **Languages: 4 site languages (ar/en/es/fr), 9 languages overall**
  (`languages.json`, with `se` — Swedish, per the memory of decision "`se` =
  Swedish" — in place of the `el`/`cs` seen elsewhere in this wave). Item
  translations exist in only 8 of the 9
  (`translations/items.{ar,de,en,es,fr,it,se,tr}.json` — no `pt` row for any
  of these 386 items).
- **`gallery.json`: `featured: false`, `hidden: false`.** The live
  `/api/v2/thg/galleries/self` (fetched 2026-09-21, one call) answers
  `featured: true`, `hidden: false` — the same documented polarity mismatch
  as every DXA gallery site so far. `hasTimeline` / `hasCountryBasedTimeline`
  both `false` on the live endpoint, matching `gallery.json`.
- **37 timelines, 26 countries, 1,390 events** in `timelines.json` /
  `timeline_events.json` — the same corrected totals as every other DXA
  gallery site so far.
- **35 countries** in `countries.json`. Verified directly: item countries
  (29) ∪ partner countries (29) ∪ timeline countries (26) = 35, the exact
  `countries.json` count.
- **73 partners**, 15 `featured`, 0 with `item_count: 0` — the MWNF-384
  branch is present in the exporter but inert here.
- **263 tags** (artist 80, dynasty 45, material 46, subject 25, type 67),
  **33 dynasties**, **235 glossary entries** — the richest facet/glossary set
  in this wave, matching the largest membership.

## Slug vs. legacy link

No mismatch: the site slug is `manuscripts`, the npm package
`@museumwnf/manuscripts-data`, and `gallery.json` carries `slug:
"manuscripts"` (`thg_gallery.link`) — the same value.

## Known gaps

Verified during this export, none blocking:

- **215 items have an empty English (`en`) description**, out of 386
  (`translations/items.en.json` against `items.json`). 212 of them are from
  the `EPM` source project — the same, already-documented importer-side gap
  as on the other sites in this wave. The other 3 are not EPM: two from
  **Water in Islam** (`db7e26a4-3251-5466-8971-8209285633d5`,
  `7e967a87-06f8-504f-b353-0258d46e2618`) and one from **The Use Of Colours
  In Art** (`6d7f4481-8b0a-58f0-8484-d932e30b3821`). Their connection to the
  EPM short-description rule was not established during this export, the
  same open question raised on [`landscapes`](landscapes.md#known-gaps),
  [`leatherworks`](leatherworks.md#known-gaps) and
  [`coins-medals`](coins-medals.md#known-gaps) for their own non-EPM
  outliers.
- **No item is missing an English title.** All 386 items resolve a
  non-empty `name` in `translations/items.en.json`.
- **EPM author attribution** — same importer-side gap as the other sites:
  `preparedBy`/`copyEditedBy` file only onto the Arabic row for EPM items,
  so `author`/`copy_editor` are absent from the English translation of an
  EPM-sourced record here too. Not re-verified item by item; recorded
  because the 212 EPM-sourced items above are the likely carriers.
- **`notice` and `notice_c`** are not imported, per the standing rule
  documented on the other sites; not specifically re-checked here.

## Package contents

Same shape as [`carpets`](carpets.md#package-contents),
[`amulets`](amulets.md#package-contents) and
[`coins-medals`](coins-medals.md#package-contents) — see any of those for
the full file list and what each holds. Nothing about the package shape is
different here.
