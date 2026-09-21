# Funerary Objects (instance funerary-objects)

The package `@museumwnf/funerary-objects-data` is produced by
[`dxa-gallery`](../dxa-gallery/README.md) from
[`funerary-objects.json`](funerary-objects.json) next to this file — see
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md)
for the package specification and
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://funerary-objects.museumwnf.org> (`thg_gallery` 16, legacy `link`
`funerary_objects`, mwnf3 project `FUN`). Part of M5 wave 2
([epic #1738](https://github.com/museumwithnofrontiers/inventory-app/issues/1738)),
exported through the same shared `dxa-gallery` exporter as every other
gallery site.

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **58 member items, none of them native.** `FUN` itself carries no objects —
  a curatorial-only project, the same shape as
  [`coins-medals`](coins-medals.md) and [`communication`](communication.md).
  Read from `items.json` `project_id` against `manifest.json`'s `projects`
  map:
  - 35 from **Discover Islamic Art** (`ISL`)
  - 10 from **Explore Islamic Art Collections** (`EPM`)
  - 8 from **Sharing History** (`awe`)
  - 5 from **Discover Baroque Art** (`BAR`)
- **Languages: 4 site languages (ar/en/es/fr), 8 languages overall**
  (`languages.json`).
- **`gallery.json`: `featured: false`, `hidden: false`.** The live
  `/api/v2/thg/galleries/self` (fetched 2026-09-21, one call) answers
  `featured: true`, `hidden: false` — the same documented polarity mismatch
  as [`communication`](communication.md#numbers-from-the-staging-export-2026-09-21---base-url-httpsinventorymetanulleu).
  `hasTimeline`/`hasCountryBasedTimeline` both `false` on the live endpoint,
  matching `has_timeline`/`has_country_timeline` in `gallery.json`.
- **37 timelines, 26 countries, 1,390 events** in `timelines.json` /
  `timeline_events.json` — the same corrected totals as every other DXA
  gallery so far, confirming the global-timeline merge applies unchanged to
  this instance.
- **28 countries** in `countries.json`.
- **31 partners**, 11 `featured`, 0 with `item_count: 0` — the MWNF-384
  branch is inert here: no `mwnf3.museums` row has `project_id = 'FUN'`.
- **88 tags** (artist 3, dynasty 23, material 32, subject 3, type 27), **20
  dynasties**, **107 glossary entries**.

## Slug vs. legacy link

The site slug is `funerary-objects` (kebab-case), the npm package
`@museumwnf/funerary-objects-data`. `gallery.json` carries the legacy value
verbatim: `slug: "funerary_objects"` (`thg_gallery.link`, underscore rather
than hyphen) — a smaller divergence than [`communication`](communication.md#slug-vs-legacy-link),
but still a divergence: the site slug does not derive from the legacy one.

## Known gaps

Verified during this export, none blocking:

- **10 items have an empty English (`en`) description**, out of 58
  (`translations/items.en.json` against `items.json`), and all 10 are the
  gallery's full complement of `EPM`-sourced items (10 of 10) — the same,
  already-documented importer-side gap as on carpets/coins-medals: legacy
  keeps the short text in `objects.description2`, which the importer files as
  the EPM-context translation, so an EPM-native record's only row is that
  short one and its long description is legitimately empty. Unlike
  [`communication`](communication.md), the EPM rule explains the gap
  completely here — no unexplained remainder.
- **No item is missing an English title.** All 58 items resolve a
  non-empty `name` in `translations/items.en.json`.
- **EPM author attribution** — same importer-side gap as carpets/coins-medals:
  `preparedBy`/`copyEditedBy` file only onto the Arabic row for EPM items, so
  `author`/`copy_editor` are absent from the English translation of the 10
  EPM-sourced records here too. Not re-verified item by item on this site.
- **`notice` and `notice_c`** are not imported, per the standing rule
  documented on carpets/coins-medals; not specifically re-checked here.

## Package contents

Same shape as [`carpets`](carpets.md#package-contents) and
[`coins-medals`](coins-medals.md#package-contents) — see either for the full
file list and what each holds. Nothing about the package shape is different
here.
