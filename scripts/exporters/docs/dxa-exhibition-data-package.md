# DXA Exhibition data package — specification

Date: 2026-08-27 · Applies to every DXA Exhibition site (pilots:
**the-use-of-colours-in-art** gallery 47/EXHCOLOUR de+en, **water-in-islam**
gallery 56/GalEx6 en; generalizes to all 6 exhibitions). Package/folder names
are the kebab-cased legacy slugs (decision Q4); data values keep the
underscore slugs. Requirements source: `dxa-legacy-analysis.md`.

An Exhibition package is a **superset of the Gallery package**: everything in
`dxa-gallery-data-package.md` applies unchanged (items = membership union,
tags, partners, glossary, countries, languages, translations layout,
manifest), plus the curated theme layer and exhibition-specific chrome
described here, and one substitution:

1. `gallery.json` → **`exhibition.json`** (richer identity).

> **Corrected 2026-08-28 while building the Colours exporter.** This section
> originally said the global country timeline is *replaced* by the exhibition's
> THG-local timeline. It is not: the live instance serves **both**, from two
> endpoints — `/thg/timeline` returns the exhibition's own 45 events while
> `/events` returns the same 1,390-event, 26-country worldwide merge every
> gallery gets. `has_timeline` / `has_country_timeline` gate nav entries, not
> data (carpets reports both false and still answers `/events` with the
> worldwide list). See "timelines.json / timeline_events.json" below.

## Additional / changed files

```
exhibition.json            ← replaces gallery.json
themes.json                ← the curated tree (the heart of the product)
related_content.json       ← categorized external links
translations/
  themes.<lang>.json       ← theme titles/quotes/presentations + curated texts
```

## exhibition.json

```jsonc
{
  "id": "<collection uuid>",
  "backward_compatibility": "mwnf3_thematic_gallery:thg_gallery:47",
  "slug": "the_use_of_colours_in_art",   // load-bearing: legacy public URL path
  "legacy_host": "https://exhibitions.museumwnf.org",
  "mwnf3_project_id": "EXHCOLOUR",
  "kind": "exhibition",
  "languages": ["de", "en"],              // thg_gallery_lang — the UI roster
  "languages_enabled": ["en"],            // exhibition_i18n.enabled = 'Y' only
  "titles":    { "de": "…", "en": "…" },  // exhibition_i18n.title
  "subtitles": { "de": "…", "en": "…" },
  "headlines": { "de": "…", "en": "…" },  // banner heading
  "abouts":    { "de": "…", "en": "…" },  // about page body (curated, data — unlike galleryAbout)
  "popup_logo": { "show": true, "image_url": "…" },
  "banner_image_url": "…",
  "has_timeline": true,
  "partners": [                            // exhibition_partner: bottom-banner strip
    { "partner_id": "<uuid>", "category": "…", "display_order": 1 }
  ],
  "logos": [{                              // exhibition_logo: sponsor logos
    "id": "<collection_image uuid>",
    "image_url": "https://inventory.metanull.eu/pub/….png",
    "legacy_path": "unaoc_logo.jpg",       // collection_images.original_name
    "alt_text": "…|null",                  // the column's single alt — fallback for alt_texts
    "url": "https://www.unaoc.org/|null",  // exhibition_logo.link: the logo is a hyperlink
    "labels":    { "en": "United Nations Alliance of Civilizations" },  // the rendered caption
    "alt_texts": { "en": "…" },
    "further_readings": { "en": "…" },
    "category": "Footer 2|null",           // exhibition_logo_category.name
    "category_id": 2,                      // 0 Header, 1–4 Footer 1–4
    "visible": true,                       // hidden logos ship too — filtering is the viewer's job
    "display_order": 1
  }],
  "hidden_partner_ids": ["<uuid>", …]      // E6: exclude everywhere (Water in Islam: 11, measured)
}
```

