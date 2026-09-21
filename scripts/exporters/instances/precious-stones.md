# Precious Stones (instance precious-stones)

The package `@museumwnf/precious-stones-data` is produced by
[`dxa-gallery`](../dxa-gallery/README.md) from
[`precious-stones.json`](precious-stones.json) next to this file — see
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md)
for the package specification and
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://precious-stones.museumwnf.org> (`thg_gallery` 46, legacy `link`
`precious_stones`, mwnf3 project `PRS`). Precious Stones is the fourth of
five sites of M5 wave 6
([epic #1742](https://github.com/museumwithnofrontiers/inventory-app/issues/1742)),
run through the same shared `dxa-gallery` exporter as every other gallery
site.

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **80 member items, none of them native.** `gallery.json` carries
  `project_id: null` for `PRS` — the same curatorial-only shape as every
  other gallery site so far. `PRS` itself carries no objects, so the
  membership union resolves entirely to the link-table half. Read from
  `items.json` `project_id` against `manifest.json`'s `projects` map:
  - 40 from **Explore Islamic Art Collections** (`EPM`)
  - 22 from **Sharing History** (`awe`)
  - 7 from **Discover Baroque Art** (`BAR`)
  - 6 from **The Table Is Set** (`EXTHE`, a sub-collection project exported
    the same way as any other source project)
  - 5 from **Discover Islamic Art** (`ISL`)
- **Languages: 1 site language (en), 10 languages overall**
  (`languages.json`) — this is the only gallery in this wave (and the only
  one seen so far in the family) whose collection resolves a single site
  language; `manifest.site.names` and `gallery.json`'s `names` both carry
  only `en`. The ten overall languages are the widest spread of any gallery
  site to date, the only one carrying both `el` (Greek) and `cs` (Czech) via
  borrowed records. Item translations exist in 9 of the 10
  (`translations/items.{ar,cs,de,el,en,es,fr,pt,tr}.json` — no `it` row for
  any of these 80 items specifically).
- **`gallery.json`: `featured: true`, `hidden: false`,
  `has_timeline: false`, `has_country_timeline: false`.** The live
  `/api/v2/thg/galleries/self` on `precious-stones.museumwnf.org` (fetched
  2026-09-21, one call) answers `featured: false`, `hidden: false`,
  `hasTimeline: false`, `hasCountryBasedTimeline: false` — timeline flags
  match exactly; `featured` shows the same polarity mismatch documented on
  [`carpets`](carpets.md#the-one-field-where-the-package-deliberately-differs-from-the-live-api)
  and every gallery site since. The package ships the documented meaning,
  not the live polarity.
- **37 timelines, 26 countries, 1,390 events** in `timelines.json` /
  `timeline_events.json` — the same corrected totals as every other gallery
  in this family; nothing gallery-specific about the timeline here.
- **30 countries** in `countries.json`. Verified directly: item countries
  (21) ∪ partner countries (21) ∪ timeline countries (26) = 30, the exact
  `countries.json` count.
- **33 partners**, 7 `featured`, 0 with `item_count: 0`.
- **172 tags** (artist 7, dynasty 15, material 73, subject 7, type 70), **11
  dynasties**, **80 glossary entries** — the largest tag and glossary
  vocabulary of any gallery site in this wave, matching its status as the
  largest gallery by member count.

## Slug vs. legacy link

`gallery.json`'s `slug` is `precious_stones` (`thg_gallery.link`), the site
slug is `precious-stones` — the same words, only the separator changes
(underscore to hyphen), the same pattern as `carpets` and `portraits` where
the two effectively coincide.

## Known gaps

Verified during this export, none blocking:

- **40 items have an empty English (`en`) description**, out of 80
  (`translations/items.en.json` against `items.json`) — exactly all 40
  `EPM`-sourced items, and no other project contributes an empty one. The
  already-documented EPM short-description gap (carpets/amulets/coins-medals
  and every wave-3/4 site), here fully explaining the gap with no leftover
  unexplained ids, unlike `wallpaintings` and `toys-games` in this same
  wave. First ten ids (of the 40, unfiltered):
  `6157df5e-6cc0-55c3-aebb-5ece5ba7125c`,
  `8d8c5f2e-d3b1-529b-a940-467fd99dbff4`,
  `5943d086-8f06-5599-b296-53872c11efdd`,
  `2b78a938-ee55-5c81-860a-2ddf99017600`,
  `bb98e522-f646-5d72-a9f4-01e1cce27fbd`,
  `9f6f6d17-a330-58b4-8043-735c770a690a`,
  `9acacc6d-17be-5ff9-92a2-a820a66feee1`,
  `0f2fd351-f23b-5e56-9d5a-58ba529c43c4`,
  `ee99bbff-609f-58a9-adcd-bf128d8a3453`,
  `1313c11f-d35a-5fba-85ac-6b580ca2b754`.
- **No item is missing an English title.** All 80 items resolve a
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
