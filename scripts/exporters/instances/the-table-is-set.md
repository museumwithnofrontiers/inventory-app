# The Table Is Set (instance the-table-is-set)

The package `@museumwnf/the-table-is-set-data` is produced by
[`dxa-exhibition`](../dxa-exhibition/README.md) from
[`the-table-is-set.json`](the-table-is-set.json) next to this file — see
[`../docs/dxa-exhibition-data-package.md`](../docs/dxa-exhibition-data-package.md)
for the package specification. This note keeps everything specific to this
site: legacy scope, membership, decisions and known gaps. Package shape is
unchanged from [`the-use-of-colours-in-art`](the-use-of-colours-in-art.md)
and [`water-in-islam`](water-in-islam.md) — see either for the full file
list.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://exhibitions.museumwnf.org/the_table_is_set/en>
(`thg_gallery` id 52, legacy `link` `the_table_is_set`, status **A** live,
mwnf3 project `EXTHE`). One of the four exhibitions produced by
[epic #1743](https://github.com/museumwithnofrontiers/inventory-app/issues/1743),
steps 1–2 of the [new-website recipe](../../../docs/deployment/new-website.md)
only.

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **378 member items: 201 native, 172 borrowed, 5 unresolved.** Read from
  `items.json` `project_id` against `manifest.json`'s `projects` map: 201
  from the exhibition's own project (EXTHE); borrowed — 74 Discover Islamic
  Art (ISL), 65 Explore Islamic Art Collections (EPM), 28 Sharing History
  (project key `awe`), 3 Discover Carpet Art (DCA), 1 Discover Glass Art
  (DGA), 1 MWNF Galleries. The remaining 5 items carry no `project_id` at
  all in `items.json` (their `collection_item` row has no resolvable
  source project), so they are excluded from the native/borrowed split; ids
  `15d519f5-c26e-5c05-ba07-ac169b9cafb2`, `71e530f4-815b-573d-aae7-8e626e13cbde`,
  `61338d55-fb32-555c-a06d-c7ca35110c05`, `643b2b9c-20f5-5b36-9e17-3be5e6f47f5b`,
  `2c11d15b-86e5-562f-bbfd-ef12cbbb45f1` — not investigated further here, an
  open question like the two `GalEx5` items on
  [`coins-medals`](coins-medals.md#known-gaps).
- **7 themes + 22 sub-themes (29 nodes), 426 curated pictures** —
  `themes.json`.
- **Languages: `languages_enabled: ["en"]`, `languages: ["en"]`** —
  `exhibition.json`. `languages.json` carries 9 languages overall (carried
  by borrowed records and partners), with `site_language: true` on `en`
  only.
- **No hidden museums.** `exhibition.json.hidden_partner_ids` is empty.
- **No exhibition-local timeline.** `timelines.json` ships 37 timelines (26
  countries + 0 exhibition-local), 1,390 events — the same worldwide merge.
  `has_timeline: false` / `has_country_timeline: false` agree.
- **14 related-content entries, 8 untranslated duplicate rows collapsed** —
  the exporter's own console output names this during the run
  (`related_content.json (14 entries, 8 untranslated duplicate row(s)
  collapsed)`); not investigated further here, recorded as observed rather
  than explained.
- 96 partners (21 featured, none holding zero member items), 413 tags
  (artist 29, dynasty 50, material 158, subject 26, type 150), 32
  dynasties, 266 glossary entries, 36 countries.

## Import-currency check (2026-09-21)

The orchestrator's read-only comparison of the legacy database against
staging (2026-09-21) found legacy `theme` and `theme_item` rows equal to
staging's theme nodes and theme items exactly for this exhibition: 29 nodes
/ 426 items. This export reproduces the same 29 nodes (7 + 22) and 426
pictures, closing the loop between legacy, staging and this package.

## `featured`/`hidden` vs legacy status

`exhibition.json` ships `hidden: false`, matching legacy status **A**. It
ships `featured: true`; the live `/thg/galleries/self` (fetched 2026-09-21,
one call) answers `featured: false` for the same record — the same
`dxa-api` polarity bug documented on
[`the-use-of-colours-in-art`](the-use-of-colours-in-art.md#four-things-this-site-gets-right-that-its-inputs-did-not)
and [`with-brush-and-qalam`](with-brush-and-qalam.md#featuredhidden-vs-legacy-status)
above; the package ships the documented meaning. The live endpoint also
agrees on `hasTimeline: false`, `hasCountryBasedTimeline: false`, and lists
only `en` in `i18nLinks`.

## Known gaps

Verified during this export, none blocking:

- **67 of 378 items have an empty English description**
  (`translations/items.en.json` against `items.json`); all 378 have a
  non-empty English title. First ten ids: `2d3a9974-408a-5de5-bdff-8cfdae9e0b29`,
  `a87439ea-aee1-50f5-a0b5-501d95e7044f`, `6cac4f71-4c6d-5af5-91b7-33d7f396babe`,
  `255f45d9-17b4-565e-8c90-1983dbce43f3`, `e39d2fbb-2774-52a9-868e-e26f46c215f7`,
  `f02545d3-2c1e-56ed-999c-fd59a3ff72c3`, `67ae5352-aaad-57a1-9050-4df90cfc07e6`,
  `cd089341-0bb9-55f0-b578-8f53eb67a553`, `6cd1576c-84dc-565e-8f5b-d3d3ed636ea8`,
  `9759fb2e-169a-5a39-8d80-11289577854b`.
- **5 items with no resolvable source project** — see the membership
  breakdown above.
- **Related content: 8 untranslated duplicate rows collapsed** — see the
  membership breakdown above; the exporter's own log names it, no cause
  investigated.
- Double export (`--force`, same instance, two runs) produced byte-identical
  output.