Note the split: `abouts` (exhibition_i18n, curated per-exhibition **data**)
lives in the package, while gallery About pages (i18n-group editorial) do not.
Both exist for exhibitions — the exhibition About page renders
`exhibition_i18n.about`; UI labels still come from site-i18n.

Two things about the language fields, both learned from Colours:

- **`languages` and `languages_enabled` are different sets and the difference is
  load bearing.** Colours' UI roster is de+en and every one of its 15 themes has
  German translations, but `exhibition_i18n.enabled` is `'N'` for German — and
  the live German instance is a shell: `exhibitionTitle: null`,
  `items/count: 5`, `events/count: 0`. Per decision Q2 `languages_enabled`
  decides which per-language builds ship; `languages` only says what text the
  package carries. Do not derive one from the other.
- **`subtitles` / `headlines` / `abouts` need an importer fix to exist.**
  `ThgGalleryTranslationImporter` originally joined all three legacy columns into
  `collection_translations.description` with blank lines between them, which
  cannot be undone (`about` contains blank lines itself). They are preserved
  individually in `extra.exhibition_i18n` as of #1546, with an
  `exhibition-i18n-text-backfill` step for older databases. An exporter running
  against a database that predates it should log the shortfall by name rather
  than silently shipping an exhibition with no sub-title.

`logos[]` reads two mechanisms of #1592, and both matter for anyone porting
this to another exhibition:

- **The entries are the logo-TAGGED collection images**, identified through
  `collection_image_tag` by the `image-type` / `logo` tag. A collection can own
  images that are not sponsor logos, so the exporter never exports
  `collection_images` wholesale. Match the tag on its identity
  (`internal_name` + `category`), not on its `backward_compatibility`: that
  string carries a language segment (`mwnf3:tags:image-type:eng:logo`) and the
  tag table is unique per `(internal_name, category, language_id)`.
- **Everything besides the image rides in `collection_images.extra`** — `link`,
  `category_id`, `category_name` (denormalized at import so no exporter needs
  the legacy database), `visible`, and the `labels` / `alts` /
  `further_readings` maps merged from `exhibition_logo_i18n`. `labels` is the
  string the page renders, and it is worth the trip: the base row says "UNAOC"
  while the i18n row — like the live API — says "United Nations Alliance of
  Civilizations". In the column those maps are keyed by the inventory's 3-char
  language id; the package re-keys them to 2-char codes like every other
  language map here, skipping a language the inventory carries no code for.

Against a database that predates the migration, the backfill or a fresh import,
no image carries the tag and `logos` ships empty; the exporter warns by name
when the collection has images but none of them is a logo, so that state is
visible rather than indistinguishable from a logo-less exhibition.

## themes.json

The ordered tree, one level of nesting (theme → sub-theme), with the curated
pictures inline:

```jsonc
[{
  "id": "<collection uuid>",              // BC mwnf3_thematic_gallery:theme:47:3
  "display_order": 3,
  "cover_picture_item_id": "<uuid|null>", // E4: theme_cover_image
  "sub_themes": [ /* same shape, no further nesting */ ],
  "pictures": [{
    "picture_item_id": "<uuid>",          // the `picture` child item (type='picture')
    "parent_item_id": "<uuid>",           // the object/monument the picture belongs to
    "display_order": 1,
    "image_url": "https://inventory.metanull.eu/pub/….jpg",
    "related": [{                          // theme_item_related (directional)
      "picture_item_id": "<uuid>",
      "theme_id": "<uuid>",               // may be another theme (E5 cross-theme rows)
      "descriptions": { "en": "…" }        // directional text, per language
    }]
  }]
}]
```

Per-language curated texts go to `translations/themes.<lang>.json`, keyed by
collection/picture ids:

```jsonc
{
  "<theme collection id>": { "title": "…", "quote": "…", "presentation": "…" },
  "<theme id>/<picture item id>": {
    "contextual_description": "…",         // theme_item_i18n (E2/E3 complete)
    "image_caption": "…"
  }
}
```

