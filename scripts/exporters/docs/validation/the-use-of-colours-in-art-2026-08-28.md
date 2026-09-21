# The Use of Colours in Art data-package validation — 2026-08-28

Validation of the first `the-use-of-colours-in-art` export against the legacy
ground truth. As with [amulets](amulets-2026-08-27.md)
and [carpets](carpets-2026-08-27.md), the comparison is
against the **running legacy instance**
(<https://exhibitions.museumwnf.org/the_use_of_colours_in_art/en/api/v2/…>)
rather than the offline dumps in `.legacy-database/`, because the DXA API is
still live and public and therefore reflects every server-side filter and quirk
a dump does not show.

Export run against the **staging** inventory database (the 2026-08-28 full
re-import), `BASE_URL=https://inventory.metanull.eu`:

```bash
docker compose --profile jobs run --rm exporter the-use-of-colours-in-art --force
```

Two importer repairs were applied to staging first and are part of this work —
`exhibition-i18n-text-backfill` and a re-run of `thg-theme-item`. Both are
explained under [Importer defects found](#importer-defects-found-and-fixed).

## Counts: legacy API vs exported

| Metric | Legacy endpoint | Legacy | Exported | Verdict |
|---|---|---|---|---|
| Items (membership union) | `/items` `page.total` | 171 | 171 | ✅ exact |
| Themes (top level) | `/thg/galleries/47/en/themes?bt=1` | 5 | 5 | ✅ exact |
| Sub-themes | `…/themes?bs=1` | 10 | 10 | ✅ exact |
| Curated pictures | sum of `itemIdList` over all 15 | 194 | 194 | ✅ exact, **per theme** |
| Related content | `exhibitionRelatedContents` | 10 | 10 | ✅ exact |
| Facet tags — total | `/items/tags` | 293 | 293 | ✅ exact |
| Facet tags — artist / dynasty / material / subject / type | `/items/tags` | 45 / 18 / 97 / 34 / 99 | same | ✅ exact |
| Worldwide timeline events | `/events/count` | 1,390 | 1,390 | ✅ exact |
| Timeline countries | `/events/countries` | 26 | 26 | ✅ exact |
| Exhibition-local timeline events | `/thg/timeline` | 45 | 45 | ✅ exact |
| Partners (museums + SH partners) | `/partners` | 75 | 75 | ✅ exact (was 77 — see exclusions) |
| Institutions | `/institutions` | 11 | 11 | ✅ exact |
| Partners shipped | union of the two endpoints | 85 | 85 | ✅ exact |
| Item countries | `/items/countries` | 32 | 31 | ⚠️ `in` missing — see gaps |
| Countries shipped | union of item + partner + timeline | 35 | 34 | ⚠️ same cause |
| Enabled languages | `i18nLinks` | en | en | ✅ exact |

The tag check is not just a count: all **293 legacy tag ids, their categories
and their English labels are identical** to the exported `legacy_tag_id` /
`category` / `label` triples, with no id on either side that the other lacks.

The theme check is not just a total either — the comparison is **per theme**,
all fifteen, and every one matches (7/5/6/5/7 top level, 13/29/14/8/8/14/16/18/
23/21 sub-themes).

## Membership: set equality, not a count

Every legacy `dbUid` was compared against the exported
`backward_compatibility`, normalising both to their identity tail:

```
legacy 171 · exported 171 · only in legacy: /explore/monuments/1419
                          · only in export: mwnf3:monuments:BAR:it:Mon13:14
```

That single pair is **the same monument**, not a discrepancy. Palazzo Chigi in
Ariccia exists in legacy twice — as Explore monument 1419 and as BAR
`it/Mon13/14` — and the importer deduplicated them, keeping the BAR identity and
re-parenting the Explore pictures (`mwnf3_explore:monument_picture:1419:_:*`)
onto it. There is no `mwnf3_explore:monument:1419` item at all. Both sides
therefore count 171, and the exhibition's theme-15 selection resolves correctly
through the BAR parent.

The per-project split is identical, and it is the split rather than the total
that says the union was resolved rather than approximated:

| Project | Legacy `/items` | `items[].project_key` |
|---|---|---|
| AWE (Sharing History) | 39 | 39 ✅ |
| BAR | 34 | 35 ¹ |
| EPM | 28 | 28 ✅ |
| EXHCOLOUR (native) | 24 | 24 ✅ |
| ISL | 22 | 22 ✅ |
| DCA | 12 | 12 ✅ |
| GALLERIES | 6 | 6 ✅ |
| DGA | 2 | 2 ✅ |
| (no project) | 4 | 3 ¹ |

¹ The same deduplication: the merged monument counts as BAR here and as
project-less in legacy.

## Partners: the union of two legacy endpoints

Legacy serves museums and monument-owning institutions from different endpoints
because it has two page templates. The package ships one file and the viewer
routes by `type`, so the right comparison is against the union:

| | Legacy | Exported |
|---|---|---|
| `/partners` (53 mwnf3 museums + 22 SH partners) | 75 | 75 |
| `/institutions` (9 mwnf3 institutions + 2 SH) | 11 | 11 |
| Distinct (2 SH partners appear on both) | 85 | 85 |

Reaching 75 required reproducing legacy's two hardcoded exclusions, which the
first two forks recorded and skipped:

```sql
, finalListMwnf3Partner AS (
    SELECT DISTINCT * FROM searchedMwnf3Partner
    WHERE NOT( (countryId = 'uk' AND partnerId = 'Mus51')
            OR (countryId = 'us' AND partnerId = 'Mus51') )
)
```

Both hold member items here (six and seventeen), so skipping the rule ships 77.
The rule carries no explanation in the legacy source and none was invented — it
is reproduced because it is what the site shows.

MWNF-384's third branch fires on nobody: no `mwnf3.museums` row has
`project_id = 'EXHCOLOUR'`, and the run logs `0 holding no member item`.

## Exhibition chrome, field by field

Compared against `/thg/galleries/self`:

| Field | Verdict |
|---|---|
| `exhibitionTitle` | ✅ identical |
| `exhibitionSubtitle` | ✅ identical |
| `exhibitionHeadline` | ⚠️ identical but for one trailing `\n` (428 vs 427 chars) |
| `exhibitionAbout` | ✅ both empty |
| `exhibitionPopupLogo` | ✅ identical (HTML block, 1,024 chars) |
| `hasTimeline` / `hasCountryBasedTimeline` | ✅ true / false |
| `hidden`, `liveDate` | ✅ false, 1978-08-05 |
| `featured` | ❌ **expected disagreement** — see below |
| `i18nLinks` (enabled languages) | ✅ en only |
| `otherLanguages` (UI roster) | ✅ de + en |

`featured` is the one field where a live-API parity check is expected to
disagree, exactly as on carpets. `WithTHGTemporaryTables.php` builds it by
copying the `hidden` projection — `CASE WHEN featured = 'A' THEN 0 ELSE 1 END` —
without flipping the polarity, so the API reports the inverse of the record.
Gallery 47 is `featured = 'A'` (one of the ten hand-picked rows) and the live API
answers `featured: false`. The package ships the documented meaning.

## German: enabled is not the same as translated

The German instance exists and is not a site:

| | `en` | `de` |
|---|---|---|
| `exhibition_i18n.enabled` | `Y` | `N` |
| `exhibitionTitle` from the live API | "The Use of Colours in Art" | `null` |
| `/items/count` | 172 ¹ | **5** |
| `/events/count` | 1,390 | **0** |
| Theme translations in the inventory DB | 15 | 15 |

¹ `/items/count` answers 172 while `/items` `page.total` answers 171 — a legacy
inconsistency. The full paginated fetch returns 171 records, which is what the
export matches.

So German curated text exists throughout (all 15 themes, 15 of 166 picture
descriptions, 4 of 89 related-link descriptions) but is not published.
`exhibition.json` carries `languages: ["de","en"]` and
`languages_enabled: ["en"]`, and per decision Q2 only the `en` build should
ship. **The story description says de+en; the data says en.**

## Importer defects found and fixed

Three, all found by this validation and all fixed in the same change.

### 1. `exhibition_i18n` subtitle / heading / about were unrecoverable

`ThgGalleryTranslationImporter` selected all three from legacy and wrote them
joined into `collection_translations.description` with `\n\n` between them. The
join is lossy — `about` contains blank lines of its own — so no exporter could
render the three fields legacy renders in three different places. They are now
preserved individually in `extra.exhibition_i18n`, with an
`exhibition-i18n-text-backfill` phase-11 step for databases imported before the
fix. Applied to staging: **7 rows imported, 0 skipped, 0 errors**, and a second
run skips all 7.

### 2. `thg-theme-item` lost five curated pictures to importer ordering

The exhibition exported 189 of legacy's 194 selections. The missing five were
exactly the Explore-monument references — theme 1 (one), theme 5 (three), theme
15 (one) — and the cause was ordering, not resolution:

- the resolver produces the right key for all five
  (`mwnf3_explore:monument_picture:206:_:1` and friends), verified by running it
  over the live legacy rows;
- those picture items all exist in the inventory database;
- yet no `collection_item` row was ever written for them.

`thg-theme-item` declared dependencies on the six mwnf3/SH **item** importers
and named neither `explore-monument-picture` nor `travels-monument-picture`,
even though `thg-theme-item-resolver.ts` resolves both families. Registry order
happened to run Explore first most of the time; on the 2026-08-28 import it did
not. Re-running `thg-theme-item` alone afterwards imported all **1,284 rows with
0 skips and 0 errors**, which is what "ordering, not resolution" looks like, and
the exhibition went from 189 to 194. The dependency list now names both picture
families.

### 3. Sponsor logo captions and links are dropped (not fixed)

`ThgGalleryContentImporter` reads `label`, `link`, `category_id`, `visible` and
`further_reading` from `exhibition_logo` and writes only `alt` and
`display_order`, because `collection_images` has no `extra` column. This
exhibition's single logo loses its caption, its href and its category. Fixing it
needs a schema change and is left as a separate issue; `exhibition.json.logos[]`
ships the image, the legacy path and the order.

## Remaining gap — closed after this validation

This document records the state of the export on **2026-08-28**, and on that day
two importer gaps were open: sponsor logos lost their caption, link and category
(§ 3 above) and every one of the 106 imported `mwnf3_explore:monument:*` items
had `country_id = NULL`, which cost `countries.json` exactly one entry — `in`
(India), reached through monument 1792 — so 34 countries shipped where legacy's
union is 35.

Both were raised as their own stories and fixed:
[#1592](https://github.com/museumwithnofrontiers/inventory-app/issues/1592) adds an `extra`
column to `collection_images` and imports the logo passenger data;
[#1593](https://github.com/museumwithnofrontiers/inventory-app/issues/1593) resolves the
Explore `locationId → countryId` hop at import time, with a phase-11 backfill for
databases imported before the fix.

The corrected expectations, superseding the ⚠️ rows in the counts table above,
are therefore:

| Metric | Legacy | Expected after #1592/#1593 |
|---|---|---|
| Item countries (`/items/countries`) | 32 | 32, with `in` present |
| Countries shipped (item + partner + timeline union) | 35 | 35, with `in` present |
| `exhibition.json.logos[0]` | `exhibitionLogos` | `labels.en` "United Nations Alliance of Civilizations", `url` `https://www.unaoc.org/`, `category_id` 2 / `category_name` "Footer 2", `visible` true |

**Re-validation is pending.** Confirming those numbers needs a staging database
re-imported (or backfilled) with both fixes and a fresh export run; until that
happens the figures above are the expectation, not a measurement, and the counts
table in this document stands as the 2026-08-28 record. A later run should be
recorded in a new dated validation document rather than by editing this one.

## Reproducing this validation

The legacy instance is public and needs no credentials:

```bash
curl -s https://exhibitions.museumwnf.org/the_use_of_colours_in_art/en/api/v2/items/count
curl -s https://exhibitions.museumwnf.org/the_use_of_colours_in_art/en/api/v2/thg/galleries/self
curl -s "https://exhibitions.museumwnf.org/the_use_of_colours_in_art/en/api/v2/thg/galleries/47/en/themes?bt=1"
curl -s "https://exhibitions.museumwnf.org/the_use_of_colours_in_art/en/api/v2/thg/galleries/47/en/themes?bs=1"
curl -s https://exhibitions.museumwnf.org/the_use_of_colours_in_art/en/api/v2/thg/timeline
```

`/items` paginates with `?page=N`; pages after the first return the item map
keyed by absolute offset rather than as an array, so iterate until a page comes
back empty rather than trusting `page.pages`, which is blank on this instance.
