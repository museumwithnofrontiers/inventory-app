# Musical Instruments (instance musical-instruments)

The package `@museumwnf/musical-instruments-data` is produced by
[`dxa-gallery`](../dxa-gallery/README.md) from
[`musical-instruments.json`](musical-instruments.json) next to this file —
see [`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md)
for the package specification and
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://musical-instruments.museumwnf.org> (`thg_gallery` 27, legacy
`link` `musical_instruments`, mwnf3 project `MUS`). Musical Instruments is
the second site of M5 wave 4
([epic #1740](https://github.com/museumwithnofrontiers/inventory-app/issues/1740)),
run through the same shared `dxa-gallery` exporter as every other gallery
site.

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **27 member items, none of them native.** `gallery.json` carries
  `project_id: null` for `MUS` — the same curatorial-only shape as
  [`mosaics`](mosaics.md), [`amulets`](amulets.md) and
  [`coins-medals`](coins-medals.md). `MUS` itself carries no objects, so the
  membership union resolves entirely to the link-table half. Read from
  `items.json` `project_id` against `manifest.json`'s `projects` map:
  - 15 from **Sharing History** (project key `awe`)
  - 9 from **Explore Islamic Art Collections** (`EPM`)
  - 2 from **Discover Islamic Art** (`ISL`)
  - 1 from **Discover Glass Art** (`DGA`)
- **Languages: 4 site languages (ar/en/es/fr), 6 languages overall**
  (`languages.json` — the only wave-4 site so far without a `de`/`it`/`pt`
  gap; here `de` and `tr` are the two non-site languages carried by
  borrowed records). Item translations exist in all 6
  (`translations/items.{ar,de,en,es,fr,tr}.json`).
- **`gallery.json`: `featured: false`, `hidden: false`,
  `has_timeline: false`, `has_country_timeline: false`.** The live
  `/api/v2/thg/galleries/self` on `musical-instruments.museumwnf.org`
  (fetched 2026-09-21, one call) answers `featured: true`, `hidden: false`,
  `hasTimeline: false`, `hasCountryBasedTimeline: false` — timeline flags
  match exactly; `featured` shows the same polarity mismatch documented on
  [`carpets`](carpets.md#the-one-field-where-the-package-deliberately-differs-from-the-live-api),
  [`amulets`](amulets.md), [`coins-medals`](coins-medals.md) and
  [`mosaics`](mosaics.md#numbers-from-the-staging-export-2026-09-21---base-url-httpsinventorymetanulleu).
  The package ships the documented meaning, not the live polarity.
- **37 timelines, 26 countries, 1,390 events** in `timelines.json` /
  `timeline_events.json` — the same corrected totals as every other gallery
  in this family; nothing gallery-specific about the timeline here.
- **26 countries** in `countries.json`. Verified directly: item countries
  (9) ∪ partner countries (9) ∪ timeline countries (26) = 26, the exact
  `countries.json` count (the item and partner sets are entirely inside the
  timeline set here, unlike mosaics where they added one more country).
- **13 partners**, 3 `featured`, 0 with `item_count: 0`.
- **63 tags** (artist 1, dynasty 3, material 28, subject 1, type 30), **3
  dynasties**, **31 glossary entries**.

## Slug vs. legacy link

`gallery.json`'s `slug` is `musical_instruments` (`thg_gallery.link`,
underscored); the site slug is `musical-instruments` (kebab-case). The two
differ only in separator, the same pattern as
[`coins-medals`](coins-medals.md#slug-vs-legacy-link) (`coins_and_medals`
vs. `coins-medals`) — data values keep legacy identity as-is, the site slug
does not derive from it.

## Known gaps

Verified during this export, none blocking:

- **10 items have an empty English (`en`) description**, out of 27
  (`translations/items.en.json` against `items.json`):
  `a0b0c8e0-a3e5-55bb-9e5b-4ddf40ae3944`,
  `4ff776a6-3eb5-5f3e-935c-a64b779f2d12`,
  `ec25225a-5210-534c-95e7-47452cdec691`,
  `0fc10372-d4f9-5ea4-a201-8d7651379544`,
  `dafb0687-3286-55b2-ab74-0b219082d1e8`,
  `15744871-f248-53cf-8b39-f21c90b970bd`,
  `79b8cfeb-10a3-540e-9629-97e22633b9d0`,
  `57c4d2b9-c19a-5dbd-bbac-17570a133ace`,
  `61aa5d2d-8152-5e70-a44f-0e91a3eb81dc`,
  `92b4c27b-fe74-52f2-a879-77344c6edb4d`. Checked against `project_id`: 9 of
  these 10 are all 9 of the `EPM`-sourced items — the already-documented EPM
  short-description gap (carpets/amulets/coins-medals/mosaics). The 10th,
  `92b4c27b-fe74-52f2-a879-77344c6edb4d`, is from `DGA` (Discover Glass Art,
  `mwnf3:objects:DGA:uk:Mus41:9`) — this project's connection to the EPM
  rule was not established during this export, so it is recorded here as an
  open question, the same way coins-medals recorded its two `GalEx5`
  outliers.
- **No item is missing an English title.** All 27 items resolve a
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
