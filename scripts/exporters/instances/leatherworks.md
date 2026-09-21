# Leatherwork (instance leatherworks)

The package `@museumwnf/leatherworks-data` is produced by
[`dxa-gallery`](../dxa-gallery/README.md) from
[`leatherworks.json`](leatherworks.json) next to this file — see
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md)
for the package specification and
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://leatherworks.museumwnf.org> (`thg_gallery` 23, legacy `link`
`leatherwork`, mwnf3 project `LEA`). Leatherwork is the fourth gallery of
[M5 wave 3](https://github.com/museumwithnofrontiers/inventory-app/issues/1739)
(ivory, jewellery, landscapes, leatherworks, manuscripts, metalwork, in
legacy-gallery-id order). Exported through the same shared `dxa-gallery`
exporter as every other gallery site — see [`ivory`](ivory.md) for the wave.

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **42 member items, none of them native.** `LEA` itself carries no objects
  — a curatorial-only project, the same shape as the rest of this wave
  rather than [`carpets`](carpets.md). Read from `items.json` `project_id`
  against `manifest.json`'s `projects` map:
  - 22 from **Explore Islamic Art Collections** (`EPM`)
  - 9 from **Sharing History** (`awe`)
  - 9 from **Discover Islamic Art** (`ISL`)
  - 1 from **Discover Glass Art** (`DGA`)
  - 1 from **The Hijaz Railway** (`GalEx5`)
- **Languages: 4 site languages (ar/en/es/fr), 6 languages overall**
  (`languages.json`) — the smallest language set in this wave. Item
  translations exist in all 6
  (`translations/items.{ar,de,en,es,fr,tr}.json`) — no missing language row
  for these 42 items.
- **`gallery.json`: `featured: false`, `hidden: false`.** The live
  `/api/v2/thg/galleries/self` (fetched 2026-09-21, one call) answers
  `featured: true`, `hidden: false` — the same documented polarity mismatch
  as every DXA gallery site so far. `hasTimeline` / `hasCountryBasedTimeline`
  both `false` on the live endpoint, matching `gallery.json`.
- **37 timelines, 26 countries, 1,390 events** in `timelines.json` /
  `timeline_events.json` — the same corrected totals as every other DXA
  gallery site so far.
- **27 countries** in `countries.json`. Verified directly: item countries
  (14) ∪ partner countries (14) ∪ timeline countries (26) = 27, the exact
  `countries.json` count.
- **26 partners**, 7 `featured`, 0 with `item_count: 0` — the MWNF-384
  branch is present in the exporter but inert here.
- **102 tags** (artist 2, dynasty 13, material 44, subject 9, type 34), **12
  dynasties**, **91 glossary entries**.

## Slug vs. legacy link

Unlike ivory/jewellery/landscapes, this one differs: the site slug is
`leatherworks` (plural — decision Q4, the public subdomain and repository
name), while `gallery.json` carries the legacy value verbatim: `slug:
"leatherwork"` (singular, `thg_gallery.link`) — confirmed against the live
`galleryKey: "leatherwork"`. Same pattern as `coins-medals` (`coins-medals`
vs. legacy `coins_and_medals`) and `amulets` (`amulets` vs. legacy
`amulets_and_talismans`): data values keep legacy identity as-is, the site
slug does not derive from it.

## Known gaps

Verified during this export, none blocking:

- **23 items have an empty English (`en`) description**, out of 42
  (`translations/items.en.json` against `items.json`). 22 of them are from
  the `EPM` source project — the same, already-documented importer-side gap
  as on the other sites in this wave. The other one is not EPM: **Discover
  Glass Art** (`25c0e794-1eb1-5442-a5fb-745b80a3d212`). Its connection to the
  EPM short-description rule was not established during this export, the
  same open question raised on [`landscapes`](landscapes.md#known-gaps) and
  [`coins-medals`](coins-medals.md#known-gaps) for their own non-EPM
  outliers.
- **No item is missing an English title.** All 42 items resolve a
  non-empty `name` in `translations/items.en.json`.
- **EPM author attribution** — same importer-side gap as the other sites:
  `preparedBy`/`copyEditedBy` file only onto the Arabic row for EPM items,
  so `author`/`copy_editor` are absent from the English translation of an
  EPM-sourced record here too. Not re-verified item by item; recorded
  because the 22 EPM-sourced items above are the likely carriers.
- **`notice` and `notice_c`** are not imported, per the standing rule
  documented on the other sites; not specifically re-checked here.

## Package contents

Same shape as [`carpets`](carpets.md#package-contents),
[`amulets`](amulets.md#package-contents) and
[`coins-medals`](coins-medals.md#package-contents) — see any of those for
the full file list and what each holds. Nothing about the package shape is
different here.
