# Archaeological Objects (instance archaeology)

The package `@museumwnf/archaeology-data` is produced by
[`dxa-gallery`](../dxa-gallery/README.md) from
[`archaeology.json`](archaeology.json) next to this file — see
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md)
for the package specification and
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://archaeology.museumwnf.org> (`thg_gallery` 5, legacy `link`
`archaeological_objects`, mwnf3 project `ARC`). Archaeological Objects is
one of the six galleries of [M5 wave 1](https://github.com/museumwithnofrontiers/inventory-app/issues/1737),
run through the same [new-website recipe](../../../docs/deployment/new-website.md)
first exercised end to end on [`coins-medals`](coins-medals.md). It is
exported through the same shared `dxa-gallery` exporter as every other
gallery site — there is no per-site fork.

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **151 member items, none of them native.** Project `ARC` itself carries
  no objects — a curatorial-only project, the same shape as
  [`coins-medals`](coins-medals.md) and [`amulets`](amulets.md) rather than
  [`carpets`](carpets.md). Read from `items.json` `project_id` against
  `manifest.json`'s `projects` map:
  - 83 from **Discover Islamic Art** (`ISL`)
  - 41 from **Sharing History** (`awe`)
  - 10 from **Discover Carpet Art** (`DCA`)
  - 5 from **MWNF Galleries** (`GALLERIES`)
  - 4 from **Discover Glass Art** (`DGA`)
  - 4 from **Explore Islamic Art Collections** (`EPM`)
  - 3 from **The Table Is Set** (`EXTHE`)
  - 1 from **The Hijaz Railway** (`GalEx5`)
- **Languages: 4 site languages (ar/en/es/fr), 8 languages overall**
  (`languages.json`: ar/de/en/es/fr/it/pt/tr). Item translations exist in
  6 of the 8 (`translations/items.{ar,en,es,fr,it,pt}.json` — no `de` or
  `tr` row for any of these 151 items).
- **`gallery.json`: `featured: false`, `hidden: false`,
  `has_timeline: false`, `has_country_timeline: false`.** The live
  `/api/v2/thg/galleries/self` (fetched 2026-09-21, one call) answers
  `hidden: false`, `hasTimeline: false`, `hasCountryBasedTimeline: false` —
  exact — and `featured: true`, the same documented `dxa-api` polarity
  mismatch as `carpets`/`amulets`/`coins-medals`.
- **37 timelines, 26 countries, 1,390 events** in `timelines.json` /
  `timeline_events.json` — the same corrected totals as every other DXA
  gallery site so far, confirming the global-timeline merge applies
  unchanged to this instance.
- **29 countries** in `countries.json`.
- **29 partners**, 6 `featured`, 0 with `item_count: 0` (the MWNF-384
  "museum created under the gallery's own project but holding nothing"
  branch is inert here too: no `mwnf3.museums` row has `project_id =
  'ARC'`).
- **212 tags** (artist 2, dynasty 21, material 70, subject 15, type 104),
  **13 dynasties**, **105 glossary entries**.

## Slug vs. legacy link

The site slug is `archaeology` (kebab-case, per decision Q4), the npm
package `@museumwnf/archaeology-data`. `gallery.json` carries the legacy
value verbatim: `slug: "archaeological_objects"` (`thg_gallery.link`) —
data values keep legacy identity as-is, the site slug does not derive from
it. Same pattern as `coins-medals`/`amulets`, not like `carpets`/`ceramics`
where the two happen to coincide.

## Known gaps

Verified during this export, none blocking:

- **8 items have an empty English (`en`) description**, out of 151
  (`translations/items.en.json` against `items.json`). All 4 items from
  the `EPM` (Explore Islamic Art Collections) source project are among
  them — the same, already-documented importer-side gap as on
  `carpets`/`amulets`/`coins-medals`: legacy keeps the short text in
  `objects.description2`, which the importer files as the EPM-context
  translation, so an EPM-native record's only row is that short one and its
  long description is legitimately empty. The other 4 are all 4 items from
  the `DGA` (Discover Glass Art) source project — a new observation for
  this wave, not documented on `coins-medals`: every `DGA`-sourced item in
  this export has an empty English description. Whether this is the same
  short-description pattern under a different project code, or a distinct
  gap, was not investigated here; flagged for the gallery epic. All 8
  affected ids: `b93fd12a-4d27-5f35-9bfe-b260f6a56e42`,
  `fd6f1970-6f1f-547d-882d-48ee08c260f8`,
  `b07925c9-6a74-5708-ae78-2988cae0e279`,
  `1bdcb311-686f-5698-aa9b-df0727b85070`,
  `9ece1ead-7c0b-528b-bdd1-e15c148b868c`,
  `9fbdeae7-8d2e-57e7-91e7-ef25446597b8`,
  `4f4aebf4-ad51-596f-8d75-02d79f90d769`,
  `cf9875f4-0d50-59fb-b1f9-fb072d1e4cc5`.
- **No item is missing an English title.** All 151 items resolve a
  non-empty `name` in `translations/items.en.json`.
- **`notice` and `notice_c`** are not imported, per the standing rule
  documented on `carpets`/`amulets`; not specifically re-checked here.

## Determinism

Exported twice; the two `output/archaeology/` trees compared with
`compare-output.mjs` (`generatedAt` excluded) were byte-identical:
`filesOnlyInA: []`, `filesOnlyInB: []`, `differing: []`, `gzMismatch: []`.

## Package contents

Same shape as [`carpets`](carpets.md#package-contents) and
[`coins-medals`](coins-medals.md#package-contents) — see either for the
full file list and what each holds. Nothing about the package shape is
different here.
