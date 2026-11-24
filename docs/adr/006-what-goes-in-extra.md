---
layout: default
title: ADR 006 — What goes in extra
parent: Architecture Decisions
nav_order: 6
---

# ADR 006 — What goes in `extra`

- **Status:** Accepted (Pascal, 2026-11-18)
- **Date:** 2026-11-18
- **Milestone:** M16 — Model: retire extra (#2625, Epic A #2626, Story A1 #2633)

## Context

Most inventory tables have an `extra` JSON column. The importer put every legacy field without a column there, and the exporters read the content the sites show from it. On 2026-11-18, after reimport 16, 72,145 rows carried `extra` (`inventory:extra-census`, `docs/models/extra-census-2026-11-18.json`). Most of it was item translation content: materials, dynasty, artist lines, credits, keywords, visit information.

The panel can't edit `extra` as fields. An editor can't correct the dynasty line of an object, a partner's opening hours or a gallery's banner, so data that the sites print sits outside the model.

## Decision

### The rule

1. **Translation columns hold the display text, as written.** `dates`, `location` and `holder` already do. Nothing is reworded or merged on the way in: legacy's text is what the sites print.
2. **Links hold the structure, next to that text.** `start_date`, `country`, `partner`, the Dynasty and Artist links, and the Author links for credits. A link drives indexes and filters; the text is what a sheet prints. One doesn't replace the other, and neither is derived from the other: no link, Artist or Tag is made from a display text, and no display text is rebuilt from links (2026-11-19). An item with a text and no link is a normal state; linking it is editorial work in the panel.
3. **The row's legacy key goes in `backward_compatibility`**, never in `extra`. The column holds one string. So another legacy code is dropped when it only repeats the key, and gets a home when an exporter needs it.
4. **Site configuration belongs to the sites:** the instance files (`scripts/exporters/instances/*.json`) and the site repos. The inventory keeps one fact about readiness, `draft` (on collections, items and item texts): the record isn't ready for any site. A gallery's featured flag and live date are site configuration (M17, #2741, amended 2026-11-22).
5. **`extra` keeps only true one-offs.** A key gets a home in the model when more than one importer step writes it, or when an exporter reads it as content.
6. **No legacy field is merged into another,** and no text is edited on the way in.

### The decisions (#2625, Pascal, 2026-11-18)

| # | Question | Decided |
|---|---|---|
| 1 | Dynasty and artist lines: legacy's text, or the linked record's name? | **(a)** The text stays as written, in item translation columns next to the links. Only 1,811 of 13,665 dynasty texts equal the linked Dynasty's name, and an Artist had one name for every language. |
| 2 | `credits_as_written`: drop it, or keep it? | **(b)** Kept as written in four item translation columns, named like Publication's `author_credit`: `author_credit`, `copy_editor_credit`, `translator_credit`, `translation_copy_editor_credit`. A line rebuilt from the Author links changed on 6,091 of 8,453 rows (2,496 on Arabic pages). |
| 3 | An ISL or IAM picture's own copyright | **(b)** The copyright chain (image → Project → fallback, `ResolvesCopyright`) is not touched. A `credit` column on the image models holds the picture's own text where it is not the burned one. |
| 4 | Caption overrides on placements | **(a)** Every placement keeps its own caption on its placement translation. |
| 5 | Visit information | **(a)** One translatable model, shared by monuments, travel locations and partners. |
| 6 | Site configuration | **(a)** It goes to the instance files and site repos. A `site_settings` JSON column would be `extra` under another name. |
| 7 | Partner category, portal display, city | Three columns on partners: `category`; `featured`, from `portal_display`, which Explore and the galleries ship as a partner's `featured` flag; `city`, one value for every language, which the Sharing History partner list prints. |

### Decisions taken during M16 and M17 (Pascal)

| Date | Question | Decided |
|---|---|---|
| 2026-11-19 | May a link, Artist or Tag be made from a display text, or a text rebuilt from links? | No, either way (rule 2). Display text and documentation links stay apart too: neither is derived from the other. |
| 2026-11-20 | Sharing History's `second_name` ("Other name") and its one `name2` ("Also known as") | `second_name` is the `alternate_name` column, which mwnf3's `name2` fills elsewhere (no text has both). Sharing History's single `name2` stays in `extra` as a one-off (B7, #2690). |
| 2026-11-20 | Glossary links in the Sharing History second names now in `alternate_name` | Kept, as for mwnf3's "Also known as". |
| 2026-11-20 | Dynasty images in the packages | Stable, in legacy's order of a dynasty's items (start date, project, country, partner, number), then the item's first picture (G5, #2704). |
| 2026-11-20 | Explore's `period_from`/`period_to` | Into those monuments' `start_date`/`end_date` (G2, #2697). |
| 2026-11-20 | A timeline event with no end year | `year_to` is nullable: no end year, not 0 (G2, #2697; G3, #2699). |
| 2026-11-20 | Object start and end years written as a decade ("1960s") | Kept as legacy's API reads them (the leading integer), the text as written in `dates`; typos are fixed in legacy (#2339). |
| 2026-11-21 | The Artists the importer split from the artist lines (legacy has no artist table) | The importer makes no Artist and no item-Artist link from the lines (rule 2). Artists are editorial records, created and linked in the panel. The packages keep `artist_names`, filled from those links (#2734). |
| 2026-11-21 | `visible`, `featured` and `published_at` on collections (M17, #2741) | `draft` replaces `visible`: a collection, item or item text not ready for any site; no exporter ships a draft or anything under it (Sharing History keeps shipping a draft exhibition as unpublished, as legacy did for its exhibition 2). `featured` and `published_at` (legacy `live_date`) are site configuration, in the gallery instance files. The API and the MCP server return drafts with their flag. A draft is not a takedown: `/pub` keeps serving its images. |
| 2026-11-21 | Item text `status` (published, unedited, hidden) | Replaced by `draft`. `unedited` was never imported. `hidden`, Sharing History's "illustration only" flag (legacy `display_status = 'N'`), is how that one site lists an item, not a draft: it stays in `extra` as `sh_display_status` on the item's Sharing History texts, an exception to rule 4, for maintainability (an instance-file list of 462 items is not practical; `items` has no `extra`). |
| 2026-11-21 | `partners.visible`, Project `is_launched` / `is_enabled` | Dropped: nothing read them, and the inventory doesn't work out whether a partner or a project is shown. A participation's `visible` stays. Project `launch_date` stays: the date MWNF started the work. Legacy's per-exhibition partner flag (UNAOC on Colours) is not imported, since legacy's client never reads it. |

### Result

The full reimport of 2026-11-20 (G1, #2655) left **962 rows** with `extra`, against 72,145 before and the design's estimate of about 3,400: every key within [`extra-census-m16.json`](../models/extra-census-m16.json), the census in [`extra-census-2026-11-20.json`](../models/extra-census-2026-11-20.json). Every data package difference it caused is one a decision above names, and parity showed no regression.

## Consequences

- Every M16 story moves its keys into columns, links or models, with the panel fields to edit them. A key that leaves `extra` without a field in the panel is not done.
- The exporters read the new homes, and every data package comes out identical, apart from any difference a story names.
- `inventory:extra-census` measures the result. `--expect <file>` fails when a moved key reappears; each epic commits the file it expects. Since 2026-11-24, [`extra-census.json`](../models/extra-census.json) lists every key at its count, and `--strict` also fails on a key the file doesn't list, so a new key gets a decision before it stays.
- After M16, about 3,400 rows should keep `extra`. The keys that stay are listed in #2625, for example Sharing History's own picture fields, `binding_desc` and `structured_bibliography`.
- A new importer step that needs a place for a legacy field adds a column or a link. It doesn't write `extra`, unless the field is a true one-off under rule 5.
- The four item types (object, monument, detail, picture) keep one `items` table and one item translation table; [Item types and their translation columns](../models/item-types) says which columns serve which type.

## Alternatives not taken

- **One table per item type.** It would match legacy's tables, but every relation (collections, tags, images, documents, links) would need four forms, and the sites already treat an item as one thing.
- **Typed JSON schemas on `extra`.** Validation alone wouldn't give the panel editable fields, and it would keep the content out of the model.
