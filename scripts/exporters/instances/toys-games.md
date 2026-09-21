# Toys and Games (instance toys-games)

The package `@museumwnf/toys-games-data` is produced by
[`dxa-gallery`](../dxa-gallery/README.md) from
[`toys-games.json`](toys-games.json) next to this file — see
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md)
for the package specification and
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://toys-games.museumwnf.org> (`thg_gallery` 39, legacy `link` `toys`,
mwnf3 project `TOY`). Toys and Games is the first of five sites of M5 wave 6
([epic #1742](https://github.com/museumwithnofrontiers/inventory-app/issues/1742),
the closing gallery wave — 35 of 35 positively-identified remaining
galleries reached across all waves), run through the same shared
`dxa-gallery` exporter as every other gallery site.

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **18 member items, none of them native.** `gallery.json` carries
  `project_id: null` for `TOY` — the same curatorial-only shape as every
  other gallery site so far (coins-medals, amulets, the wave-3/4 sites).
  `TOY` itself carries no objects, so the membership union resolves entirely
  to the link-table half. Read from `items.json` `project_id` against
  `manifest.json`'s `projects` map:
  - 8 from **MWNF Galleries** (the cross-gallery curatorial project, key
    `GALLERIES`)
  - 6 from **Explore Islamic Art Collections** (`EPM`)
  - 3 from **Discover Islamic Art** (`ISL`)
  - 1 from **Sharing History** (`awe`)
- **Languages: 4 site languages (ar/en/es/fr), 5 languages overall**
  (`languages.json` — the extra one is German, carried by a borrowed
  record). Item translations exist in all 5
  (`translations/items.{ar,de,en,es,fr}.json`).
- **`gallery.json`: `featured: true`, `hidden: false`,
  `has_timeline: false`, `has_country_timeline: false`.** The live
  `/api/v2/thg/galleries/self` on `toys-games.museumwnf.org` (fetched
  2026-09-21, one call) answers `featured: false`, `hidden: false`,
  `hasTimeline: false`, `hasCountryBasedTimeline: false` — timeline flags
  match exactly; `featured` shows the same polarity mismatch documented on
  [`carpets`](carpets.md#the-one-field-where-the-package-deliberately-differs-from-the-live-api)
  and every gallery site since. The package ships the documented meaning,
  not the live polarity.
- **37 timelines, 26 countries, 1,390 events** in `timelines.json` /
  `timeline_events.json` — the same corrected totals as every other gallery
  in this family; nothing gallery-specific about the timeline here.
- **28 countries** in `countries.json`. Verified directly: item countries
  (8) ∪ partner countries (8) ∪ timeline countries (26) = 28, the exact
  `countries.json` count.
- **11 partners**, 5 `featured`, 0 with `item_count: 0`.
- **46 tags** (artist 0, dynasty 4, material 23, subject 3, type 16), **6
  dynasties**, **19 glossary entries**.

## Slug vs. legacy link

`gallery.json`'s `slug` is `toys` (`thg_gallery.link`), while the site slug
is `toys-games` — the two differ, the legacy link being the shorter,
project-code-derived name. Same pattern as `amulets` (`amulets` vs.
`amulets_and_talismans`) and `coins-medals` (`coins-medals` vs.
`coins_and_medals`): the site slug does not derive from the legacy value,
it is chosen independently per decision Q4.

## Known gaps

Verified during this export, none blocking:

- **14 items have an empty English (`en`) description**, out of 18
  (`translations/items.en.json` against `items.json`). Checked against
  `project_id`: all 6 `EPM`-sourced items are empty — the already-documented
  EPM short-description gap (carpets/amulets/coins-medals and every wave-3/4
  site). The remaining 8 are all 8 of the `GALLERIES`-sourced items
  (MWNF Galleries), all of them "Ankara Toy Museum" holdings that carry only
  a `short_description`, never a `description` — a different source project
  than the EPM pattern, not investigated further here (the same `GALLERIES`
  project contributes 109 items to `historical-cars` in this same wave,
  where only 3 of the 109 are empty, so this is not a project-wide rule,
  more likely a per-museum submission style). Ids:
  `d1a1829f-11e0-56f9-9315-ca94e69bdac5`,
  `1b55ef6a-0fb1-56d2-9274-4f0775c2cee9`,
  `9c9213a8-28c2-5a2e-b2db-b4b6a1e7014f`,
  `965d893b-685b-5fcf-8f0b-b3d64f9e1987`,
  `72a4f210-e9af-568c-82cb-538110bc11c0`,
  `fc54f94b-2c73-539f-9c72-9e5bbc3cae2d`,
  `1253b43a-cd2e-5d3d-839d-a3df5d64f832`,
  `033f1b07-bd92-54f1-abb1-d9d9b6f90d82`,
  `69a6a526-4050-5ca0-8cb5-fc33c761bad0`,
  `4dac9fe7-2ec6-5370-a44d-11f8743530fb`
  (10 of 14 shown, per the note-writing limit).
- **No item is missing an English title.** All 18 items resolve a
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
