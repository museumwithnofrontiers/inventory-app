# Arts in Dialogue (instance arts-in-dialogue)

The package `@museumwnf/arts-in-dialogue-data` is produced by
[`dxa-exhibition`](../dxa-exhibition/README.md) from
[`arts-in-dialogue.json`](arts-in-dialogue.json) next to this file — see
[`../docs/dxa-exhibition-data-package.md`](../docs/dxa-exhibition-data-package.md)
for the package specification. This note keeps everything specific to this
site: legacy scope, membership, decisions and known gaps. Package shape is
unchanged from [`the-use-of-colours-in-art`](the-use-of-colours-in-art.md)
and [`water-in-islam`](water-in-islam.md) — see either for the full file
list.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://exhibitions.museumwnf.org/arts_in_dialogue/en>
(`thg_gallery` id 54, legacy `link` `arts_in_dialogue`, status **H** hidden,
mwnf3 project `EXAID`). Legacy-hidden but explicitly in scope for
[epic #1743](https://github.com/museumwithnofrontiers/inventory-app/issues/1743)
("in progress, include"); this note covers steps 1–2 of the
[new-website recipe](../../../docs/deployment/new-website.md) only — the
epic separately calls out that this site's `site-i18n` catalogue has not
been extracted yet (step 5, not part of this wave).

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **58 member items: 1 native, 49 borrowed, 8 unresolved.** Read from
  `items.json` `project_id` against `manifest.json`'s `projects` map: 1 from
  the exhibition's own project (EXAID); borrowed — 10 Discover Baroque Art
  (BAR), 9 Discover Islamic Art (ISL), 8 With Brush and Qalam (EXWIT), 7
  Explore Islamic Art Collections (EPM), 6 The Table Is Set (EXTHE), 4
  Sharing History (`awe`), 3 The Use of Colours in Art (EXHCOLOUR), 1 MWNF
  Galleries, 1 Water in Islam (`GalEx6`). The remaining 8 items carry no
  `project_id` in `items.json` at all, so they are excluded from the
  native/borrowed split; ids `bee6c70e-fa47-513b-9a23-33bf239df2e8`,
  `5bef360d-cbce-5189-8632-6be76610606e`, `6ac2d7e0-2777-5886-9469-75bb16529e0a`,
  `c7e32992-cf9b-52e7-9700-1b6de93e648a`, `d588c32c-3527-5a31-988e-7869b0fe01f1`,
  `7b744cc2-ef33-5790-89ca-8f7102883e0f`, `d86b5a46-c8b4-516d-9217-cf87d4e19e81`,
  `861d0f2b-5399-52a3-9e8c-542cf19e001d` — not investigated further here.
- **5 themes + 9 sub-themes (14 nodes), 82 curated pictures** —
  `themes.json`. The exporter's own console output warns `2 selected
  picture(s) have a parent item that is not a member of the exhibition;
  their record links cannot be resolved locally` — the same
  `parent_in_package: false` case documented on
  [`the-use-of-colours-in-art`](the-use-of-colours-in-art.md#themesjson-shape-and-why),
  not investigated further per picture here.
- **Languages: `languages_enabled: ["en"]`, `languages: ["en"]`** —
  `exhibition.json`. `languages.json` carries 9 languages overall, with
  `site_language: true` on `en` only.
- **2 hidden museums, honoured.** `collections.extra.thg_gallery.hidden_partners`
  carries two entries for this exhibition (the orchestrator's E6 finding);
  `exhibition.json.hidden_partner_ids` ships both
  (`f44fb8f2-6c70-5288-9890-4968a73642a1`, `b43ae2c6-2060-5819-bd1c-dd9ca66b9f11`),
  and both still appear in `partners.json` (1 member item each) — the
  package ships them flagged rather than dropped, the same polarity as
  [`water-in-islam`](water-in-islam.md#hidden-museums-are-real-here): the
  museum is excluded from listings, its items are not.
- **Exhibition-local timeline present.** `timelines.json` ships 38
  timelines (26 countries + **1 exhibition-local**), 1,394 events — 4 more
  than the 1,390-event worldwide merge. `has_timeline: true` /
  `has_country_timeline: false` in `exhibition.json` agree with the live
  API (below); this is one of the two exhibitions in this wave with its own
  chronology (the other is [The Hijaz Railway](the-hijaz-railway.md)),
  matching the epic's key fact that gallery ids 47/54/55 are the three with
  this feature.
- **0 related-content entries** — `related_content.json`.
- 34 partners (4 featured, 1 holding zero member items), 71 tags (artist 4,
  dynasty 7, material 31, subject 4, type 25), 13 dynasties, 108 glossary
  entries, 33 countries.

## Import-currency check (2026-09-21)

The orchestrator's read-only comparison of the legacy database against
staging (2026-09-21) found legacy `theme` and `theme_item` rows equal to
staging's theme nodes and theme items exactly for this exhibition: 14 nodes
/ 82 items. This export reproduces the same 14 nodes (5 + 9) and 82
pictures, closing the loop between legacy, staging and this package.

## `featured`/`hidden` vs legacy status

`exhibition.json` ships `hidden: true`, matching legacy status **H**. It
ships `featured: true`; the live `/thg/galleries/self` (fetched 2026-09-21,
one call, HTTP 200 — legacy does **not** refuse a hidden exhibition at this
endpoint) answers `featured: false` for the same record — the same
`dxa-api` polarity bug documented on the other three sites in this wave;
the package ships the documented meaning. The live endpoint also confirms
`hidden: true`, `hasTimeline: true`, `hasCountryBasedTimeline: false`, and
`isLive: true` (hidden and live are independent flags on legacy's side too).

## Known gaps

Verified during this export, none blocking:

- **12 of 58 items have an empty English description**
  (`translations/items.en.json` against `items.json`); all 58 have a
  non-empty English title. First ten ids: `5d9c4672-e793-561a-835c-cda69931fe09`,
  `776becd1-b151-59c4-9e46-f120b2d7a354`, `12c86eff-6117-5981-a2db-6fc7d1b3ebdb`,
  `6cd1576c-84dc-565e-8f5b-d3d3ed636ea8`, `e16f9c2d-d57c-528f-a389-0f2f2612e49e`,
  `b02909ff-72bb-5ea9-97d5-753e9289377f`, `f6235379-448e-5847-8d66-127ab7a5d450`,
  `06e39036-25f9-536a-9b12-08f6aedd1b8a`, `35c8d4f3-55f5-55eb-8e9b-97e79ecdf9fb`,
  `34fa4908-e715-5899-b8b5-002b54cad2c5`.
- **8 items with no resolvable source project** — see the membership
  breakdown above.
- **2 curated pictures whose parent item is outside the membership union**
  — see the theme breakdown above.
- Double export (`--force`, same instance, two runs) produced byte-identical
  output.
