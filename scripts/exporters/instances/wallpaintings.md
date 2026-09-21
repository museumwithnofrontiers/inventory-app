# Wall Paintings and Frescoes (instance wallpaintings)

The package `@museumwnf/wallpaintings-data` is produced by
[`dxa-gallery`](../dxa-gallery/README.md) from
[`wallpaintings.json`](wallpaintings.json) next to this file — see
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md)
for the package specification and
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://wallpaintings.museumwnf.org> (`thg_gallery` 40, legacy `link`
`wall_paintings_and_frescoes`, mwnf3 project `WAL`). Wall Paintings and
Frescoes is the second of five sites of M5 wave 6
([epic #1742](https://github.com/museumwithnofrontiers/inventory-app/issues/1742)),
run through the same shared `dxa-gallery` exporter as every other gallery
site.

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **21 member items, none of them native.** `gallery.json` carries
  `project_id: null` for `WAL` — the same curatorial-only shape as every
  other gallery site so far. `WAL` itself carries no objects, so the
  membership union resolves entirely to the link-table half. Read from
  `items.json` `project_id` against `manifest.json`'s `projects` map:
  - 14 from **Discover Islamic Art** (`ISL`)
  - 4 from **Sharing History** (`awe`)
  - 3 from **Discover Baroque Art** (`BAR`)
- **Languages: 4 site languages (ar/en/es/fr), 8 languages overall**
  (`languages.json`). The extra four (de/it/pt/tr) are carried by borrowed
  records from source projects that hold text in those languages. Item
  translations exist in 6 of the 8
  (`translations/items.{ar,de,en,es,fr,it}.json` — no `pt` or `tr` row for
  any of these 21 items specifically).
- **`gallery.json`: `featured: false`, `hidden: false`,
  `has_timeline: false`, `has_country_timeline: false`.** The live
  `/api/v2/thg/galleries/self` on `wallpaintings.museumwnf.org` (fetched
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
  (8) ∪ partner countries (8) ∪ timeline countries (26) = 26, the exact
  `countries.json` count — all item/partner countries here are already
  covered by the global timeline set.
- **10 partners**, 5 `featured`, 0 with `item_count: 0`.
- **35 tags** (artist 2, dynasty 3, material 9, subject 13, type 8), **3
  dynasties**, **38 glossary entries**.

## Slug vs. legacy link

`gallery.json`'s `slug` is `wall_paintings_and_frescoes` (`thg_gallery.link`),
while the site slug is `wallpaintings` — the two differ, the site slug being
a shortened, no-hyphen contraction rather than a kebab-cased copy of the
legacy value. Same reasoning as `amulets` and `coins-medals`: the site slug
is chosen independently, per decision Q4, not derived from the legacy
value.

## Known gaps

Verified during this export, none blocking:

- **1 item has an empty English (`en`) description**, out of 21
  (`translations/items.en.json` against `items.json`). It is `ISL`-sourced
  (`97d73f3c-2c54-52b7-ad17-cfda861be46b`) — none of this site's items are
  `EPM`-sourced, so this is not the usual EPM short-description gap; the
  cause was not investigated further, recorded here as an open question the
  same way the Hijaz Railway outliers were recorded on coins-medals.
- **No item is missing an English title.** All 21 items resolve a
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
