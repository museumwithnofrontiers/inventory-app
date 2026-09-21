# Portraits (instance portraits)

The package `@museumwnf/portraits-data` is produced by
[`dxa-gallery`](../dxa-gallery/README.md) from
[`portraits.json`](portraits.json) next to this file — see
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md)
for the package specification and
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://portraits.museumwnf.org> (`thg_gallery` 31, legacy `link`
`portraits`, mwnf3 project `POT`). Portraits is the sixth and last site of
M5 wave 4
([epic #1740](https://github.com/museumwithnofrontiers/inventory-app/issues/1740)),
run through the same shared `dxa-gallery` exporter as every other gallery
site.

**Project-code note (epic #1740 key fact).** The wave-4 census flagged
`portraits` with an unresolved project-code note, `POT(?)/dup name`, and
asked this wave to verify the actual code during the lookup step rather
than assume the placeholder. The lookup command (step 1) resolves by UUID
alone and does not itself return a project code, but the export in step 2
does: `dxa-gallery`'s own console output reports `Gallery: portraits
(project POT)`, and `gallery.json`'s `mwnf3_project_id` is `"POT"` with no
ambiguity or duplicate resolution encountered. The census placeholder is
resolved: the code is `POT`.

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **259 member items, none of them native.** `gallery.json` carries
  `project_id: null` for `POT` — the same curatorial-only shape as every
  other wave-4 site. `POT` itself carries no objects, so the membership
  union resolves entirely to the link-table half. Read from `items.json`
  `project_id` against `manifest.json`'s `projects` map:
  - 172 from **Sharing History** (project key `awe`)
  - 46 from **Discover Baroque Art** (`BAR`)
  - 30 from **Explore Islamic Art Collections** (`EPM`)
  - 5 from **Discover Carpet Art** (`DCA`)
  - 3 from **Discover Glass Art** (`DGA`)
  - 2 from **The Hijaz Railway** (`GalEx5`)
  - 1 from **Discover Islamic Art** (`ISL`)
- **Languages: 4 site languages (ar/en/es/fr), 10 languages overall**
  (`languages.json` — the widest spread of any wave-4 site, the only one
  carrying `el` (Greek) via a borrowed record). Item translations exist in
  9 of the 10 (`translations/items.{ar,cs,de,el,en,es,fr,it,pt}.json` — no
  `tr` row for any of these 259 items specifically).
- **`gallery.json`: `featured: false`, `hidden: false`,
  `has_timeline: false`, `has_country_timeline: false`.** The live
  `/api/v2/thg/galleries/self` on `portraits.museumwnf.org` (fetched
  2026-09-21, one call) answers `featured: true`, `hidden: false`,
  `hasTimeline: false`, `hasCountryBasedTimeline: false` — timeline flags
  match exactly; `featured` shows the same polarity mismatch documented on
  [`carpets`](carpets.md#the-one-field-where-the-package-deliberately-differs-from-the-live-api)
  and every other wave-4 site. The package ships the documented meaning,
  not the live polarity.
- **37 timelines, 26 countries, 1,390 events** in `timelines.json` /
  `timeline_events.json` — the same corrected totals as every other gallery
  in this family; nothing gallery-specific about the timeline here.
- **35 countries** in `countries.json`. Verified directly: item countries
  (29) ∪ partner countries (29) ∪ timeline countries (26) = 35, the exact
  `countries.json` count.
- **66 partners**, 8 `featured`, 0 with `item_count: 0`.
- **195 tags** (artist 80, dynasty 7, material 53, subject 16, type 39),
  **6 dynasties**, **88 glossary entries**.

## Slug vs. legacy link

`gallery.json`'s `slug` is `portraits`, which is already the site slug —
the two coincide here, the same as `carpets`, `mosaics`, `paintings`,
`photographs` and `porcelain`. All six wave-4 sites happen to have a slug
that coincides with the legacy link; none needed the underscore-to-hyphen
remark except `musical-instruments`.

## Known gaps

Verified during this export, none blocking:

- **31 items have an empty English (`en`) description**, out of 259
  (`translations/items.en.json` against `items.json`). Checked against
  `project_id`: 30 of the 31 are all 30 `EPM`-sourced items — the
  already-documented EPM short-description gap (carpets/amulets/coins-medals/
  mosaics/musical-instruments/paintings/photographs/porcelain). The 1
  remaining is from `Discover Glass Art` (`DGA`), the same project that
  contributed an unexplained outlier on `musical-instruments`; not
  investigated further here. First ten ids (of the 31, unfiltered):
  `2f2d6f96-e497-5489-ae20-7c7ca9950d9b`,
  `1a28e275-5d29-5396-afed-1d35fe8bd656`,
  `2fa5a8ab-1373-5032-9bc1-fd24f3282bbf`,
  `21d2fd52-ed06-5897-a1ce-fe2e55d7e878`,
  `0e6e6bac-3e5d-5bc0-b143-7f8c186c37a6`,
  `e189b316-270d-52f6-bc71-843ad7287741`,
  `be995e66-cbb2-5c08-8546-d64d8f9a6fa0`,
  `b38891de-f49d-5dd2-b4f0-dec5aad2f1bf`,
  `1313c11f-d35a-5fba-85ac-6b580ca2b754`,
  `2f43e6b1-762a-5338-b352-7d38a498d393`.
- **No item is missing an English title.** All 259 items resolve a
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
