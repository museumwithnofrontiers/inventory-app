# Theatre (instance theatre)

The package `@museumwnf/theatre-data` is produced by
[`dxa-gallery`](../dxa-gallery/README.md) from
[`theatre.json`](theatre.json) next to this file — see
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md)
for the package specification and
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://theatre.museumwnf.org> (`thg_gallery` 38, legacy `link`
`theatre`, mwnf3 project `THE`). Theatre is the sixth and last gallery of
M5 wave 5
([epic #1741](https://github.com/museumwithnofrontiers/inventory-app/issues/1741)),
generated through the same shared `dxa-gallery` exporter as every other
gallery site — there is no fork for this one.

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **28 member items, none of them native — the smallest gallery in this
  wave.** `THE` itself carries no objects — a curatorial-only project, the
  same shape as
  [`coins-medals`](coins-medals.md#numbers-from-the-staging-export-2026-09-21---base-url-httpsinventorymetanulleu)
  and every other gallery in this wave, rather than
  [`carpets`](carpets.md#carpets-is-the-hybrid-gallery). The membership
  union (items of the gallery's own project OR items listed in the
  `thg_gallery_*` link tables) resolves entirely to the second half here.
  Read from `items.json` `project_id` against `manifest.json`'s `projects`
  map:
  - 17 from **Sharing History** (project key `awe`)
  - 10 from **Discover Baroque Art** (`BAR`)
  - 1 from **Explore Islamic Art Collections** (`EPM`)
- **Languages: 4 site languages (ar/en/es/fr), 7 languages overall**
  (`languages.json`). The extra three (cs/it/pt) are carried by borrowed
  records from source projects that hold text in those languages.
  Item translations exist in only 6 of the 7
  (`translations/items.{ar,cs,en,fr,it,pt}.json`) — **no `items.es.json`
  at all**, unlike every other gap in this wave, which was always one of
  the extra (non-site) languages. Spanish is one of this site's own 4
  display languages, so a Spanish visitor gets zero item translations on
  every one of these 28 items; worth flagging to the gallery epic as
  something more than the usual EPM/borrowed-record gap.
- **`gallery.json`: `featured: false`, `hidden: false`.** The live
  `/api/v2/thg/galleries/self` (fetched 2026-09-21, one call) answers
  `featured: true`, `hidden: false` — the same polarity mismatch as every
  other gallery in this estate except textiles (which carries the
  hand-picked `featured = 'A'` record and so runs the comparison the other
  way): `dxa-api` copies the `hidden` projection into `featured` without
  flipping it. The package ships the documented meaning.
  `hasTimeline`/`hasCountryBasedTimeline` both `false` on the live
  endpoint, matching `has_timeline`/`has_country_timeline` in
  `gallery.json`.
- **37 timelines, 26 countries, 1,390 events** in `timelines.json` /
  `timeline_events.json` — the same corrected totals as every other DXA
  gallery site in this estate, confirming the global-timeline merge applies
  unchanged to this instance; nothing gallery-specific about the timeline
  here.
- **27 countries** in `countries.json`, read directly from the export log
  (not independently re-derived as a set union for this site).
- **11 partners**, 3 `featured`, 0 with `item_count: 0` — the MWNF-384
  "museum created under the gallery's own project but holding nothing"
  branch is present in the exporter but inert on this site: no
  `mwnf3.museums` row has `project_id = 'THE'`.
- **69 tags** (artist 18, dynasty 0, material 28, subject 5, type 18),
  **0 dynasties** (the exporter logs this as a warning, `⚠ dynasties.json
  (0 — no member item references a dynasty)`, and still writes an empty
  array — not an error, just the smallest gallery in the wave having no
  dynasty-tagged item), **4 glossary entries** — also the smallest of any
  gallery in this wave on every one of these counts.

## Known gaps

Verified during this export, none blocking:

- **1 item has an empty English (`en`) description**, out of 28
  (`translations/items.en.json` against `items.json`) — the site's single
  `EPM` (Explore Islamic Art Collections)-sourced item, exactly matching
  its full EPM membership: the same, already-documented importer-side gap
  as on carpets, amulets, coins-medals and every other gallery in this
  wave. Legacy keeps the short text in `objects.description2`, which the
  importer files as the EPM-context translation, so an EPM-native record's
  only row is that short one and its long description is legitimately
  empty.
- **No item is missing an English title.** All 28 items resolve a
  non-empty `name` in `translations/items.en.json`.
- **No `items.es.json` translation file at all**, see above — distinct
  from the EPM short-description gap and not explained by it; the site's
  own project (`THE`) and its two borrowed source projects (`awe`, `BAR`)
  simply carry no Spanish text for any of these 28 items.
- **EPM author attribution** — same importer-side gap as every other
  gallery instance in this estate: `preparedBy`/`copyEditedBy` file only
  onto the Arabic row for EPM items, so `author`/`copy_editor` are absent
  from the English translation of an EPM-sourced record here too. Not
  re-verified item by item on this site; recorded because the site's
  single EPM-sourced item above is the likely carrier.
- **`notice` and `notice_c`** are not imported, per the standing rule
  documented on carpets/amulets/coins-medals; not specifically re-checked
  on this site.

## Package contents

Same shape as [`carpets`](carpets.md#package-contents),
[`amulets`](amulets.md#package-contents) and
[`coins-medals`](coins-medals.md#package-contents) — see any for the full
file list and what each holds. Nothing about the package shape is
different here.