Why pictures reference **both** the picture item and its parent: the theme
page renders the selected picture + curated text, and links "see the full
record" to the parent's item sheet (`/database-item/<parent BC>`). Parent
items are guaranteed present in `items.json` (they are members of the
exhibition collection universe; verify during implementation for the 26
E2-recovered Explore/Travel pictures — their parents come from the Explore/
Travels item families).

## manifest.json note

Identical spec to the Gallery package, `manifest.projects` included (epic
#1727 phase 2): one entry per project UUID referenced by anything this
package ships, keyed by that UUID, with a per-language `name` (from the
sibling Collection's translations) and the three nullable URL columns
(`site_url`, `related_database_url`, `artistic_introduction_url`). Collected
from the member items' `project_id` (`items.json`) plus the exhibition's own
native project (`exhibition.projectId`), the same way as the Gallery package.

## items.json note

Identical spec to the Gallery package. The exhibition's own pseudo-project
items (EXHCOLOUR/GalEx6) are ordinary members; `project_id` distinguishes
them from borrowed items so the sheet can suppress the "source database" link
for purpose-authored records exactly as legacy does
(`projectSourceIsExhibition` in the API response).

## partners.json note

Gallery spec plus (including `project_uuids`, epic #1727 phase 2 — see the
Gallery package's partners.json section):

- Institutions (monument owners) and museums both appear; the viewer routes
  museums to partner pages and institutions to institution pages by partner
  `type` (already in the shape). **The count therefore matches neither legacy
  endpoint alone.** Legacy splits them because it has two page templates and one
  query each — Colours answers `/partners` with 75 and `/institutions` with 11,
  two of which appear on both — and the package ships their union, 85. Check a
  fork against the union, never against `/partners`.
- **Legacy's two hardcoded exclusions must be reproduced.** The final CTE of
  `app/MWNF/SQL/mwnf3/Partners.blade.php` drops `uk/Mus51` and `us/Mus51` by
  name from every DXA partner list, with no explanation in the source. The
  amulets and carpets forks recorded the rule and skipped it because it matched
  nobody there; on Colours both rows hold member items (6 and 17) and skipping
  it ships 77 museums instead of 75. See `EXCLUDED_PARTNER_KEYS` in
  [`../the-use-of-colours-in-art/src/exporters/partner-exporter.ts`](../the-use-of-colours-in-art/src/exporters/partner-exporter.ts).
- Entries listed in `exhibition.json.hidden_partner_ids` are exported but
  flagged — the viewer must exclude them from every list/profile page while
  their items still render (legacy behaviour: the museum is hidden, the item
  is not).

## related_content.json

`exhibition_related_content` (32 rows across the 6 exhibitions):

```jsonc
[{ "category": "…", "url": "…", "titles": { "en": "…" }, "display_order": 1 }]
```

## media

Exhibition/theme audio+video (`exhibition_audio/video`, `theme_audio/video` →
collection_media) ride on the existing `media` arrays of `exhibition.json` /
`themes.json` entries, same shape as item media in current packages.

## timelines.json / timeline_events.json

**Both chronologies, in one pair of files** (corrected 2026-08-28 — see the
note at the top):

| `source` | Keyspace | Scope |
|---|---|---|
| `mwnf3` + `sharing_history` | as in the Gallery spec | the worldwide country timeline, 37 timelines / 26 countries / 1,390 events — identical on every DXA site |
| `thg_local` | `mwnf3_thematic_gallery:timeline:{gallery}` | the exhibition's own narrative chronology — Colours: 1 timeline, 45 events (English only in the data, despite the de+en expectation); Water in Islam: none |

The local timeline has **no `country_id`** — it is a chronology of a subject,
not of a place — so it contributes nothing to `countries.json` and a viewer must
not fold it into the per-country merge. That is what the `source` field is for.
Reference implementation: `localTimelineLikePattern` and `timelineSource` in
[`../the-use-of-colours-in-art/src/exporters/timeline-exporter.ts`](../the-use-of-colours-in-art/src/exporters/timeline-exporter.ts),
pinned by `tests/unit/timeline-scope.test.ts`. Note the local pattern has no
trailing `%`: `…:timeline:4` must not match gallery 47.

## Sizing expectation

Both pilots **as measured** (the estimates this section first carried — 117+24
items, 26 themes, ~150 pictures for Colours; ~424 items and 18 themes for Water
in Islam — were wrong everywhere except Water in Islam's picture count):

| | Colours (2026-08-28) | Water in Islam (2026-08-29) |
|---|---|---|
| Members | 171 (24 native EXHCOLOUR + 147 borrowed from seven projects) | 495 (314 native GalEx6; legacy publishes 492) |
| Theme tree | 5 + 10 | 6 + 22 |
| Curated pictures | 194 | 432 |
| Partners shipped | 85 | 128 (117 after the E6 hidden eleven) |
| Facet tags | 293 | 245 |
| Glossary terms | 147 | 249 |
| Related content | 10 | 5 in legacy, **0 imported** — see the Water in Islam README |

Both are far below the existing gallery packages.

Two counting traps worth knowing before comparing a fork against these numbers:

- **Themes and sub-themes are both `collections.type = 'theme'`**; the nesting is
  `parent_id`. Counting the type gives 15, counting the tree gives 5.
- **The theme id in the keyspace is not the display order.** Colours' five
  top-level themes are 0, 1, 2, 3 and **11**, displayed 1–5, and theme 6 does not
  exist at all.

## Reference implementation

[`scripts/exporters/the-use-of-colours-in-art`](../the-use-of-colours-in-art/README.md)
([story #1546](https://github.com/museumwithnofrontiers/inventory-app/issues/1546),
[`../the-use-of-colours-in-art/tools/VALIDATION-2026-08-28.md`](../the-use-of-colours-in-art/tools/VALIDATION-2026-08-28.md))
implements this specification and is verified against the live legacy API —
items, themes (per theme, all fifteen), pictures, tags, both timelines, related
content and partners all exact. **Fork it** rather than re-deriving the rules;
every correction marked above was found by counting against the running site,
and each had a wrong-looking alternative that still produced plausible output.

[`scripts/exporters/water-in-islam`](../water-in-islam/README.md)
([story #1548](https://github.com/museumwithnofrontiers/inventory-app/issues/1548),
[`../water-in-islam/tools/VALIDATION-2026-08-29.md`](../water-in-islam/tools/VALIDATION-2026-08-29.md))
is that fork, and its value to this specification is the three claims it
**tested** which Colours alone could only assert:

- `has_timeline` / `has_country_timeline` gate navigation, not data. Colours has
  a local chronology and reports `true / false`; Water in Islam has none and
  reports `false / false` — and both answer `/events` with the identical
  1,390-event worldwide merge.
- `languages` and `languages_enabled` are separate fields: they differ on
  Colours (de+en carried, en published) and agree on Water in Islam (en only).
  Deriving either from the other breaks one of the two.
- The theme id in the keyspace is not the display order. Colours' top-level
  themes are 0, 1, 2, 3, **11** in display order 1–5; Water in Islam's are 0–5
  in order. A rule re-derived from either site alone is wrong for the other.

It is also the first package where `hidden_partner_ids` is non-empty (eleven
museums), which is what makes the partner count check meaningful: the shipped
128 minus the hidden eleven is legacy's union of 117, exactly.

## Per-language deployment (decision Q2)

The package always carries **all** enabled languages (`languages_enabled` +
per-language translation files). Per decision Q2 the websites ship as
**per-language builds** (strict legacy parity): Colours deploys separately for
de and en, Water in Islam for en. The split happens at viewer build/deploy
time — one package feeds all language builds of its exhibition.
