# Metalwork (instance metalwork)

The package `@museumwnf/metalwork-data` is produced by
[`dxa-gallery`](../dxa-gallery/README.md) from
[`metalwork.json`](metalwork.json) next to this file — see
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md)
for the package specification and
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://metalwork.museumwnf.org> (`thg_gallery` 25, legacy `link`
`metalwork`, mwnf3 project `MET`). Metalwork is the sixth and last gallery of
[M5 wave 3](https://github.com/museumwithnofrontiers/inventory-app/issues/1739)
(ivory, jewellery, landscapes, leatherworks, manuscripts, metalwork, in
legacy-gallery-id order) and the largest membership in the wave. Exported
through the same shared `dxa-gallery` exporter as every other gallery site —
see [`ivory`](ivory.md) for the wave.

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **504 member items, none of them native.** `MET` itself carries no
  objects — a curatorial-only project, the same shape as the rest of this
  wave rather than [`carpets`](carpets.md). Read from `items.json`
  `project_id` against `manifest.json`'s `projects` map:
  - 170 from **Explore Islamic Art Collections** (`EPM`)
  - 104 from **Discover Islamic Art** (`ISL`)
  - 97 from **Sharing History** (`awe`)
  - 60 from **Water in Islam** (`GalEx6`)
  - 57 from **The Table Is Set** (`EXTHE`)
  - 9 from **Discover Baroque Art** (`BAR`)
  - 4 from **Discover Carpet Art** (`DCA`)
  - 2 from **The Hijaz Railway** (`GalEx5`)
  - 1 from **MWNF Galleries** (the cross-gallery curatorial project)
- **Languages: 4 site languages (ar/en/es/fr), 9 languages overall**
  (`languages.json`). Item translations exist in all 9
  (`translations/items.{ar,de,el,en,es,fr,it,pt,tr}.json`) — no missing
  language row for these 504 items.
- **`gallery.json`: `featured: false`, `hidden: false`.** The live
  `/api/v2/thg/galleries/self` (fetched 2026-09-21, one call) answers
  `featured: true`, `hidden: false` — the same documented polarity mismatch
  as every DXA gallery site so far. `hasTimeline` / `hasCountryBasedTimeline`
  both `false` on the live endpoint, matching `gallery.json`.
- **37 timelines, 26 countries, 1,390 events** in `timelines.json` /
  `timeline_events.json` — the same corrected totals as every other DXA
  gallery site so far.
- **38 countries** in `countries.json`. Verified directly: item countries
  (37) ∪ partner countries (36) ∪ timeline countries (26) = 38, the exact
  `countries.json` count.
- **113 partners**, 26 `featured`, 0 with `item_count: 0` — the MWNF-384
  branch is present in the exporter but inert here. Largest partner roster
  in this wave, matching the largest membership.
- **404 tags** (artist 41, dynasty 54, material 106, subject 25, type 178),
  **37 dynasties**, **229 glossary entries** — the largest facet set in this
  wave.

## Slug vs. legacy link

No mismatch: the site slug is `metalwork`, the npm package
`@museumwnf/metalwork-data`, and `gallery.json` carries `slug: "metalwork"`
(`thg_gallery.link`) — the same value.

## Known gaps

Verified during this export, none blocking:

- **170 items have an empty English (`en`) description**, out of 504
  (`translations/items.en.json` against `items.json`). All 170 are from the
  `EPM` source project — the same, already-documented importer-side gap as
  on the other sites in this wave. The pattern is clean here — no outlier
  from another source project.
- **No item is missing an English title.** All 504 items resolve a
  non-empty `name` in `translations/items.en.json`.
- **EPM author attribution** — same importer-side gap as the other sites:
  `preparedBy`/`copyEditedBy` file only onto the Arabic row for EPM items,
  so `author`/`copy_editor` are absent from the English translation of an
  EPM-sourced record here too. Not re-verified item by item; recorded
  because the same 170 EPM-sourced items above are the likely carriers.
- **`notice` and `notice_c`** are not imported, per the standing rule
  documented on the other sites; not specifically re-checked here.

## Package contents

Same shape as [`carpets`](carpets.md#package-contents),
[`amulets`](amulets.md#package-contents) and
[`coins-medals`](coins-medals.md#package-contents) — see any of those for
the full file list and what each holds. Nothing about the package shape is
different here.
