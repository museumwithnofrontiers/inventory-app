# Sculptures (instance sculptures)

The package `@museumwnf/sculptures-data` is produced by
[`dxa-gallery`](../dxa-gallery/README.md) from
[`sculptures.json`](sculptures.json) next to this file — see
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md)
for the package specification and
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://sculptures.museumwnf.org> (`thg_gallery` 35, legacy `link`
`sculptures`, mwnf3 project `SCU`). Sculptures is the fourth gallery of
M5 wave 5
([epic #1741](https://github.com/museumwithnofrontiers/inventory-app/issues/1741)),
generated through the same shared `dxa-gallery` exporter as every other
gallery site — there is no fork for this one.

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **155 member items, none of them native.** `SCU` itself carries no
  objects — a curatorial-only project, the same shape as
  [`coins-medals`](coins-medals.md#numbers-from-the-staging-export-2026-09-21---base-url-httpsinventorymetanulleu),
  [`amulets`](amulets.md), [`prints-drawings`](prints-drawings.md),
  [`religious-life`](religious-life.md) and
  [`scientific-objects`](scientific-objects.md) rather than
  [`carpets`](carpets.md#carpets-is-the-hybrid-gallery). The membership
  union (items of the gallery's own project OR items listed in the
  `thg_gallery_*` link tables) resolves entirely to the second half here.
  Read from `items.json` `project_id` against `manifest.json`'s `projects`
  map:
  - 54 from **Discover Baroque Art** (`BAR`)
  - 43 from **Discover Islamic Art** (`ISL`)
  - 29 from **Sharing History** (project key `awe`)
  - 12 from **Discover Glass Art** (`DGA`)
  - 8 from **Explore Islamic Art Collections** (`EPM`)
  - 6 from **Water in Islam**
  - 2 from **MWNF Galleries** (the cross-gallery curatorial project)
  - 1 from **The Hijaz Railway** (`GalEx5`)
- **Languages: 4 site languages (ar/en/es/fr), 9 languages overall**
  (`languages.json`). The extra five (cs/de/it/pt/tr) are carried by
  borrowed records from source projects that hold text in those languages;
  the site itself displays only ar/en/es/fr, matching the collection
  languages resolved in step 1. Item translations exist in all 9 languages
  here (`translations/items.{ar,cs,de,en,es,fr,it,pt,tr}.json`) — the same
  complete shape as religious-life, unlike prints-drawings and
  scientific-objects which are each missing one.
- **`gallery.json`: `featured: false`, `hidden: false`.** The live
  `/api/v2/thg/galleries/self` (fetched 2026-09-21, one call) answers
  `featured: true`, `hidden: false` — the same polarity mismatch documented
  on [`carpets`](carpets.md#the-one-field-where-the-package-deliberately-differs-from-the-live-api)
  and every other gallery instance in this estate: `dxa-api` copies the
  `hidden` projection into `featured` without flipping it. The package
  ships the documented meaning. `hasTimeline`/`hasCountryBasedTimeline`
  both `false` on the live endpoint, matching `has_timeline`/
  `has_country_timeline` in `gallery.json`.
- **37 timelines, 26 countries, 1,390 events** in `timelines.json` /
  `timeline_events.json` — the same corrected totals as every other DXA
  gallery site in this estate, confirming the global-timeline merge applies
  unchanged to this instance; nothing gallery-specific about the timeline
  here.
- **32 countries** in `countries.json`, read directly from the export log
  (not independently re-derived as a set union for this site).
- **59 partners**, 21 `featured`, 0 with `item_count: 0` — the MWNF-384
  "museum created under the gallery's own project but holding nothing"
  branch is present in the exporter but inert on this site: no
  `mwnf3.museums` row has `project_id = 'SCU'`.
- **212 tags** (artist 58, dynasty 20, material 62, subject 24, type 48),
  **20 dynasties**, **117 glossary entries**.

## Known gaps

Verified during this export, none blocking:

- **11 items have an empty English (`en`) description**, out of 155
  (`translations/items.en.json` against `items.json`). All 8 of the `EPM`
  (Explore Islamic Art Collections)-sourced items are among them — exactly
  the site's full EPM membership, so that part is fully explained: the
  same, already-documented importer-side gap as on carpets, amulets,
  coins-medals, prints-drawings, religious-life and scientific-objects.
  Legacy keeps the short text in `objects.description2`, which the
  importer files as the EPM-context translation, so an EPM-native record's
  only row is that short one and its long description is legitimately
  empty. The other 3 are 2 from **Water in Islam** (2 of the site's 6
  Water in Islam items) and 1 from `DGA` (Discover Glass Art, 1 of the
  site's 12 DGA items); these projects' connection to the EPM
  short-description rule was not established during this export, so they
  are recorded here as an open question rather than an explained pattern:
  item ids `485104a2-c65b-5c03-9552-8fe4f6bc4b16` (Discover Glass Art),
  `cfd3dc7b-5257-57f1-9440-8273cb0c0104` (Water in Islam),
  `e144c07e-081a-52eb-91fc-9fd067a8b179` (Water in Islam).
- **No item is missing an English title.** All 155 items resolve a
  non-empty `name` in `translations/items.en.json`.
- **EPM author attribution** — same importer-side gap as every other
  gallery instance in this estate: `preparedBy`/`copyEditedBy` file only
  onto the Arabic row for EPM items, so `author`/`copy_editor` are absent
  from the English translation of an EPM-sourced record here too. Not
  re-verified item by item on this site; recorded because the same 8
  EPM-sourced items above are the likely carriers.
- **`notice` and `notice_c`** are not imported, per the standing rule
  documented on carpets/amulets/coins-medals; not specifically re-checked
  on this site.

## Package contents

Same shape as [`carpets`](carpets.md#package-contents),
[`amulets`](amulets.md#package-contents) and
[`coins-medals`](coins-medals.md#package-contents) — see any for the full
file list and what each holds. Nothing about the package shape is
different here.
