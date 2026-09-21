# Water in Islam data-package validation — 2026-08-29

Validation of the first `water-in-islam` export against the legacy ground truth.
As with [Colours](the-use-of-colours-in-art-2026-08-28.md),
the comparison is against the **running legacy instance**
(<https://exhibitions.museumwnf.org/water_in_islam/en/api/v2/…>) rather than the
offline dumps in `.legacy-database/`, because the DXA API is still live and
public and therefore reflects every server-side filter a dump does not show —
and because the dumps are demonstrably behind here: they carry no
`exhibition_related_content` rows for gallery 56 at all, while the live table
has five.

Export run against the **staging** inventory database, `BASE_URL=https://inventory.metanull.eu`:

```bash
docker compose --profile jobs run --rm exporter water-in-islam --force \
    --base-url https://inventory.metanull.eu
```

One importer repair was applied to staging first and is part of this work: a
re-run of `thg-theme-item-translation`, which had been wiped by a later re-run
of `thg-theme-item`. See [Importer defects found](#importer-defects-found).

The figures below were taken before #1592's sponsor-logo work landed on `main`
and re-checked after rebasing onto it. Only `exhibition.json.logos[]` changed:
this exhibition's single logo now carries its caption ("United Nations Alliance
of Civilizations"), its `https://www.unaoc.org/` link and its "Footer 1"
category, where before it carried the image and the display order alone. No
count in the table moved.

## Counts: legacy API vs exported

| Metric | Legacy endpoint | Legacy | Exported | Verdict |
|---|---|---|---|---|
| Items (membership union) | `/items` `page.total` | 492 | 495 | ⚠️ superset of 3 — see below |
| Themes (top level) | `/thg/galleries/56/en/themes?bt=1` | 6 | 6 | ✅ exact |
| Sub-themes | `…/themes?bs=1` | 22 | 22 | ✅ exact |
| Curated pictures | sum of `itemIdList` over all 28 | 432 | 432 | ✅ exact, **per theme** |
| Facet tags — total | `/items/tags` | 245 | 245 | ✅ exact |
| Facet tags — artist / dynasty / material / subject / type | `/items/tags` | 11 / 29 / 99 / 18 / 88 | same | ✅ exact |
| Worldwide timeline events | `/events/count` | 1,390 | 1,390 | ✅ exact |
| Exhibition-local timeline | `/thg/timeline` | none | none | ✅ exact |
| Partners (museums) | `/partners` | 98 | — | — |
| Institutions | `/institutions` | 21 | — | — |
| Partners shipped, minus hidden | union of the two endpoints | 117 | 117 | ✅ exact |
| Item countries | `/items/countries` | 33 | 33 | ✅ exact, set equality |
| Related content | `exhibitionRelatedContents` | 5 | 0 | ❌ importer gap |
| Enabled languages | `i18nLinks` | en | en | ✅ exact |

The theme check is not a total: the comparison is **per node**, all twenty-eight
of them, and every one matches.

The tag check is not just a count either — all 245 legacy tag ids and their
categories are identical to the exported `legacy_tag_id` / `category` pairs,
with no id on either side that the other lacks.

## Membership: set equality, not a count

Every legacy `dbUid` was compared against the exported
`backward_compatibility`, normalising both to their identity tail (legacy's
`/sh/objects/awe/dz/64` and the package's
`mwnf3_sharing_history:sh_objects:awe:dz:64` are the same record spelled two
ways):

```
legacy 492 · exported 495 · only in legacy: (none)
                          · only in export: objects/awe/tr/3
                                            objects/awe/uk/135
                                            objects/galex6/es/mus81/4
```

**Nothing legacy publishes is missing.** The three extras are members of the
legacy link tables that the live API refuses to serve; each was probed
individually:

| Item | Legacy probe | Reading |
|---|---|---|
| `mwnf3:objects:GalEx6:es:Mus81:4` | `/mwnf3/objects/GalEx6/es/Mus81/4/en` → **404**, `…/es` → **200** ("Brocal de pozo") | The record exists in Spanish only. A per-language build cannot render it, and legacy's English instance drops it. |
| `mwnf3_sharing_history:sh_objects:awe:tr:3` | `/sh/objects/awe/tr/3/en` → **404** | Has an English translation and an image in inventory. Suppressed by legacy for a reason not visible through the API. |
| `mwnf3_sharing_history:sh_objects:awe:uk:135` | `/sh/objects/awe/uk/135/en` → **404** | Same. |

A control probe confirms the paths themselves are right:
`/sh/objects/awe/dz/64/en` → **200**.

The first case is a general rule and belongs to the viewer rather than the
package: `items[].languages` already carries what each record can be rendered
in, so a per-language build can apply it without the exporter deciding for
every future build. The other two are recorded as unexplained; three records in
495 is 0.6%, and none of them appears in a theme.

## Partners: exact once E6 is applied

Legacy splits monument-owning institutions from museums because it has one page
template and one query each, and it hides eleven museums server-side. The
package ships the union with the hidden ones flagged rather than dropped, so the
raw counts cannot agree and the derived one must:

```
exported 128 − 11 hidden = 117
legacy /partners 98 ∪ /institutions 21 = 117 distinct
```

Set comparison over `(country, partnerId)` shows no partner on either side that
the other lacks. The eleven hidden museums are exactly the eleven in
`exhibition.json.hidden_partner_ids`, and three of them hold member items —
`us/Mus82` holds 26 — which is why they are exported at all.

## Importer defects found

### 1. `thg-theme-item` wipes the curated per-picture texts (fixed on staging)

`collection_item.extra` was NULL for every theme selection in the database —
all 432 here and all 194 on Colours — even though the 2026-08-27 full import
logged *"988 imported"* for THG Theme Item Translations.

The cause is
[`writeCollectionItem`](../../../importer/src/strategies/sql-strategy.ts): it
writes `ON DUPLICATE KEY UPDATE … extra = VALUES(extra)`, so re-running
`thg-theme-item` — which passes no `extra` — rewrites every pivot with NULL and
destroys whatever `thg-theme-item-translation` had put there. Every theme pivot
in staging carried a single `updated_at` hours after the import ended.

Re-running the translation step alone restored 996 rows, of which 377 belong to
this exhibition and 170 to Colours. The ordering hazard is general: any step
that writes a `collection_item` row after a step that decorates it will silently
undo the decoration, and the affected step reports success either way.

### 2. Related content with no URL is dropped entirely

`ThgGalleryContentImporter` models `exhibition_related_content` as
`collection_media`, and
[`importRelatedContentBaseRows`](../../../importer/src/importers/phase-10/thg-gallery-content-importer.ts)
writes a row only for a legacy entry carrying a `link` or an
`uploaded_document`. All five of this exhibition's entries are pure
`further_reading` bibliographies with neither, so nothing is written:

```
legacy exhibition_related_content rows read: 32
collection_media rows landed:  gallery 52 → 16, gallery 47 → 14, gallery 50 → 2
galleries with entries and no media:  54 (1 entry), 56 (5 entries)
```

The import reports `12 skipped` for the step and moves on. Colours was
unaffected because every one of its ten entries has a document or a URL, which
is why this only surfaced on the second exhibition.

## What this fork proves about the specification

Three claims in `dxa-exhibition-data-package.md` were written from a single
exhibition and are now tested against a second:

- **`has_timeline` gates navigation, not data.** Colours has a local chronology
  and reports `true / false`; this exhibition has none and reports `false /
  false` — and both answer `/events` with the identical 1,390-event worldwide
  merge. Neither flag may be read as an instruction to omit `timelines.json`.
- **`languages` and `languages_enabled` are separate fields.** They differ on
  Colours and agree here. Deriving either from the other breaks one of the two.
- **The theme id in the keyspace is not the display order.** Colours' top-level
  themes are 0, 1, 2, 3, 11 in display order 1–5; this exhibition's are 0–5 in
  order. A rule re-derived from this site alone would have been wrong for the
  other.

The sizing estimate in the specification (`~424 items, 18 themes, ~432
pictures`) was exactly right about the pictures and wrong about the other two:
492 legacy items against ~424, and a tree of 6 + 22 against 18. The
specification is corrected with the measured figures.
