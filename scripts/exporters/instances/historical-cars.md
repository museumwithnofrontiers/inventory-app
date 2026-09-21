# Historical Cars (instance historical-cars)

The package `@museumwnf/historical-cars-data` is produced by
[`dxa-gallery`](../dxa-gallery/README.md) from
[`historical-cars.json`](historical-cars.json) next to this file — see
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md)
for the package specification and
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://cars.museumwnf.org> (`thg_gallery` 49, legacy `link`
`historical_cars`, mwnf3 project `HCA`). The legacy host is `cars`, but the
wave-6 census (epic #1742) fixed the site slug at `historical-cars` rather
than `cars`, for clarity against the legacy host's own shorthand — see the
"Slug vs. legacy link" section below. Historical Cars is the fifth and last
site of M5 wave 6
([epic #1742](https://github.com/museumwithnofrontiers/inventory-app/issues/1742),
the closing gallery wave), run through the same shared `dxa-gallery`
exporter as every other gallery site. `historical-cars` already had its
`site-i18n` catalogue extracted ahead of time per the legacy census (a head
start noted in the epic for this wave's step 5, not exercised by this PR).

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **123 member items, none of them native.** `gallery.json` carries
  `project_id: null` for `HCA` — the same curatorial-only shape as every
  other gallery site so far. `HCA` itself carries no objects, so the
  membership union resolves entirely to the link-table half. Read from
  `items.json` `project_id` against `manifest.json`'s `projects` map:
  - 109 from **MWNF Galleries** (the cross-gallery curatorial project, key
    `GALLERIES`) — by far the largest single-project contribution seen in
    this wave, and the largest gallery by member count in this wave
  - 7 from **Sharing History** (`awe`)
  - 3 from **Discover Baroque Art** (`BAR`)
  - 3 from **Explore Islamic Art Collections** (`EPM`)
  - 1 from **The Table Is Set** (`EXTHE`)
- **Languages: 5 site languages (ar/de/en/es/fr), 7 languages overall**
  (`languages.json`) — the only gallery in this wave with German as a site
  language rather than only a borrowed-record extra. Item translations
  exist in 6 of the 7
  (`translations/items.{ar,de,en,es,fr,pt}.json` — no `it` row for any of
  these 123 items specifically).
- **`gallery.json`: `featured: true`, `hidden: false`,
  `has_timeline: false`, `has_country_timeline: false`.** The live
  `/api/v2/thg/galleries/self` on `cars.museumwnf.org` (fetched 2026-09-21,
  one call) answers `featured: false`, `hidden: false`, `hasTimeline: false`,
  `hasCountryBasedTimeline: false` — timeline flags match exactly;
  `featured` shows the same polarity mismatch documented on
  [`carpets`](carpets.md#the-one-field-where-the-package-deliberately-differs-from-the-live-api)
  and every gallery site since. The package ships the documented meaning,
  not the live polarity.
- **37 timelines, 26 countries, 1,390 events** in `timelines.json` /
  `timeline_events.json` — the same corrected totals as every other gallery
  in this family; nothing gallery-specific about the timeline here.
- **29 countries** in `countries.json`. Verified directly: item countries
  (13) ∪ partner countries (13) ∪ timeline countries (26) = 29, the exact
  `countries.json` count.
- **18 partners, 0 `featured`, 0 with `item_count: 0`.** This is the only
  gallery in this wave (and the only one seen so far in the family) with no
  featured partner at all; not investigated further, recorded as observed.
- **108 tags** (artist 30, dynasty 1, material 50, subject 1, type 26), **1
  dynasty**, **21 glossary entries** — the narrowest dynasty vocabulary
  (just one) of any gallery site in this wave, consistent with a modern
  collection theme (cars) having little dynastic classification to draw on.

## Slug vs. legacy link

`gallery.json`'s `slug` is `historical_cars` (`thg_gallery.link`), which is
a snake_case spelling of the site slug `historical-cars` — the words
coincide. The one real divergence is against the legacy **host**, not the
`link` value: the live site is `cars.museumwnf.org`, but the site slug
(and therefore the new repository and data-package names) is
`historical-cars`, per the resolution table in epic #1742. `historical_cars`
and `historical-cars` are the same identity; `cars` (the legacy host
shorthand) is not carried into the new architecture.

## Known gaps

Verified during this export, none blocking:

- **6 items have an empty English (`en`) description**, out of 123
  (`translations/items.en.json` against `items.json`). All 3 `EPM`-sourced
  items are among them — the already-documented EPM short-description gap
  (carpets/amulets/coins-medals and every wave-3/4 site). The other 3 are
  from `GALLERIES` (MWNF Galleries), out of 109 `GALLERIES`-sourced items on
  this site — a small minority, unlike `toys-games` in this same wave where
  all 8 `GALLERIES` items are empty; not investigated further here. Ids:
  `72a4f210-e9af-568c-82cb-538110bc11c0`,
  `a3a7e6de-6cff-51a1-9392-ab310f7efdc7`,
  `5aea6a37-19f3-5c61-ac76-f38f3922c376`,
  `148b5238-d0f6-5a73-ade6-65b1ffbc8ca4`,
  `033f1b07-bd92-54f1-abb1-d9d9b6f90d82`,
  `e8585e51-819e-5872-8973-ce808037781d`.
- **No item is missing an English title.** All 123 items resolve a
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
