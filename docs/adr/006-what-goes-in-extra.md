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
2. **Links hold the structure, next to that text.** `start_date`, `country`, `partner`, the Dynasty and Artist links, and the Author links for credits. A link drives indexes and filters; the text is what a sheet prints. One doesn't replace the other.
3. **The row's legacy key goes in `backward_compatibility`**, never in `extra`. The column holds one string. So another legacy code is dropped when it only repeats the key, and gets a home when an exporter needs it.
4. **Site configuration belongs to the sites:** the instance files (`scripts/exporters/instances/*.json`) and the site repos. The inventory keeps only the editorial flags `visible`, `featured` and `published_at`.
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

## Consequences

- Every M16 story moves its keys into columns, links or models, with the panel fields to edit them. A key that leaves `extra` without a field in the panel is not done.
- The exporters read the new homes, and every data package comes out identical, apart from any difference a story names.
- `inventory:extra-census` measures the result. `--expect <file>` fails when a moved key reappears; each epic commits the file it expects.
- After M16, about 3,400 rows should keep `extra`. The keys that stay are listed in #2625, for example Sharing History's own picture fields, `binding_desc` and `structured_bibliography`.
- A new importer step that needs a place for a legacy field adds a column or a link. It doesn't write `extra`, unless the field is a true one-off under rule 5.
- The four item types (object, monument, detail, picture) keep one `items` table and one item translation table; [Item types and their translation columns](../models/item-types) says which columns serve which type.

## Alternatives not taken

- **One table per item type.** It would match legacy's tables, but every relation (collections, tags, images, documents, links) would need four forms, and the sites already treat an item as one thing.
- **Typed JSON schemas on `extra`.** Validation alone wouldn't give the panel editable fields, and it would keep the content out of the model.
