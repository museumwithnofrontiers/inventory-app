# Communication and Transportation (instance communication)

The package `@museumwnf/communication-data` is produced by
[`dxa-gallery`](../dxa-gallery/README.md) from
[`communication.json`](communication.json) next to this file — see
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md)
for the package specification and
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://communication.museumwnf.org> (`thg_gallery` 14, legacy `link`
`communication_and_transportation`, mwnf3 project `COM`). Communication and
Transportation is the first of the five wave-2 galleries
([epic #1738](https://github.com/museumwithnofrontiers/inventory-app/issues/1738),
following [wave 1](https://github.com/museumwithnofrontiers/inventory-app/issues/1737)
and its [`coins-medals`](coins-medals.md) run), exported through the same
shared `dxa-gallery` exporter as every other gallery site.

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **126 member items, none of them native.** `COM` itself carries no objects
  — it is a curatorial-only project, the same shape as
  [`coins-medals`](coins-medals.md) (100 items, all borrowed) — so the
  membership union resolves entirely to items of the six `thg_gallery_*` link
  tables. Read from `items.json` `project_id` against `manifest.json`'s
  `projects` map:
  - 99 from **Sharing History** (project key `awe`)
  - 16 from **The Hijaz Railway** (`GalEx5`)
  - 5 from **Explore Islamic Art Collections** (`EPM`)
  - 3 from **Discover Baroque Art** (`BAR`)
  - 2 from **MWNF Galleries** (the cross-gallery curatorial project)
  - 1 from **Discover Islamic Art** (`ISL`)
- **Languages: 4 site languages (ar/en/es/fr), 8 languages overall**
  (`languages.json`). The extra four (de/it/pt/tr) are carried by borrowed
  records from source projects that hold text in those languages.
- **`gallery.json`: `featured: false`, `hidden: false`.** The live
  `/api/v2/thg/galleries/self` (fetched 2026-09-21, one call) answers
  `featured: true`, `hidden: false` — the same `featured`/`hidden` polarity
  mismatch documented on [`carpets`](carpets.md) and [`coins-medals`](coins-medals.md):
  `dxa-api` copies the `hidden` projection into `featured` without flipping
  it, so a record stored `featured = 'H'` reads back `true` on the live site.
  The package ships the documented meaning. `hasTimeline`/
  `hasCountryBasedTimeline` both `false` on the live endpoint, matching
  `has_timeline`/`has_country_timeline` in `gallery.json`.
- **37 timelines, 26 countries, 1,390 events** in `timelines.json` /
  `timeline_events.json` — the same corrected totals as carpets and
  coins-medals, confirming the global-timeline merge applies unchanged to
  this instance.
- **28 countries** in `countries.json`.
- **35 partners**, 1 `featured`, 0 with `item_count: 0` — the MWNF-384
  branch (a museum created under the gallery's own project but holding
  nothing) is inert here: no `mwnf3.museums` row has `project_id = 'COM'`.
- **124 tags** (artist 19, dynasty 2, material 37, subject 3, type 63), **2
  dynasties**, **40 glossary entries**.

## Slug vs. legacy link

The site slug is `communication` (kebab-case), the npm package
`@museumwnf/communication-data`. `gallery.json` carries the legacy value
verbatim: `slug: "communication_and_transportation"` (`thg_gallery.link`) —
data values keep legacy identity as-is, the site slug does not derive from
it. Same pattern as [`coins-medals`](coins-medals.md#slug-vs-legacy-link)
(`coins-medals` vs. legacy `coins_and_medals`), not like carpets where the
two happen to coincide.

## Known gaps

Verified during this export, none blocking:

- **9 items have an empty English (`en`) description**, out of 126
  (`translations/items.en.json` against `items.json`). 5 of them are the
  gallery's full complement of `EPM`-sourced items (5 of 5) — the same,
  already-documented importer-side gap as on carpets/coins-medals: legacy
  keeps the short text in `objects.description2`, which the importer files as
  the EPM-context translation, so an EPM-native record's only row is that
  short one and its long description is legitimately empty. The other 4 are
  from `GalEx5` (The Hijaz Railway), out of 16 members from that project —
  not the whole complement this time, so (as on coins-medals) this project's
  connection to the EPM short-description rule remains an open question
  rather than an explained pattern; item ids
  `91e561d2-6530-5965-bd21-e1a70b9ef590`,
  `a7580d59-2cc3-599d-bd19-8d4d84fa37af`,
  `447b3071-8472-521a-b586-24ed31569284` and
  `fe87deef-c455-5755-9f18-175550fef06e`.
- **No item is missing an English title.** All 126 items resolve a
  non-empty `name` in `translations/items.en.json`.
- **EPM author attribution** — same importer-side gap as carpets/coins-medals:
  `preparedBy`/`copyEditedBy` file only onto the Arabic row for EPM items, so
  `author`/`copy_editor` are absent from the English translation of the 5
  EPM-sourced records here too. Not re-verified item by item on this site.
- **`notice` and `notice_c`** are not imported, per the standing rule
  documented on carpets/coins-medals; not specifically re-checked here.

## Package contents

Same shape as [`carpets`](carpets.md#package-contents) and
[`coins-medals`](coins-medals.md#package-contents) — see either for the full
file list and what each holds. Nothing about the package shape is different
here.
