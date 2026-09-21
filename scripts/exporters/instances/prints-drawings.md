# Prints and Drawings (instance prints-drawings)

The package `@museumwnf/prints-drawings-data` is produced by
[`dxa-gallery`](../dxa-gallery/README.md) from
[`prints-drawings.json`](prints-drawings.json) next to this file — see
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md)
for the package specification and
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://prints-drawings.museumwnf.org> (`thg_gallery` 32, legacy `link`
`prints_and_drawings`, mwnf3 project `PRI`). Prints and Drawings is the
first gallery of M5 wave 5
([epic #1741](https://github.com/museumwithnofrontiers/inventory-app/issues/1741)),
generated through the same shared `dxa-gallery` exporter as every other
gallery site — there is no fork for this one.

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **684 member items, none of them native.** `PRI` itself carries no
  objects — a curatorial-only project, the same shape as
  [`coins-medals`](coins-medals.md#numbers-from-the-staging-export-2026-09-21---base-url-httpsinventorymetanulleu)
  and [`amulets`](amulets.md) rather than
  [`carpets`](carpets.md#carpets-is-the-hybrid-gallery). The membership
  union (items of the gallery's own project OR items listed in the
  `thg_gallery_*` link tables) resolves entirely to the second half here.
  Read from `items.json` `project_id` against `manifest.json`'s `projects`
  map:
  - 596 from **Sharing History** (project key `awe`)
  - 29 from **The Hijaz Railway** (a project with no `site_url`/
    `related_database_url` in `manifest.json`)
  - 24 from **Discover Baroque Art** (`BAR`)
  - 22 from **Explore Islamic Art Collections** (`EPM`)
  - 4 from **Water in Islam**
  - 4 from **Discover Islamic Art** (`ISL`)
  - 3 from **Discover Carpet Art** (`DCA`)
  - 1 from **Discover Glass Art** (`DGA`)
  - 1 from **MWNF Galleries** (the cross-gallery curatorial project)
- **Languages: 4 site languages (ar/en/es/fr), 9 languages overall**
  (`languages.json`). The extra five (cs/de/it/pt/tr) are carried by
  borrowed records from source projects that hold text in those languages;
  the site itself displays only ar/en/es/fr, matching the collection
  languages resolved in step 1. Item translations exist in 8 of the 9
  (`translations/items.{ar,cs,en,es,fr,it,pt,tr}.json` — no `de` row for
  any of these 684 items specifically).
- **`gallery.json`: `featured: false`, `hidden: false`.** The live
  `/api/v2/thg/galleries/self` (fetched 2026-09-21, one call) answers
  `featured: true`, `hidden: false` — the same polarity mismatch documented
  on [`carpets`](carpets.md#the-one-field-where-the-package-deliberately-differs-from-the-live-api),
  [`amulets`](amulets.md) and [`coins-medals`](coins-medals.md): `dxa-api`
  copies the `hidden` projection into `featured` without flipping it. The
  package ships the documented meaning. `hasTimeline`/`hasCountryBasedTimeline`
  both `false` on the live endpoint, matching `has_timeline`/
  `has_country_timeline` in `gallery.json`.
- **37 timelines, 26 countries, 1,390 events** in `timelines.json` /
  `timeline_events.json` — the same corrected totals as carpets, amulets
  and coins-medals, confirming the global-timeline merge applies unchanged
  to this instance; nothing gallery-specific about the timeline here.
- **31 countries** in `countries.json`, read directly from the export log
  (not independently re-derived as a set union for this site).
- **85 partners**, 3 `featured`, 0 with `item_count: 0` — the MWNF-384
  "museum created under the gallery's own project but holding nothing"
  branch is present in the exporter but inert on this site: no
  `mwnf3.museums` row has `project_id = 'PRI'`.
- **408 tags** (artist 228, dynasty 6, material 65, subject 18, type 91),
  **5 dynasties**, **119 glossary entries**.

## Slug vs. legacy link

The site slug is `prints-drawings` (kebab-case, per decision Q4), the npm
package `@museumwnf/prints-drawings-data`. `gallery.json` carries the legacy
value verbatim: `slug: "prints_and_drawings"` (`thg_gallery.link`) — the
site slug drops "and", the same way `coins-medals` drops it from
`coins_and_medals`; data values keep legacy identity as-is, the site slug
does not derive from it.

## Known gaps

Verified during this export, none blocking:

- **31 items have an empty English (`en`) description**, out of 684
  (`translations/items.en.json` against `items.json`). All 22 of the
  `EPM` (Explore Islamic Art Collections)-sourced items are among them —
  the same, already-documented importer-side gap as on carpets, amulets
  and coins-medals: legacy keeps the short text in `objects.description2`,
  which the importer files as the EPM-context translation, so an
  EPM-native record's only row is that short one and its long description
  is legitimately empty. The other 9 are 5 from `GalEx5` (The Hijaz
  Railway) and 4 from `awe` (Sharing History); these projects' connection
  to the EPM short-description rule was not established during this
  export, so they are recorded here as an open question rather than an
  explained pattern: item ids `13caa9ac-5165-5334-9cdf-31b3219e01b9`,
  `270df30e-d695-5d3a-90a4-7dc1c7724043`,
  `2ab573cd-8e69-51f0-8275-3af031e2fa06`,
  `3729e16c-4e7e-5f2a-ab2f-106e9ada1d33`,
  `447b3071-8472-521a-b586-24ed31569284`,
  `8f457f6a-6cb0-596d-bc20-07d4baa579f5`,
  `91e561d2-6530-5965-bd21-e1a70b9ef590`,
  `a7580d59-2cc3-599d-bd19-8d4d84fa37af`,
  `e9b3ea92-3a5f-5e88-8c8b-35360ed3d3f2`.
- **No item is missing an English title.** All 684 items resolve a
  non-empty `name` in `translations/items.en.json`.
- **EPM author attribution** — same importer-side gap as
  carpets/amulets/coins-medals: `preparedBy`/`copyEditedBy` file only onto
  the Arabic row for EPM items, so `author`/`copy_editor` are absent from
  the English translation of an EPM-sourced record here too. Not
  re-verified item by item on this site; recorded because the same 22
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
