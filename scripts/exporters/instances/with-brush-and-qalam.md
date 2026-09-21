# With Brush and Qalam (instance with-brush-and-qalam)

The package `@museumwnf/with-brush-and-qalam-data` is produced by
[`dxa-exhibition`](../dxa-exhibition/README.md) from
[`with-brush-and-qalam.json`](with-brush-and-qalam.json) next to this file —
see [`../docs/dxa-exhibition-data-package.md`](../docs/dxa-exhibition-data-package.md)
for the package specification. This note keeps everything specific to this
site: legacy scope, membership, decisions and known gaps. Package shape is
unchanged from [`the-use-of-colours-in-art`](the-use-of-colours-in-art.md)
and [`water-in-islam`](water-in-islam.md) — see either for the full file
list.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://exhibitions.museumwnf.org/with_brush_and_qalam/en>
(`thg_gallery` id 50, legacy `link` `with_brush_and_qalam`, status **A**
live, mwnf3 project `EXWIT`). One of the four exhibitions produced by
[epic #1743](https://github.com/museumwithnofrontiers/inventory-app/issues/1743),
steps 1–2 of the [new-website recipe](../../../docs/deployment/new-website.md)
only.

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **34 member items: 30 native, 4 borrowed.** Read from `items.json`
  `project_id` against `manifest.json`'s `projects` map: 30 from the
  exhibition's own project (EXWIT), 4 from Explore Islamic Art Collections
  (EPM). The legacy `thg_gallery_item`/`thg_gallery_monument` link tables
  contribute nothing to this exhibition's membership (recorded by the
  orchestrator as "Brush and Qalam none") — the 4 borrowed items reach the
  union some other way than that link table (not investigated further here).
- **6 themes + 11 sub-themes (17 nodes), 38 curated pictures** —
  `themes.json`.
- **Languages: `languages_enabled: ["en"]`, `languages: ["en"]`** —
  `exhibition.json`. `languages.json` carries 2 languages overall (en +
  ar), with `site_language: true` on `en` only; item translations exist in
  `translations/items.{ar,en}.json`.
- **No hidden museums.** `exhibition.json.hidden_partner_ids` is empty;
  `collections.extra.thg_gallery.hidden_partners` carries nothing for this
  exhibition, unlike [Arts in Dialogue](arts-in-dialogue.md).
- **No exhibition-local timeline.** `timelines.json` ships 37 timelines (26
  countries + 0 exhibition-local), 1,390 events — the same worldwide merge
  every DXA site gets, with no `thg_local` row. `has_timeline: false` /
  `has_country_timeline: false` in `exhibition.json` agree.
- **2 related-content entries** — `related_content.json`.
- 4 partners (1 featured, none holding zero member items), 18 tags (artist
  0, dynasty 1, material 9, subject 1, type 7), 1 dynasty, 29 glossary
  entries, 27 countries.

## Import-currency check (2026-09-21)

The orchestrator's read-only comparison of the legacy database against
staging (2026-09-21) found legacy `theme` and `theme_item` rows equal to
staging's theme nodes and theme items exactly for this exhibition: 17 nodes
/ 38 items. This export reproduces the same 17 nodes (6 + 11) and 38
pictures, closing the loop between legacy, staging and this package.

## `featured`/`hidden` vs legacy status

`exhibition.json` ships `hidden: false`, matching legacy status **A**. It
ships `featured: true`; the live `/thg/galleries/self` (fetched 2026-09-21,
one call) answers `featured: false` for the same record — the same
`dxa-api` polarity bug documented on
[`the-use-of-colours-in-art`](the-use-of-colours-in-art.md#four-things-this-site-gets-right-that-its-inputs-did-not)
and [`water-in-islam`](water-in-islam.md#known-gaps) (it copies the
`hidden` projection into `featured` without flipping it); the package ships
the documented meaning. The live endpoint also agrees on `hasTimeline:
false`, `hasCountryBasedTimeline: false`, and lists only `en` in
`i18nLinks`.

## Known gaps

Verified during this export, none blocking:

- **5 of 34 items have an empty English description** (`translations/items.en.json`
  against `items.json`); all 34 have a non-empty English title. Ids:
  `d56fbc83-d137-562e-8b49-e4ffd202595c`, `470d797e-486d-5fa3-a961-b3a1527eec07`,
  `f6235379-448e-5847-8d66-127ab7a5d450`, `45b19a0c-0267-54d0-a134-624669d15108`,
  `377425e8-db47-571b-85e2-27702d394d1d`.
- **All 34 items resolve a project via `resolveItemProjects`** — the
  native/borrowed split above accounts for all 34 members, unlike the other
  three exhibitions in this wave (see their notes).
- Double export (`--force`, same instance, two runs) produced byte-identical
  output.
