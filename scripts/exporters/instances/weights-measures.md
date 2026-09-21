# Weights and Measures (instance weights-measures)

The package `@museumwnf/weights-measures-data` is produced by
[`dxa-gallery`](../dxa-gallery/README.md) from
[`weights-measures.json`](weights-measures.json) next to this file — see
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md)
for the package specification and
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://weights-measures.museumwnf.org> (`thg_gallery` 41, legacy `link`
`weights_and_measures`, mwnf3 project `WEI`). Weights and Measures is the
third of five sites of M5 wave 6
([epic #1742](https://github.com/museumwithnofrontiers/inventory-app/issues/1742)),
run through the same shared `dxa-gallery` exporter as every other gallery
site.

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **23 member items, none of them native.** `gallery.json` carries
  `project_id: null` for `WEI` — the same curatorial-only shape as every
  other gallery site so far. `WEI` itself carries no objects, so the
  membership union resolves entirely to the link-table half. Read from
  `items.json` `project_id` against `manifest.json`'s `projects` map:
  - 11 from **Discover Islamic Art** (`ISL`)
  - 8 from **Sharing History** (`awe`)
  - 2 from **Discover Carpet Art** (`DCA`)
  - 1 from **Discover Baroque Art** (`BAR`)
  - 1 from **Explore Islamic Art Collections** (`EPM`)
- **Languages: 4 site languages (ar/en/es/fr), 6 languages overall**
  (`languages.json`). The extra two (cs/it) are carried by borrowed
  records. Item translations exist in all 6
  (`translations/items.{ar,cs,en,es,fr,it}.json`).
- **`gallery.json`: `featured: false`, `hidden: false`,
  `has_timeline: false`, `has_country_timeline: false`.** The live
  `/api/v2/thg/galleries/self` on `weights-measures.museumwnf.org` (fetched
  2026-09-21, one call) answers `featured: true`, `hidden: false`,
  `hasTimeline: false`, `hasCountryBasedTimeline: false` — timeline flags
  match exactly; `featured` shows the same polarity mismatch documented on
  [`carpets`](carpets.md#the-one-field-where-the-package-deliberately-differs-from-the-live-api)
  and every gallery site since. The package ships the documented meaning,
  not the live polarity.
- **37 timelines, 26 countries, 1,390 events** in `timelines.json` /
  `timeline_events.json` — the same corrected totals as every other gallery
  in this family; nothing gallery-specific about the timeline here.
- **26 countries** in `countries.json`. Verified directly: item countries
  (7) ∪ partner countries (7) ∪ timeline countries (26) = 26, the exact
  `countries.json` count — all item/partner countries here are already
  covered by the global timeline set.
- **12 partners**, 6 `featured`, 0 with `item_count: 0`.
- **53 tags** (artist 2, dynasty 7, material 21, subject 0, type 23), **6
  dynasties**, **34 glossary entries**.

## Slug vs. legacy link

`gallery.json`'s `slug` is `weights_and_measures` (`thg_gallery.link`),
which is a snake_case spelling of the site slug `weights-measures` —
essentially the same words, only the separator and hyphenation change (the
legacy value keeps "and" as a word, the site slug drops it), the same kind
of minor divergence already seen on `musical-instruments`.

## Known gaps

Verified during this export, none blocking:

- **1 item has an empty English (`en`) description**, out of 23
  (`translations/items.en.json` against `items.json`). It is the single
  `EPM`-sourced item on this site (`08ca3301-2cfe-53a2-95e4-689994740410`) —
  the already-documented EPM short-description gap (carpets/amulets/
  coins-medals and every wave-3/4 site), here at the smallest possible
  scale: exactly the one `EPM` item this gallery has.
- **No item is missing an English title.** All 23 items resolve a
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
