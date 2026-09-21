# Landscapes (instance landscapes)

The package `@museumwnf/landscapes-data` is produced by
[`dxa-gallery`](../dxa-gallery/README.md) from
[`landscapes.json`](landscapes.json) next to this file — see
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md)
for the package specification and
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://landscapes.museumwnf.org> (`thg_gallery` 22, legacy `link`
`landscapes`, mwnf3 project `LAN`). Landscapes is the third gallery of
[M5 wave 3](https://github.com/museumwithnofrontiers/inventory-app/issues/1739)
(ivory, jewellery, landscapes, leatherworks, manuscripts, metalwork, in
legacy-gallery-id order). Exported through the same shared `dxa-gallery`
exporter as every other gallery site — see [`ivory`](ivory.md) for the wave.

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **94 member items, none of them native.** `LAN` itself carries no objects
  — a curatorial-only project, the same shape as [`ivory`](ivory.md) and
  [`jewellery`](jewellery.md) rather than [`carpets`](carpets.md). Read from
  `items.json` `project_id` against `manifest.json`'s `projects` map:
  - 47 from **Sharing History** (`awe`)
  - 18 from **Discover Baroque Art** (`BAR`)
  - 13 from **The Hijaz Railway** (`GalEx5`)
  - 12 from **Explore Islamic Art Collections** (`EPM`)
  - 2 from **Discover Islamic Art** (`ISL`)
  - 1 from **Discover Glass Art** (`DGA`)
  - 1 from **Discover Carpet Art** (`DCA`)
- **Languages: 4 site languages (ar/en/es/fr), 9 languages overall**
  (`languages.json`, with `cs` — Czech — in place of the `el` seen on
  ivory/jewellery). Item translations exist in all 9
  (`translations/items.{ar,cs,de,en,es,fr,it,pt,tr}.json`) — no missing
  language row for these 94 items.
- **`gallery.json`: `featured: false`, `hidden: false`.** The live
  `/api/v2/thg/galleries/self` (fetched 2026-09-21, one call) answers
  `featured: true`, `hidden: false` — the same documented polarity mismatch
  as every DXA gallery site so far. `hasTimeline` / `hasCountryBasedTimeline`
  both `false` on the live endpoint, matching `gallery.json`.
- **37 timelines, 26 countries, 1,390 events** in `timelines.json` /
  `timeline_events.json` — the same corrected totals as every other DXA
  gallery site so far.
- **30 countries** in `countries.json`. Verified directly: item countries
  (21) ∪ partner countries (21) ∪ timeline countries (26) = 30, the exact
  `countries.json` count.
- **41 partners**, 6 `featured`, 0 with `item_count: 0` — the MWNF-384
  branch is present in the exporter but inert here.
- **170 tags** (artist 50, dynasty 6, material 44, subject 28, type 42), **4
  dynasties**, **48 glossary entries**.

## Slug vs. legacy link

No mismatch: the site slug is `landscapes`, the npm package
`@museumwnf/landscapes-data`, and `gallery.json` carries `slug:
"landscapes"` (`thg_gallery.link`) — the same value.

## Known gaps

Verified during this export, none blocking:

- **14 items have an empty English (`en`) description**, out of 94
  (`translations/items.en.json` against `items.json`). 12 of them are from
  the `EPM` source project — the same, already-documented importer-side gap
  as on the other sites in this wave (legacy's short text in
  `objects.description2` files as the EPM-context translation, leaving an
  EPM-native record's long description legitimately empty). The other 2 are
  not EPM: one from **Discover Glass Art** (`6f8d6482-6333-5e44-8f9e-903c41299c06`)
  and one from **The Hijaz Railway**
  (`55f6a683-f500-5b14-825f-06baa496180b`). Their connection to the EPM
  short-description rule was not established during this export, the same
  open question raised on [`coins-medals`](coins-medals.md#known-gaps) for
  its own Hijaz Railway outliers.
- **No item is missing an English title.** All 94 items resolve a
  non-empty `name` in `translations/items.en.json`.
- **EPM author attribution** — same importer-side gap as the other sites:
  `preparedBy`/`copyEditedBy` file only onto the Arabic row for EPM items,
  so `author`/`copy_editor` are absent from the English translation of an
  EPM-sourced record here too. Not re-verified item by item; recorded
  because the 12 EPM-sourced items above are the likely carriers.
- **`notice` and `notice_c`** are not imported, per the standing rule
  documented on the other sites; not specifically re-checked here.

## Package contents

Same shape as [`carpets`](carpets.md#package-contents),
[`amulets`](amulets.md#package-contents) and
[`coins-medals`](coins-medals.md#package-contents) — see any of those for
the full file list and what each holds. Nothing about the package shape is
different here.
