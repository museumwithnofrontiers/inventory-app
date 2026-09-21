# Porcelain (instance porcelain)

The package `@museumwnf/porcelain-data` is produced by
[`dxa-gallery`](../dxa-gallery/README.md) from
[`porcelain.json`](porcelain.json) next to this file — see
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md)
for the package specification and
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://porcelain.museumwnf.org> (`thg_gallery` 30, legacy `link`
`porcelain`, mwnf3 project `POR`). Porcelain is the fifth site of M5 wave 4
([epic #1740](https://github.com/museumwithnofrontiers/inventory-app/issues/1740)),
run through the same shared `dxa-gallery` exporter as every other gallery
site.

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **19 member items, none of them native.** `gallery.json` carries
  `project_id: null` for `POR` — the same curatorial-only shape as every
  other wave-4 site so far. `POR` itself carries no objects, so the
  membership union resolves entirely to the link-table half. Read from
  `items.json` `project_id` against `manifest.json`'s `projects` map:
  - 7 from **Sharing History** (project key `awe`)
  - 4 from **Explore Islamic Art Collections** (`EPM`)
  - 4 from **The Table Is Set** (`EXTHE`)
  - 3 from **Discover Baroque Art** (`BAR`)
  - 1 from **MWNF Galleries** (the cross-gallery curatorial project)
- **Languages: 4 site languages (ar/en/es/fr), 8 languages overall**
  (`languages.json`), but item translations exist in only 3
  (`translations/items.{ar,en,pt}.json`) — **no `items.es.json` or
  `items.fr.json` file at all**, even though `es` and `fr` are two of this
  site's own 4 site languages. This is narrower than
  [`photographs`](photographs.md) (which at least kept its own 4 site
  languages covered) and is a real content gap, not just an unusual
  borrowed-language spread: a Porcelain page in Spanish or French would
  have no item text for any of the 19 members. Not investigated further
  this run; recorded here as the gap, for the gallery epic to decide
  whether it is an importer-side or legacy-source issue.
- **`gallery.json`: `featured: false`, `hidden: false`,
  `has_timeline: false`, `has_country_timeline: false`.** The live
  `/api/v2/thg/galleries/self` on `porcelain.museumwnf.org` (fetched
  2026-09-21, one call) answers `featured: true`, `hidden: false`,
  `hasTimeline: false`, `hasCountryBasedTimeline: false` — timeline flags
  match exactly; `featured` shows the same polarity mismatch documented on
  [`carpets`](carpets.md#the-one-field-where-the-package-deliberately-differs-from-the-live-api)
  and every other wave-4 site so far. The package ships the documented
  meaning, not the live polarity.
- **37 timelines, 26 countries, 1,390 events** in `timelines.json` /
  `timeline_events.json` — the same corrected totals as every other gallery
  in this family; nothing gallery-specific about the timeline here.
- **30 countries** in `countries.json`. Verified directly: item countries
  (11) ∪ partner countries (11) ∪ timeline countries (26) = 30, the exact
  `countries.json` count.
- **15 partners**, 2 `featured`, 0 with `item_count: 0`.
- **58 tags** (artist 3, dynasty 4, material 25, subject 4, type 22), **3
  dynasties**, **27 glossary entries**.

## Slug vs. legacy link

`gallery.json`'s `slug` is `porcelain`, which is already the site slug —
the two coincide here, the same as `carpets`, `mosaics`, `paintings` and
`photographs`.

## Known gaps

Verified during this export, none blocking except the language gap noted
above:

- **No `items.es.json` or `items.fr.json`** — see the languages point
  above; the most significant gap found in this wave so far.
- **4 items have an empty English (`en`) description**, out of 19
  (`translations/items.en.json` against `items.json`). Checked against
  `project_id`: all 4 are `EPM`-sourced — the already-documented EPM
  short-description gap (carpets/amulets/coins-medals/mosaics/
  musical-instruments/paintings/photographs). Ids:
  `3d81aec6-b59f-5b48-b482-d6cde0cf5bda`,
  `470d797e-486d-5fa3-a961-b3a1527eec07`,
  `070af261-62bc-5eb0-a1c5-2ab9fe21bf39`,
  `a5f7ac5a-c7e3-5149-8a1c-17cd76006305`.
- **No item is missing an English title.** All 19 items resolve a
  non-empty `name` in `translations/items.en.json`.
- **`notice` and `notice_c`** are not imported, per the standing rule
  documented on carpets/amulets/coins-medals; not specifically re-checked
  here.

## Package contents

Same shape as [`carpets`](carpets.md#package-contents),
[`amulets`](amulets.md#package-contents) and
[`coins-medals`](coins-medals.md#package-contents) — see any of those for
the full file list and what each holds. Nothing about the package shape is
different here, aside from the missing `es`/`fr` item translation files
noted above.
