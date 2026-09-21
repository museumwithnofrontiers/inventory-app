# Religious Life (instance religious-life)

The package `@museumwnf/religious-life-data` is produced by
[`dxa-gallery`](../dxa-gallery/README.md) from
[`religious-life.json`](religious-life.json) next to this file — see
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md)
for the package specification and
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://religious-life.museumwnf.org> (`thg_gallery` 33, legacy `link`
`religious_life`, mwnf3 project `REL`). Religious Life is the second
gallery of M5 wave 5
([epic #1741](https://github.com/museumwithnofrontiers/inventory-app/issues/1741)),
generated through the same shared `dxa-gallery` exporter as every other
gallery site — there is no fork for this one.

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **323 member items, none of them native.** `REL` itself carries no
  objects — a curatorial-only project, the same shape as
  [`coins-medals`](coins-medals.md#numbers-from-the-staging-export-2026-09-21---base-url-httpsinventorymetanulleu),
  [`amulets`](amulets.md) and
  [`prints-drawings`](prints-drawings.md#numbers-from-the-staging-export-2026-09-21---base-url-httpsinventorymetanulleu)
  rather than [`carpets`](carpets.md#carpets-is-the-hybrid-gallery). The
  membership union (items of the gallery's own project OR items listed in
  the `thg_gallery_*` link tables) resolves entirely to the second half
  here. Read from `items.json` `project_id` against `manifest.json`'s
  `projects` map:
  - 86 from **Explore Islamic Art Collections** (`EPM`)
  - 66 from **Discover Carpet Art** (`DCA`)
  - 56 from **Discover Islamic Art** (`ISL`)
  - 28 from **Discover Baroque Art** (`BAR`)
  - 28 from **MWNF Galleries** (the cross-gallery curatorial project)
  - 23 from **Sharing History** (project key `awe`)
  - 13 from **Water in Islam**
  - 10 from **The Table Is Set** (project key `EXTHE` in the export log —
    a project with no `site_url`/`related_database_url` in
    `manifest.json`)
  - 8 from **Discover Glass Art** (`DGA`)
  - 5 from **The Hijaz Railway** (`GalEx5`)
- **Languages: 4 site languages (ar/en/es/fr), 10 languages overall**
  (`languages.json`). The extra six (cs/de/el/it/pt/tr) are carried by
  borrowed records from source projects that hold text in those languages;
  the site itself displays only ar/en/es/fr, matching the collection
  languages resolved in step 1. Item translations exist in all 10
  languages here (`translations/items.{ar,cs,de,el,en,es,fr,it,pt,tr}.json`)
  — unlike prints-drawings, no language is missing an items file on this
  site.
- **`gallery.json`: `featured: false`, `hidden: false`.** The live
  `/api/v2/thg/galleries/self` (fetched 2026-09-21, one call) answers
  `featured: true`, `hidden: false` — the same polarity mismatch documented
  on [`carpets`](carpets.md#the-one-field-where-the-package-deliberately-differs-from-the-live-api),
  [`amulets`](amulets.md), [`coins-medals`](coins-medals.md) and
  [`prints-drawings`](prints-drawings.md): `dxa-api` copies the `hidden`
  projection into `featured` without flipping it. The package ships the
  documented meaning. `hasTimeline`/`hasCountryBasedTimeline` both `false`
  on the live endpoint, matching `has_timeline`/`has_country_timeline` in
  `gallery.json`.
- **37 timelines, 26 countries, 1,390 events** in `timelines.json` /
  `timeline_events.json` — the same corrected totals as every other DXA
  gallery site in this estate, confirming the global-timeline merge applies
  unchanged to this instance; nothing gallery-specific about the timeline
  here.
- **34 countries** in `countries.json`, read directly from the export log
  (not independently re-derived as a set union for this site).
- **89 partners**, 23 `featured`, 0 with `item_count: 0` — the MWNF-384
  "museum created under the gallery's own project but holding nothing"
  branch is present in the exporter but inert on this site: no
  `mwnf3.museums` row has `project_id = 'REL'`.
- **364 tags** (artist 45, dynasty 35, material 128, subject 29, type 127),
  **26 dynasties**, **200 glossary entries** — noticeably richer than
  prints-drawings on every one of these counts, consistent with the wider
  spread of source projects feeding this gallery.

## Known gaps

Verified during this export, none blocking:

- **92 items have an empty English (`en`) description**, out of 323
  (`translations/items.en.json` against `items.json`). All 86 of the
  `EPM` (Explore Islamic Art Collections)-sourced items are among them —
  the same, already-documented importer-side gap as on carpets, amulets,
  coins-medals and prints-drawings: legacy keeps the short text in
  `objects.description2`, which the importer files as the EPM-context
  translation, so an EPM-native record's only row is that short one and
  its long description is legitimately empty. The other 6 are all from
  `DGA` (Discover Glass Art) — 6 of the site's 8 DGA-sourced items. This
  project's connection to the EPM short-description rule was not
  established during this export, so it is recorded here as an open
  question rather than an explained pattern (the same kind of open
  question prints-drawings recorded for its non-EPM gaps, though a
  different source project): item ids
  `100c3cd0-799a-5feb-ac7f-8516c0d5b098`,
  `19309244-d3ba-5328-b6af-d77395f59e8e`,
  `32db9874-813f-566f-afe8-d3adcab6c80a`,
  `4ee99078-4b66-5d16-830e-595e4da0246e`,
  `90125812-6d25-5c71-907f-5f0277cdf7b9`,
  `fabf4535-e263-529b-9b2c-f09555375400`.
- **No item is missing an English title.** All 323 items resolve a
  non-empty `name` in `translations/items.en.json`.
- **EPM author attribution** — same importer-side gap as
  carpets/amulets/coins-medals/prints-drawings:
  `preparedBy`/`copyEditedBy` file only onto the Arabic row for EPM items,
  so `author`/`copy_editor` are absent from the English translation of an
  EPM-sourced record here too. Not re-verified item by item on this site;
  recorded because the same 86 EPM-sourced items above are the likely
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
