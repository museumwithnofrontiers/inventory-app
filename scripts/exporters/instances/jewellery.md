# Jewellery (instance jewellery)

The package `@museumwnf/jewellery-data` is produced by
[`dxa-gallery`](../dxa-gallery/README.md) from
[`jewellery.json`](jewellery.json) next to this file — see
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md)
for the package specification and
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://jewellery.museumwnf.org> (`thg_gallery` 21, legacy `link`
`jewellery`, mwnf3 project `JEW`). Jewellery is the second gallery of
[M5 wave 3](https://github.com/museumwithnofrontiers/inventory-app/issues/1739)
(ivory, jewellery, landscapes, leatherworks, manuscripts, metalwork, in
legacy-gallery-id order). Exported through the same shared `dxa-gallery`
exporter as every other gallery site — see [`ivory`](ivory.md) for the wave.

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **164 member items, none of them native.** `JEW` itself carries no
  objects — a curatorial-only project, the same shape as
  [`ivory`](ivory.md), [`coins-medals`](coins-medals.md) and
  [`amulets`](amulets.md) rather than [`carpets`](carpets.md). Read from
  `items.json` `project_id` against `manifest.json`'s `projects` map:
  - 76 from **Sharing History** (`awe`)
  - 49 from **Explore Islamic Art Collections** (`EPM`)
  - 31 from **Discover Islamic Art** (`ISL`)
  - 4 from **MWNF Galleries** (the cross-gallery curatorial project)
  - 2 from **The Hijaz Railway** (`GalEx5`)
  - 1 from **Discover Baroque Art** (`BAR`)
  - 1 from **Discover Glass Art** (`DGA`)
- **Languages: 4 site languages (ar/en/es/fr), 9 languages overall**
  (`languages.json`). Item translations exist in only 8 of the 9
  (`translations/items.{ar,de,el,en,es,fr,pt,tr}.json` — no `it` row for any
  of these 164 items).
- **`gallery.json`: `featured: false`, `hidden: false`.** The live
  `/api/v2/thg/galleries/self` (fetched 2026-09-21, one call) answers
  `featured: true`, `hidden: false` — the same documented polarity mismatch
  as [`ivory`](ivory.md#numbers-from-the-staging-export-2026-09-21---base-url-httpsinventorymetanulleu)
  and every DXA gallery site so far. `hasTimeline` / `hasCountryBasedTimeline`
  both `false` on the live endpoint, matching `has_timeline` /
  `has_country_timeline` in `gallery.json`.
- **37 timelines, 26 countries, 1,390 events** in `timelines.json` /
  `timeline_events.json` — the same corrected totals as every other DXA
  gallery site so far.
- **34 countries** in `countries.json`. Verified directly: item countries
  (26) ∪ partner countries (26) ∪ timeline countries (26) = 34, the exact
  `countries.json` count.
- **49 partners**, 15 `featured`, 0 with `item_count: 0` — the MWNF-384
  branch is present in the exporter but inert here.
- **226 tags** (artist 2, dynasty 23, material 91, subject 9, type 101), **18
  dynasties**, **115 glossary entries**.

## Slug vs. legacy link

No mismatch: the site slug is `jewellery`, the npm package
`@museumwnf/jewellery-data`, and `gallery.json` carries `slug: "jewellery"`
(`thg_gallery.link`) — the same value.

## Known gaps

Verified during this export, none blocking:

- **49 items have an empty English (`en`) description**, out of 164
  (`translations/items.en.json` against `items.json`). All 49 are from the
  `EPM` source project — the same, already-documented importer-side gap as
  on carpets, amulets, coins-medals and ivory: legacy keeps the short text
  in `objects.description2`, filed by the importer as the EPM-context
  translation, so the long description is legitimately empty for an
  EPM-native record. The pattern is clean here — no outlier from another
  source project.
- **No item is missing an English title.** All 164 items resolve a
  non-empty `name` in `translations/items.en.json`.
- **EPM author attribution** — same importer-side gap as the other sites:
  `preparedBy`/`copyEditedBy` file only onto the Arabic row for EPM items,
  so `author`/`copy_editor` are absent from the English translation of an
  EPM-sourced record here too. Not re-verified item by item; recorded
  because the same 49 EPM-sourced items above are the likely carriers.
- **`notice` and `notice_c`** are not imported, per the standing rule
  documented on the other sites; not specifically re-checked here.

## Package contents

Same shape as [`carpets`](carpets.md#package-contents),
[`amulets`](amulets.md#package-contents) and
[`coins-medals`](coins-medals.md#package-contents) — see any of those for
the full file list and what each holds. Nothing about the package shape is
different here.
