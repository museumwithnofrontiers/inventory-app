# The Use of Colours in Art — Exporter

Reads the `inventory-app` database directly and writes a set of denormalized,
static JSON files for the rebuilt **The Use of Colours in Art** website — no API
server, no auth, no runtime database dependency. Optionally packages and
publishes that output as a public npm package
(`@museumwnf/the-use-of-colours-in-art-data`) on npmjs.

This is the first of the DXA **exhibition** exporters
([epic #1539](https://github.com/museumwithnofrontiers/inventory-app/issues/1539),
[story #1546](https://github.com/museumwithnofrontiers/inventory-app/issues/1546)), forked
from [`../carpets`](../carpets/README.md)
([#1544](https://github.com/museumwithnofrontiers/inventory-app/issues/1544)). It replaces one
legacy deployment of `dxa-api` + `dxa-client`:
<https://exhibitions.museumwnf.org/the_use_of_colours_in_art/en>. The package
specification it implements is
[`../docs/dxa-exhibition-data-package.md`](../docs/dxa-exhibition-data-package.md);
the legacy behaviour it reproduces is analyzed in
[`../docs/dxa-legacy-analysis.md`](../docs/dxa-legacy-analysis.md).

## An exhibition is a gallery plus a curated layer

Everything in the gallery package applies unchanged — membership union, facet
tags, partners, glossary, countries, languages, the worldwide timeline — so the
scoping rules are inherited from the carpets fork rather than re-derived. Three
things are new, and one thing the specification said turned out to be wrong.

- **`exhibition.json` replaces `gallery.json`.** Same anchor plus the curated
  per-language chrome: titles, sub-titles, banner headlines, About bodies,
  pop-up logo blocks, the sponsor-logo strip, the partner strip, and
  `languages_enabled`.
- **`themes.json` is the product.** Five themes, ten sub-themes, 194 curated
  picture selections, each with its own per-exhibition text and its related-
  picture links.
- **`related_content.json`** is the categorized reading list on `/related`.
- **Both timelines ship** — see below.

## Colours is the borrowed case taken to its limit

Amulets was purely curated (45 members, all borrowed); carpets was the hybrid
(486 members, 398 native). This exhibition is the other extreme: **171 members,
only 24 of them its own**, drawn from eight source projects — AWE 39, BAR 35,
EPM 28, EXHCOLOUR 24, ISL 22, DCA 12, GALLERIES 6, DGA 2. The per-item project
key and per-item translation context are exercised on almost every record, and
nothing about a sheet can be a per-export constant.

It is also the first DXA site with **monument members** (18 of them), which is
why institutions appear in `partners.json` for the first time.

## Four things this fork gets right that its inputs did not

### 1. The exhibition ships BOTH timelines

The specification said the exhibition's own chronology *replaces* the worldwide
country timeline. The live instance disagrees — it serves both, from two
endpoints:

| Endpoint | Contents | Keyspace |
|---|---|---|
| `/thg/timeline` | 45 events, this exhibition's own narrative chronology | `mwnf3_thematic_gallery:timeline:47` |
| `/events` | 1,390 events over 26 countries — the same worldwide merge every gallery gets | `mwnf3:hcr:country:%` + `mwnf3_sharing_history:sh_hcr:country:%:exhibition:2` |

`hasTimeline` (true here) and `hasCountryBasedTimeline` (false) gate the nav
entries, not the data: carpets reports both false and still answers `/events`
with the worldwide list. So `timelines.json` carries **38 timelines and 1,435
events**, and every row has a `source` — `mwnf3`, `sharing_history` or
`thg_local`. A viewer must not fold `thg_local` into the per-country merge: it
is the one timeline with no country.

### 2. Legacy's two hardcoded partner exclusions

The final CTE of `app/MWNF/SQL/mwnf3/Partners.blade.php` drops `uk/Mus51` and
`us/Mus51` by name, with no explanation, from every DXA partner list. The
amulets and carpets forks recorded the rule and skipped it because it matched
nobody there. Here both rows hold member items — six and seventeen — so
`PartnerExporter` reproduces it (`EXCLUDED_PARTNER_KEYS`). Without it the
package ships 77 museums where legacy shows 75.

### 3. Institutions belong in `partners.json`

Legacy splits monument-owning institutions (`/institutions`, 11 rows) from
museums (`/partners`, 75 rows) because it has two page templates and one query
each. A data package has no endpoints, so it ships the union — **85 partners** —
and the viewer routes by `type`. The count is therefore expected to match
neither legacy endpoint alone and to match their union exactly.

### 4. The three curated exhibition texts are separate fields

Legacy's `exhibition_i18n` has `subtitle`, `heading` and `about`, and the sheet
renders them in three different places. The importer joined all three into the
single `collection_translations.description` with blank lines between them —
which cannot be undone, because `about` contains blank lines of its own. This
work adds them to `extra.exhibition_i18n` as well
([`thg-gallery-translation-importer.ts`](../../importer/src/importers/phase-10/thg-gallery-translation-importer.ts)),
with an `exhibition-i18n-text-backfill` step for databases imported before that.
On a stale database the exporter falls back to shipping the joined blob as
`abouts` and **logs a warning naming the backfill step** rather than silently
shipping an exhibition with no sub-title.

## German is not a published language

`thg_gallery_lang` lists de and en, and every theme has full German
translations — but `exhibition_i18n.enabled` is `'Y'` for English and `'N'` for
German, and the live German instance proves that is load bearing rather than
cosmetic: it answers `exhibitionTitle: null`, `items/count: 5` and
`events/count: 0`. It is a shell.

So `exhibition.json` carries both fields and they differ:

- `languages: ["de", "en"]` — the UI roster,
- `languages_enabled: ["en"]` — what legacy actually publishes.

Per decision Q2 the sites are per-language builds, so `languages_enabled` is the
field that decides which builds exist. The package still carries the German
curated texts, so a `de` build becomes possible the day someone flips the flag.
**The story description says "de+en"; the data says otherwise.**

## Package contents

| File | Contents |
|---|---|
| `manifest.json` | Export metadata, the languages present, item and theme counts. Also `projects`: one entry per referenced project UUID, with a per-language name and the three URL columns (epic #1727 phase 2, additive) |
| `exhibition.json` | Site anchor: slug, legacy host, titles/subtitles/headlines/abouts, enabled languages, logos, partner strip, chrome flags, sibling sites |
| `themes.json` | 5 themes + 10 sub-themes, 194 curated pictures with cover pictures and related-picture links |
| `related_content.json` | The 10 categorized reading-list entries |
| `items.json` | The 171 member items — full sheets, facet tag ids, images, references |
| `tags.json` | 293 THG facet tags with their category (artist 45, dynasty 18, material 97, subject 34, type 99) |
| `partners.json` | The 85 museums and institutions (75 on legacy's partner list + 11 institutions, minus the overlap). One shape across every dataset (museumwithnofrontiers/inventory-app#1699): `featured`, `item_count`, plus `level`/`parent_id`/`project_uuids` from the curated hierarchy where the data has one |
| `countries.json` | The 35 countries the members, their holders and the timeline reference |
| `languages.json` | The 10 languages the site can display (de/en as `site_language`, plus 8 carried by borrowed records and partners) |
| `dynasties.json` | The 16 dynasties member items reference |
| `glossary.json` | The 147 terms reachable from member item texts, with spelling lists |
| `timelines.json` / `timeline_events.json` | 37 country timelines (26 countries, 1,390 events) + this exhibition's own (45 events) |
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

### `themes.json` shape, and why

```jsonc
{
  "id": "<collection uuid>",
  "backward_compatibility": "mwnf3_thematic_gallery:theme:47:11",
  "display_order": 5,
  "cover_picture_item_id": "<item uuid|null>",
  "pictures": [{
    "picture_item_id": "<uuid>",     // the `picture` child that is shown
    "parent_item_id": "<uuid>",      // the record its "see the full sheet" links to
    "parent_in_package": true,       // whether that link can be resolved locally
    "image_url": "…",
    "related": [{ "picture_item_id": "…", "theme_backward_compatibility": "…", "descriptions": {…} }]
  }],
  "sub_themes": [ /* same shape, one level only */ ]
}
```

Four rules here are decided by the data rather than by taste:

- **Nesting is `parent_id`, not `collections.type`.** Every node is
  `type = 'theme'`; a top-level theme's parent is the exhibition collection and
  a sub-theme's parent is a theme.
- **The theme id in the keyspace is not the display order.** The five top-level
  themes are 0, 1, 2, 3 and **11**, displayed 1–5, and theme 6 does not exist.
- **A theme's members are `picture` items**, and each links to its parent's full
  record — so both ids ship, with `parent_in_package` saying whether the link
  resolves.
- **The curated texts live on the pivot**, keyed `<theme id>/<picture id>` in
  `translations/themes.<lang>.json`: the same picture in two themes carries two
  different descriptions.

## Run

The exporters run inside Docker; there is no host-side Node tooling.

```bash
docker compose --profile jobs run --rm exporter the-use-of-colours-in-art --force
```

Add `--publish` to bump the version, generate `package.json`/`README.md` and
push to npmjs — see [`NPM_PUBLISH.md`](NPM_PUBLISH.md).

The compose service points at the **staging** database (`staging-mysql`), which
is where the exporter should be developed and verified.
`scripts/exporters/the-use-of-colours-in-art/.env` is only consulted when running
outside compose, and by convention those files point at **production** — read it
before running anything that way.

## Naming

The folder and package are `the-use-of-colours-in-art` /
`@museumwnf/the-use-of-colours-in-art-data` — the kebab-cased legacy slug fixed by
decision Q4. The data keeps the underscore form
(`the_use_of_colours_in_art`), because that is the legacy public URL path and
therefore identity. Never derive one from the other.

## Known gaps

Verified during implementation. None blocks the package, and none is worth an
issue of its own: the two importer-side defects this section used to list were
fixed by [#1592](https://github.com/museumwithnofrontiers/inventory-app/issues/1592) (sponsor
logo captions, links and categories) and
[#1593](https://github.com/museumwithnofrontiers/inventory-app/issues/1593) (Explore monument
countries). What remains is one deliberate modelling difference and two
disagreements with the live API that are expected and will not be fixed.

- **Explore monument 1419 resolves to the BAR record, by design.** Legacy lists
  Palazzo Chigi in Ariccia twice, as Explore monument 1419 and as
  `mwnf3:monuments:BAR:it:Mon13:14`; the importer recognised the two as one
  physical monument, kept the BAR identity and re-parented the Explore pictures
  onto it. Both sides count 171 members, so this is not a gap — it is one
  identity where legacy has two. A viewer reproducing legacy Explore URLs must
  resolve them through the membership pivot rather than through
  `items.backward_compatibility`; the canonical query and the reasoning behind
  it are recorded in
  [`../docs/dxa-legacy-analysis.md` § 4.2 Identity](../docs/dxa-legacy-analysis.md#42-identity)
  (decision Q6).
- **The banner headline loses one trailing newline.** Legacy's
  `exhibitionHeadline` is 428 characters and ours is 427; the difference is a
  trailing `\n` the importer trimmed. Cosmetic.
- **`featured` disagrees with the live API, as on carpets.** dxa-api builds its
  `featured` output by copying the `hidden` projection without flipping the
  polarity, so its JSON is the inverse of the record. Gallery 47 is
  `featured = 'A'` and the live API answers `featured: false`; the package ships
  the documented meaning, `featured: true`. See `isFeatured` in
  `src/exporters/exhibition-exporter.ts`.

## Validation

[`tools/VALIDATION-2026-08-28.md`](tools/VALIDATION-2026-08-28.md) records the
export checked metric by metric against the live legacy API.

## Licence

The published package is Content of the MWNF Website under the
[MWNF legal notice](https://www.museumwnf.org/about/legal-notice) (story
museumwithnofrontiers/inventory-app#1690): `package.json`'s `license` defaults to
`SEE LICENSE IN LICENSE.md` (override with `PACKAGE_LICENSE`), the notice
text itself ships as `LICENSE.md` — a copy of the single shared
`scripts/exporters/docs/LICENSE.md.template` all seven exporters copy from,
so the terms cannot drift between packages — and `manifest.json` carries a
`rights` block (`rights_holder`, `terms_url`, `attribution`) a consuming
website reads to render a source credit.
