# Architectural Elements (instance architectural-elements)

The package `@museumwnf/architectural-elements-data` is produced by
[`dxa-gallery`](../dxa-gallery/README.md) from
[`architectural-elements.json`](architectural-elements.json) next to this
file — see
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md)
for the package specification and
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://architectural-elements.museumwnf.org> (`thg_gallery` 6, legacy
`link` `architectural_elements`, mwnf3 project `ARH`). Architectural
Elements is one of the six galleries of
[M5 wave 1](https://github.com/museumwithnofrontiers/inventory-app/issues/1737),
run through the same [new-website recipe](../../../docs/deployment/new-website.md)
first exercised end to end on [`coins-medals`](coins-medals.md). It is
exported through the same shared `dxa-gallery` exporter as every other
gallery site — there is no per-site fork.

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **142 member items, none of them native.** Project `ARH` itself carries
  no objects — a curatorial-only project, the same shape as
  [`coins-medals`](coins-medals.md) and [`archaeology`](archaeology.md)
  rather than [`carpets`](carpets.md). Read from `items.json` `project_id`
  against `manifest.json`'s `projects` map:
  - 77 from **Discover Islamic Art** (`ISL`)
  - 42 from **Explore Islamic Art Collections** (`EPM`)
  - 13 from **Discover Glass Art** (`DGA`)
  - 4 from **Sharing History** (`awe`)
  - 3 from **Water in Islam** (`GalEx6`)
  - 2 from **The Hijaz Railway** (`GalEx5`)
  - 1 from **The Table Is Set** (`EXTHE`)
- **Languages: 4 site languages (ar/en/es/fr), 8 languages overall**
  (`languages.json`: ar/de/en/es/fr/it/pt/tr). Item translations exist in
  all 8 — the only gallery in this wave with full language coverage on its
  items.
- **`gallery.json`: `featured: false`, `hidden: false`,
  `has_timeline: false`, `has_country_timeline: false`.** The live
  `/api/v2/thg/galleries/self` (fetched 2026-09-21, one call) answers
  `hidden: false`, `hasTimeline: false`, `hasCountryBasedTimeline: false` —
  exact — and `featured: true`, the same documented `dxa-api` polarity
  mismatch as `carpets`/`amulets`/`coins-medals`/`archaeology`.
- **37 timelines, 26 countries, 1,390 events** in `timelines.json` /
  `timeline_events.json` — the same corrected totals as every other DXA
  gallery site so far.
- **32 countries** in `countries.json`.
- **48 partners**, 18 `featured`, 0 with `item_count: 0` (the MWNF-384
  "museum created under the gallery's own project but holding nothing"
  branch is inert here too).
- **178 tags** (artist 6, dynasty 34, material 63, subject 21, type 54),
  **30 dynasties**, **161 glossary entries**.

## Slug vs. legacy link

The site slug is `architectural-elements` (kebab-case, per decision Q4),
the npm package `@museumwnf/architectural-elements-data`. `gallery.json`
carries the legacy value verbatim: `slug: "architectural_elements"`
(`thg_gallery.link`) — the two differ only by punctuation (hyphen vs.
underscore), closer than the `coins-medals`/`amulets` pattern but still a
separate field by design: data values keep legacy identity as-is, the site
slug does not derive from it.

## Known gaps

Verified during this export, none blocking:

- **54 items have an empty English (`en`) description**, out of 142
  (`translations/items.en.json` against `items.json`). All 42 items from
  the `EPM` (Explore Islamic Art Collections) source project are among
  them — the already-documented importer-side gap (see
  [`coins-medals`](coins-medals.md#known-gaps)): legacy keeps the short
  text in `objects.description2`, filed by the importer as the EPM-context
  translation, so an EPM-native record's long description is legitimately
  empty. The other 12 are 12 of the 13 `DGA` (Discover Glass Art) items —
  the same pattern first observed on [`archaeology`](archaeology.md#known-gaps),
  confirmed here on a second, larger sample: `DGA`-sourced items are
  overwhelmingly (not universally — 1 of 13 here has text) missing an
  English description. First ten affected ids (of 54):
  `78426513-4220-51b8-99aa-4f7ba05f6c3a`,
  `d0a3b10b-ba8a-5ee3-9680-fb2f69ed64e7`,
  `aa67ee01-78e4-5518-9d67-9f76947805b3`,
  `8cc707f2-d298-51b9-8969-c697a25d982e`,
  `4ccac71e-541b-5e6c-b28b-e5ec2a3359e3`,
  `42921209-bf16-5ad2-9981-5d7b63ee02d1`,
  `ab4c5d91-3eb6-5a81-9faa-2a5c739113b8`,
  `709ed3e5-6450-5388-9dba-59deb41dfe2c`,
  `b3e62fd2-6577-5d66-8b8b-0a02eabf19a6`,
  `72cc9bba-ac66-5c38-9182-60aa70e5cc53`.
- **No item is missing an English title.** All 142 items resolve a
  non-empty `name` in `translations/items.en.json`.
- **`notice` and `notice_c`** are not imported, per the standing rule
  documented on `carpets`/`amulets`; not specifically re-checked here.

## Determinism

Exported twice; the two `output/architectural-elements/` trees compared
with `compare-output.mjs` (`generatedAt` excluded) were byte-identical:
`filesOnlyInA: []`, `filesOnlyInB: []`, `differing: []`, `gzMismatch: []`.

## Package contents

Same shape as [`carpets`](carpets.md#package-contents) and
[`coins-medals`](coins-medals.md#package-contents) — see either for the
full file list and what each holds. Nothing about the package shape is
different here.
