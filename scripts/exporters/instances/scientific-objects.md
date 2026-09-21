# Scientific Objects (instance scientific-objects)

The package `@museumwnf/scientific-objects-data` is produced by
[`dxa-gallery`](../dxa-gallery/README.md) from
[`scientific-objects.json`](scientific-objects.json) next to this file —
see [`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md)
for the package specification and
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://scientific-objects.museumwnf.org> (`thg_gallery` 34, legacy `link`
`scientific_objects`, mwnf3 project `SCI`). Scientific Objects is the
third gallery of M5 wave 5
([epic #1741](https://github.com/museumwithnofrontiers/inventory-app/issues/1741)),
generated through the same shared `dxa-gallery` exporter as every other
gallery site — there is no fork for this one.

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **68 member items, none of them native.** `SCI` itself carries no
  objects — a curatorial-only project, the same shape as
  [`coins-medals`](coins-medals.md#numbers-from-the-staging-export-2026-09-21---base-url-httpsinventorymetanulleu),
  [`amulets`](amulets.md), [`prints-drawings`](prints-drawings.md) and
  [`religious-life`](religious-life.md) rather than
  [`carpets`](carpets.md#carpets-is-the-hybrid-gallery). The membership
  union (items of the gallery's own project OR items listed in the
  `thg_gallery_*` link tables) resolves entirely to the second half here.
  Read from `items.json` `project_id` against `manifest.json`'s `projects`
  map:
  - 21 from **Sharing History** (project key `awe`)
  - 13 from **Discover Islamic Art** (`ISL`)
  - 12 from **Explore Islamic Art Collections** (`EPM`)
  - 8 from **Water in Islam**
  - 6 from **MWNF Galleries** (the cross-gallery curatorial project)
  - 5 from **Discover Baroque Art** (`BAR`)
  - 3 from **The Hijaz Railway** (`GalEx5`)
- **Languages: 4 site languages (ar/en/es/fr), 9 languages overall**
  (`languages.json`). The extra five (de/el/it/pt/tr) are carried by
  borrowed records from source projects that hold text in those languages;
  the site itself displays only ar/en/es/fr, matching the collection
  languages resolved in step 1. Item translations exist in 8 of the 9
  (`translations/items.{ar,el,en,es,fr,it,pt,tr}.json` — no `de` row for
  any of these 68 items specifically, the same shape as prints-drawings
  missing `de` rather than religious-life having all 10).
- **`gallery.json`: `featured: false`, `hidden: false`.** The live
  `/api/v2/thg/galleries/self` (fetched 2026-09-21, one call) answers
  `featured: true`, `hidden: false` — the same polarity mismatch documented
  on [`carpets`](carpets.md#the-one-field-where-the-package-deliberately-differs-from-the-live-api),
  [`amulets`](amulets.md), [`coins-medals`](coins-medals.md),
  [`prints-drawings`](prints-drawings.md) and
  [`religious-life`](religious-life.md): `dxa-api` copies the `hidden`
  projection into `featured` without flipping it. The package ships the
  documented meaning. `hasTimeline`/`hasCountryBasedTimeline` both `false`
  on the live endpoint, matching `has_timeline`/`has_country_timeline` in
  `gallery.json`.
- **37 timelines, 26 countries, 1,390 events** in `timelines.json` /
  `timeline_events.json` — the same corrected totals as every other DXA
  gallery site in this estate, confirming the global-timeline merge applies
  unchanged to this instance; nothing gallery-specific about the timeline
  here.
- **33 countries** in `countries.json`, read directly from the export log
  (not independently re-derived as a set union for this site).
- **40 partners**, 11 `featured`, 0 with `item_count: 0` — the MWNF-384
  "museum created under the gallery's own project but holding nothing"
  branch is present in the exporter but inert on this site: no
  `mwnf3.museums` row has `project_id = 'SCI'`.
- **111 tags** (artist 12, dynasty 15, material 43, subject 4, type 37),
  **15 dynasties**, **72 glossary entries** — the smallest gallery by
  member count in this wave, and its tag/dynasty/glossary totals scale
  with that.

## Known gaps

Verified during this export, none blocking:

- **12 items have an empty English (`en`) description**, out of 68
  (`translations/items.en.json` against `items.json`). All 12 are from the
  `EPM` (Explore Islamic Art Collections) source project — exactly the
  site's full EPM membership, so no open question is left on this site,
  unlike prints-drawings and religious-life: the same, already-documented
  importer-side gap as on carpets, amulets, coins-medals, prints-drawings
  and religious-life fully explains every empty description here. Legacy
  keeps the short text in `objects.description2`, which the importer files
  as the EPM-context translation, so an EPM-native record's only row is
  that short one and its long description is legitimately empty.
- **No item is missing an English title.** All 68 items resolve a
  non-empty `name` in `translations/items.en.json`.
- **EPM author attribution** — same importer-side gap as
  carpets/amulets/coins-medals/prints-drawings/religious-life:
  `preparedBy`/`copyEditedBy` file only onto the Arabic row for EPM items,
  so `author`/`copy_editor` are absent from the English translation of an
  EPM-sourced record here too. Not re-verified item by item on this site;
  recorded because the same 12 EPM-sourced items above are the likely
  carriers.
- **`notice` and `notice_c`** are not imported, per the standing rule
  documented on carpets/amulets/coins-medals; not specifically re-checked
  on this site.

## Package contents

Same shape as [`carpets`](carpets.md#package-contents),
[`amulets`](amulets.md#package-contents) and
[`coins-medals`](coins-medals.md#package-contents) — see any for the full
file list and what each holds. Nothing about the package shape is
different here.
