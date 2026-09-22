# Furniture and Woodwork (instance woodwork)

The package `@museumwnf/woodwork-data` is produced by
[`dxa-gallery`](../dxa-gallery/README.md) from
[`woodwork.json`](woodwork.json) next to this file — see
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md)
for the package specification and
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://woodwork.museumwnf.org> (`thg_gallery` 17, legacy `link`
`furniture_and_woodwork`, mwnf3 project `WOO`). Part of M5 wave 2
([epic #1738](https://github.com/museumwithnofrontiers/inventory-app/issues/1738)),
exported through the same shared `dxa-gallery` exporter as every other
gallery site.

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **272 member items, none of them native.** `WOO` itself carries no
  objects — a curatorial-only project, the same shape as the other four
  wave-2 galleries. This is the widest source spread of the five: nine
  source projects, read from `items.json` `project_id` against
  `manifest.json`'s `projects` map:
  - 78 from **Discover Islamic Art** (`ISL`)
  - 69 from **Explore Islamic Art Collections** (`EPM`)
  - 53 from **Sharing History** (`awe`)
  - 24 from **Water in Islam** (`GalEx6`)
  - 19 from **Discover Baroque Art** (`BAR`)
  - 14 from **The Table Is Set** (`EXTHE`)
  - 9 from **Discover Carpet Art** (`DCA`, the carpets gallery's own native
    project — a borrowed item here, same as on any other gallery that
    borrows a carpets record)
  - 3 from **The Hijaz Railway** (`GalEx5`)
  - 3 from **MWNF Galleries** (the cross-gallery curatorial project)
- **Languages: 4 site languages (ar/en/es/fr), 9 languages overall**
  (`languages.json`). The extra languages are carried by borrowed records
  from source projects that hold text in them.
- **`gallery.json`: `featured: false`, `hidden: false`.** The live
  `/api/v2/thg/galleries/self` (fetched 2026-09-21, one call) answers
  `featured: true`, `hidden: false` — the same documented polarity mismatch
  as [`communication`](communication.md). `hasTimeline`/
  `hasCountryBasedTimeline` both `false` on the live endpoint, matching
  `has_timeline`/`has_country_timeline` in `gallery.json`.
- **37 timelines, 26 countries, 1,390 events** in `timelines.json` /
  `timeline_events.json` — the same corrected totals as every other DXA
  gallery so far.
- **35 countries** in `countries.json`.
- **80 partners**, 22 `featured`, 0 with `item_count: 0` — the MWNF-384
  branch is inert here: no `mwnf3.museums` row has `project_id = 'WOO'`.
- **333 tags** (artist 35, dynasty 41, material 102, subject 26, type 129),
  **35 dynasties**, **208 glossary entries**.

## Slug vs. legacy link

The site slug is `woodwork` (kebab-case), the npm package
`@museumwnf/woodwork-data`. `gallery.json` carries the legacy value verbatim:
`slug: "furniture_and_woodwork"` (`thg_gallery.link`) — the site slug is a
shortened, chosen name, not derived from the legacy one, the same pattern as
[`communication`](communication.md#slug-vs-legacy-link).

## Known gaps

Verified during this export, none blocking:

- **70 items have an empty English (`en`) description**, out of 272
  (`translations/items.en.json` against `items.json`). 69 of them are the
  gallery's full complement of `EPM`-sourced items (69 of 69) — the same,
  already-documented importer-side gap as on carpets/coins-medals: legacy
  keeps the short text in `objects.description2`, which the importer files as
  the EPM-context translation, so an EPM-native record's only row is that
  short one and its long description is legitimately empty. The remaining 1
  is from `GalEx6` (Water in Islam), out of 24 members from that project —
  like the `GalEx5` remainder on [`communication`](communication.md), this
  project's connection to the EPM short-description rule was not established
  during this export and is recorded as an open question: item id
  `e144c07e-081a-52eb-91fc-9fd067a8b179`.
- **No item is missing an English title.** All 272 items resolve a
  non-empty `name` in `translations/items.en.json`.
- **EPM author attribution** — same importer-side gap as carpets/coins-medals:
  `preparedBy`/`copyEditedBy` file only onto the Arabic row for EPM items, so
  `author`/`copy_editor` are absent from the English translation of the 69
  EPM-sourced records here too. Not re-verified item by item on this site.
- **`notice` and `notice_c`** are not imported, per the standing rule
  documented on carpets/coins-medals; not specifically re-checked here.

## Package contents

Same shape as [`carpets`](carpets.md#package-contents) and
[`coins-medals`](coins-medals.md#package-contents) — see either for the full
file list and what each holds. Nothing about the package shape is different
here.
