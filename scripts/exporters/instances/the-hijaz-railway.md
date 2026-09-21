# The Hijaz Railway (instance the-hijaz-railway)

The package `@museumwnf/the-hijaz-railway-data` is produced by
[`dxa-exhibition`](../dxa-exhibition/README.md) from
[`the-hijaz-railway.json`](the-hijaz-railway.json) next to this file — see
[`../docs/dxa-exhibition-data-package.md`](../docs/dxa-exhibition-data-package.md)
for the package specification. This note keeps everything specific to this
site: legacy scope, membership, decisions and known gaps. Package shape is
unchanged from [`the-use-of-colours-in-art`](the-use-of-colours-in-art.md)
and [`water-in-islam`](water-in-islam.md) — see either for the full file
list.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://exhibitions.museumwnf.org/lost_memories_along_the_hijaz_railway:_from_istanbul_to_mecca/en>
(`thg_gallery` id 55, legacy `link`
`lost_memories_along_the_hijaz_railway:_from_istanbul_to_mecca`, status
**H** hidden, mwnf3 project `GalEx5`). The site slug used here,
**`the-hijaz-railway`**, is the epic's name for it, not a kebab-cased form
of the legacy `link` — that legacy value even carries a colon and is kept
verbatim only inside the data (`exhibition.json.slug`,
`legacy_host`/backward-compatibility identity), never as the site slug or
package name (decision Q4, as on every other instance in this family). One
of the four exhibitions produced by
[epic #1743](https://github.com/museumwithnofrontiers/inventory-app/issues/1743),
steps 1–2 of the [new-website recipe](../../../docs/deployment/new-website.md)
only.

## Stale-import status: resolved, no re-import needed

The 2026-08-25 gap analysis recorded this exhibition's import as
potentially stale (legacy re-authored post-import: 9 more objects,
renumbered themes) and said a re-import would pick it up, but that a
re-run had not been verified since. The orchestrator's read-only comparison
of the legacy database against staging (2026-09-21) closes this: legacy
`theme` rows and `theme_item` rows equal staging's theme nodes and theme
items exactly — 16 nodes / 243 items. This export reproduces the same 16
nodes (4 + 12) and 243 pictures, so the epic's "re-import first" step for
this exhibition is done; no re-import was performed as part of this wave.

## Numbers, from the staging export (2026-09-21, `--base-url
https://inventory.metanull.eu`)

- **251 member items: 165 native, 85 borrowed, 1 unresolved.** Read from
  `items.json` `project_id` against `manifest.json`'s `projects` map: 165
  from the exhibition's own project (`GalEx5`); borrowed — 61 Sharing
  History (`awe`), 18 Explore Islamic Art Collections (EPM), 6 Discover
  Islamic Art (ISL). The remaining item carries no `project_id` in
  `items.json`, so it is excluded from the native/borrowed split; id
  `618c8339-6610-5094-add6-68f91e7e5c49`.
- **4 themes + 12 sub-themes (16 nodes), 243 curated pictures** —
  `themes.json`.
- **Languages: `languages_enabled: []` (empty), `languages: ["en"]`.**
  `exhibition.json` ships an English UI roster but zero enabled languages
  — `exhibition_i18n.enabled` is `'N'` (or absent) for every language on
  this record, unlike the other three exhibitions in this wave, all of
  which enable `en`. Per decision Q2 (per-language builds only exist for
  enabled languages), no build currently exists for this exhibition on
  staging data, English included — a fact for whoever runs steps 3+ of the
  recipe next, not something steps 1–2 resolve. `languages.json` still
  carries 8 languages overall (carried by borrowed records and partners),
  with `site_language: true` on `en`.
- **No hidden museums.** `exhibition.json.hidden_partner_ids` is empty;
  `collections.extra.thg_gallery.hidden_partners` carries nothing for this
  exhibition, unlike [Arts in Dialogue](arts-in-dialogue.md).
- **Exhibition-local timeline present, `has_timeline` still false.**
  `timelines.json` ships 38 timelines (26 countries + **1
  exhibition-local**), 1,393 events — 3 more than the 1,390-event
  worldwide merge, so a `thg_local`-sourced row genuinely exists. But
  `exhibition.json` reports `has_timeline: false` /
  `has_country_timeline: false` — the same distinction documented on
  [`water-in-islam`](water-in-islam.md#has_timeline-false-does-not-mean-no-timelines):
  the flag gates nav, not data. This is the second of the two exhibitions
  in this wave with its own chronology (the other is
  [Arts in Dialogue](arts-in-dialogue.md)), matching the epic's key fact
  that gallery ids 47/54/55 are the three with this feature.
- **0 related-content entries** — `related_content.json`.
- 35 partners (1 featured, none holding zero member items), 103 tags
  (artist 1, dynasty 3, material 47, subject 1, type 51), 6 dynasties, 95
  glossary entries, 27 countries.

## `featured`/`hidden` vs legacy status

`exhibition.json` ships `hidden: true`, matching legacy status **H**, and
`featured: false` — unlike the other three exhibitions in this wave, no
polarity flip is visible here because the package value already reads
`false`. The live legacy comparison could not be made: the exhibition self
endpoint refused both an encoded and a literal request for this slug
(`https://exhibitions.museumwnf.org/lost_memories_along_the_hijaz_railway%3A_from_istanbul_to_mecca/en/api/v2/thg/galleries/self`
and the unencoded equivalent), both HTTP 403 Forbidden — unlike
[Arts in Dialogue](arts-in-dialogue.md#featuredhidden-vs-legacy-status),
where the same endpoint answered normally for a hidden exhibition. Not
investigated further, per the recipe's "if the legacy API refuses a hidden
exhibition, say so and move on."

## Known gaps

Verified during this export, none blocking:

- **35 of 251 items have an empty English description**
  (`translations/items.en.json` against `items.json`); all 251 have a
  non-empty English title. First ten ids: `4c6c73fd-b2b8-5169-9f5b-defe03f3bbce`,
  `9ff5077e-cf93-5273-8105-87762d317700`, `91e561d2-6530-5965-bd21-e1a70b9ef590`,
  `23fa41ec-b0ae-57aa-b230-d5ba2e0f4a72`, `8452667b-dc79-566c-8b23-9d0b6af62bc0`,
  `e22b8e87-2e89-5216-be3f-0b349a0bf625`, `a43697f3-629f-54a0-ad35-dca00abfe608`,
  `1af2dd04-8576-5d3d-9ef0-7c42ddce54b3`, `2735c542-1b56-59a7-9fac-72518fe82535`,
  `2289c6e4-0334-5118-bc50-d1bec36ed791`. The last id, `2289c6e4-…`, is one
  of the two `GalEx5`-sourced items already flagged as an open question on
  [`coins-medals`](coins-medals.md#known-gaps) (empty English description,
  cause not established there either); it reappears here as a native
  member of this exhibition's own project.
- **`languages_enabled` is empty** — see the languages note above; not a
  defect in this export, but worth flagging before anyone runs step 3+ of
  the recipe for this site.
- **1 item with no resolvable source project** — see the membership
  breakdown above.
- **Legacy comparison unavailable** — the live self endpoint refused this
  slug with HTTP 403 both encoded and literal; see above.
- Double export (`--force`, same instance, two runs) produced byte-identical
  output.
