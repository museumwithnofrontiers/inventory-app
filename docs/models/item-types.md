---
layout: default
title: Item types and their translation columns
parent: Database Models
nav_order: 2
---

# Item types and their translation columns

`items` holds four legacy concepts, told apart by `items.type`:

| Type | Legacy | What it is |
|---|---|---|
| `object` | museum objects (`mwnf3` objects, `sh_objects`) | a movable work held by a museum |
| `monument` | monuments (`mwnf3` monuments, `sh_monuments`, Explore, Travels) | a building or site |
| `detail` | monument details | a part of a monument shown on its own: a portal, a mihrab, a ceiling |
| `picture` | pictures of an object or monument | one picture with its own caption |

One `item_translations` table serves all four, per language and context. A column a type doesn't use stays empty for that type. Nothing is copied between columns to fill them (ADR 006).

## Which columns each type uses

Rows where the column is filled, on staging after reimport 17 (2026-11-18):

| Column | Object | Monument | Detail | Picture |
|---|---:|---:|---:|---:|
| translations | 15,419 | 10,483 | 2,167 | 43,730 |
| `name` | all | all | all | all |
| `alternate_name` | 460 | 1,045 | | |
| `description` | 12,837 | 6,495 | 2,098 | 8,168 |
| `type` | 9,404 | 1,286 | | |
| `holder` | 15,343 | 117 | | 201 |
| `owner` | 2,041 | | | |
| `initial_owner` | 2,790 | | | |
| `dates` | 15,061 | 4,217 | 2,148 | 640 |
| `location` | 15,058 | 4,391 | 1,428 | 637 |
| `dimensions` | 12,755 | | | |
| `place_of_production` | 1,412 | | | |
| `method_for_datation` | 9,959 | 4,054 | | |
| `method_for_provenance` | 8,113 | | | |
| `provenance` | 12,493 | | | |
| `obtention` | 10,599 | | | |
| `bibliography` | 10,230 | 4,100 | | |
| `author_id` and the other credit links | 11,331 | 6,320 | | |

So:
- **objects** use nearly every column;
- **monuments** use the descriptive ones and, after D1, the visit information;
- **details** and **pictures** use the name, description, dates and location: a picture's caption is its translation.

## What M16 adds

The M16 stories add columns and links where `extra` held content (ADR 006):

| Story | Adds | Used by |
|---|---|---|
| B1 #2635 | `materials`, `short_description`, `dynasty`, `history`, `region` | objects, monuments; `dynasty` also pictures |
| B2 #2636 | `keywords`, the keyword line as written (the Tags are unchanged) | objects, monuments |
| B3 #2637 | `artist`, `artist_period_of_activity`, `artist_birth_date`, `artist_birth_place`, `artist_death_date`, `artist_death_place`, `workshop`, `scribe`, `patrons`, `architects`, as written (the Artist links are unchanged; Workshop is removed) | objects, monuments |
| B4 #2638 | `author_credit`, `copy_editor_credit`, `translator_credit`, `translation_copy_editor_credit` | objects, monuments |
| B5 #2639 | `catalogue_references`, the catalogue codes and citations as written (the Book links are unchanged) | objects, monuments |
| B6 #2640 | `status`: published, unedited, hidden; `notice`, `external_notice` as written | every type; the notices on Sharing History objects and monuments |
| D1 #2645 | VisitInformation (its own model) | monuments |
| F1 #2651 | `photographer` and `credit` on the image, not the translation (`copyright` stays the text burned on it); a picture whose language rows differ keeps its texts on the translations until reviewed | pictures' images |
