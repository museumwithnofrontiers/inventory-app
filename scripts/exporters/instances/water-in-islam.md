# Water in Islam (instance water-in-islam)

The package `@museumwnf/water-in-islam-data` is produced by
[`dxa-exhibition`](../dxa-exhibition/README.md) from
[`water-in-islam.json`](water-in-islam.json) next to this file — see
[`../docs/dxa-exhibition-data-package.md`](../docs/dxa-exhibition-data-package.md)
for the package specification and
[`../dxa-exhibition/NPM_PUBLISH.md`](../dxa-exhibition/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `exhibitions-client`:
<https://exhibitions.museumwnf.org/water_in_islam/en>. This was the second DXA
**exhibition** site
([epic #1539](https://github.com/museumwithnofrontiers/inventory-app/issues/1539),
[story #1548](https://github.com/museumwithnofrontiers/inventory-app/issues/1548)), originally
built as a fork of [`the-use-of-colours-in-art`](the-use-of-colours-in-art.md)
([#1546](https://github.com/museumwithnofrontiers/inventory-app/issues/1546)); it now exports
through the shared `dxa-exhibition` exporter
([#1913](https://github.com/museumwithnofrontiers/inventory-app/issues/1913)). The legacy
behaviour it reproduces is analyzed in
[`../docs/dxa-legacy-analysis.md`](../docs/dxa-legacy-analysis.md).

## Why a second exhibition site mattered

Not because the shape changed — it did not. Every scoping rule and every
keyspace is inherited from Colours unchanged, and the original fork's diff
against it was site identity plus comments. The value is that Water in Islam
exercises four things Colours could not, and each of them is a place where a
generic exporter would have had to guess:

| | Colours | Water in Islam |
|---|---|---|
| Members | 171 | **495** |
| Theme nodes / curated pictures | 5 + 10 / 194 | **6 + 22 / 432** |
| Native vs borrowed | 24 native of 171 | **314 native of 495** |
| Hidden museums (E6) | none | **11** |
| Exhibition-local chronology | 45 events | **none** |
| Languages | de + en, en published | **en only** |
| Related content | 10 entries | **0 — see gaps** |

### Hidden museums are real here

`extra.thg_gallery.hidden_partners` holds eleven entries for this exhibition and
none for Colours, so `exhibition.json.hidden_partner_ids` ships non-empty for
the first time. It is legacy's E6 rule and the polarity matters: the **museum**
disappears from `/partners` and from its own profile page, its **items** do not.
Six of the eleven hold member items — 26, 10, 8, 4, 2 and 1 — so a viewer that
dropped the partner records instead of flagging them would leave 51 items
pointing at nothing.

This is also what makes the partner count check work. Legacy answers `/partners`
with 98 and `/institutions` with 21, a union of 117; the package ships **128**,
and 128 − 11 hidden = 117 exactly. Comparing the raw counts would have looked
like an 11-partner overcount.

### `has_timeline: false` does not mean "no timelines"

Both chronology flags are false here, so the Timeline nav entry is absent — and
`/events` still answers with the same **1,390-event, 26-country worldwide
merge** every DXA site gets. `timelines.json` therefore ships 37 timelines and
1,390 events with no `thg_local` row at all. An exporter that had read
`has_timeline: false` as "ship no timeline files" would have produced an empty
file against a live site serving a full one. The flags gate navigation, not
data; Colours proved it in one direction and this exhibition proves it in the
other.

### The reading list lives on the collection, not in `collection_media`

All five of this exhibition's `exhibition_related_content` rows carry a
bibliography and nothing else — `link`, `uploaded_document`, `title` and
`type_resource` are null at both the base and the `_i18n` level.
`collection_media.url` is `NOT NULL`, so there was nowhere to put them and the
importer wrote nothing at all; `related_content.json` shipped empty against a
live page showing five blocks. The importer now files them on the exhibition
collection's `extra.further_readings`, keyed by language the way a theme's
curated picture texts sit on `collection_item.extra`, and this export folds
them back into the same array with `kind: "text"` and a per-language `texts`
map. Linked entries are unchanged.

The test that decides which entries take that path reads **both** levels. Every
one of Colours' ten base rows is equally bare, and each carries an `_i18n` row
with an uploaded document — judging on the base row alone would reclassify all
ten as text and lose their PDFs. Both galleries are pinned in
`relatedContentCarriesMedia`'s tests
([`../dxa-exhibition/src/exporters/related-content-exporter.ts`](../dxa-exhibition/src/exporters/related-content-exporter.ts)).

### One language, and both fields agree

`thg_gallery_lang` and `exhibition_i18n.enabled` both say English alone, so
`languages` and `languages_enabled` are the same list. On Colours they differ —
German has full theme translations and is never published — which is why the
package carries both fields rather than deriving one from the other.

## Package contents

| File | Contents |
|---|---|
| `manifest.json` | Export metadata, the languages present, item and theme counts. Also `projects`: one entry per referenced project UUID, with a per-language name and the three URL columns (epic #1727 phase 2, additive) |
| `exhibition.json` | Site anchor: slug, legacy host, titles/subtitles/headlines, enabled languages, logos, partner strip, chrome flags, **hidden partner ids**, sibling sites |
| `themes.json` | 6 themes + 22 sub-themes, 432 curated pictures with cover pictures and related-picture links |
| `related_content.json` | The 5 "Further Reading" bibliographies, as `kind: "text"` entries |
| `items.json` | The 495 member items — full sheets, facet tag ids, images, references |
| `tags.json` | 245 THG facet tags with their category (artist 11, dynasty 29, material 99, subject 18, type 88) |
| `partners.json` | The 128 museums and institutions; eleven of them flagged hidden by `exhibition.json`. One shape across every dataset (museumwithnofrontiers/inventory-app#1699): `featured`, `item_count`, plus `level`/`parent_id`/`project_uuids` from the curated hierarchy where the data has one |
| `countries.json` | The 37 countries the members, their holders and the timeline reference |
| `languages.json` | The 9 languages the site can display (en as `site_language`, plus 8 carried by borrowed records and partners) |
| `dynasties.json` | The 38 dynasties member items reference |
| `glossary.json` | The 249 terms reachable from member item texts, with spelling lists |
| `timelines.json` / `timeline_events.json` | 37 country timelines (26 countries, 1,390 events); no exhibition-local chronology |
| `translations/<entity>.<lang>.json` | All human-readable text, one file per entity per language |

Entity files hold language-independent data; every human-readable string lives
under `translations/`. Image URLs are absolute, built from `BASE_URL`. A file is
absent when that entity has no translation in that language — viewers must
tolerate this.

Site chrome images (`image_path`, `banner_image_path`, `homepage_image_path`)
and related-content PDFs (`document_path`) are the exception to the absolute-URL
rule: they live on the legacy media server and were never imported, so the
package carries the legacy path only and the viewer supplies the host, exactly
as the legacy client did through `VUE_APP_IMAGES_URL`. Sponsor logos **were**
imported, so `logos[].image_url` is a resolved absolute URL.

## Naming

The instance slug and package are `water-in-islam` /
`@museumwnf/water-in-islam-data` — the kebab-cased legacy slug fixed by
decision Q4. The data keeps the underscore form (`water_in_islam`), because
that is the legacy public URL path and therefore identity. Never derive one
from the other.

## Known gaps

Verified during implementation against the live legacy API. None blocks the
package.

Two gaps recorded here on 2026-08-29 have since been **closed** in the importer
and are no longer true of this package: `related_content.json` shipped 0 entries
where legacy shows 5, and six members shipped with no text in any language. Both
were importer defects rather than exporter ones — see *The reading list lives on
the collection* above and `planTranslations` in
[`object-transformer.ts`](../../importer/src/domain/transformers/object-transformer.ts).

- **Three link-table members that legacy suppresses.** The package ships 495
  members where legacy's `/items` answers 492; the 492 are a strict subset, so
  nothing is missing. The three extras are in the legacy link tables and are
  imported as ordinary members, but the live API 404s each of them:

  | Item | Why legacy drops it |
  |---|---|
  | `mwnf3:objects:GalEx6:es:Mus81:4` | It has a Spanish translation and no English one. The `/es` path serves it ("Brocal de pozo"); the English instance does not. |
  | `mwnf3_sharing_history:sh_objects:awe:tr:3` | Has an English translation and an image in inventory; suppressed by legacy for a reason not visible through the API — most likely a publication flag on the Sharing History record that the import does not carry. |
  | `mwnf3_sharing_history:sh_objects:awe:uk:135` | Same. |

  The first is a general rule worth reproducing — a per-language build should
  not list a record it cannot render — and it is the viewer's decision, not the
  package's, so all 495 ship with their `languages` array intact.

- **`featured` disagrees with the live API, as on carpets and Colours — this
  time in the opposite direction.** dxa-api builds its `featured` output by
  copying the `hidden` projection without flipping the polarity. Gallery 56's
  record is `featured = 'H'`, not `'A'`, so the package ships the documented
  meaning `featured: false` while the live API answers `true`. Colours is the
  mirror image (`'A'` in the record, `false` from the API), which is what says
  the disagreement is dxa-api's polarity bug rather than a mapping error in
  either exporter.

## Validation

[`../docs/validation/water-in-islam-2026-08-29.md`](../docs/validation/water-in-islam-2026-08-29.md)
records the export checked metric by metric against the live legacy API.
