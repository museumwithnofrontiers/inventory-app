---
layout: default
title: Legacy Data Import
nav_order: 3
nav_exclude: true
description: >-
  A business-oriented explanation of how legacy MWNF data is imported,
  transformed, and prepared for validation in the Inventory model.
---

# Legacy Data Import

This document explains how the legacy data import works and how you can use it to validate the migration. It focuses on what the importer reads, how it restructures data, and where imported content lands in the Inventory model.

The importer does not copy the old databases table by table. It reads selected legacy content, transforms it, and writes it into the simpler Inventory model described in [Inventory Model Core Concepts](inventory-model-core-concepts).

## What the importer is for

The importer prepares the Inventory database from legacy MWNF data. It is used after the new database schema exists and before content validation begins.

It performs four main tasks:

- It reads content from legacy databases and reference files.
- It groups legacy rows that describe the same real-world record.
- It converts the data into Inventory entities such as Items, Partners, Collections, Translations, Images, Tags, Glossary entries, and Timelines.
- It records traceability through `backward_compatibility` values so validators can compare new records with legacy rows.

## What the importer does not do

The importer is intentionally limited to content migration.

It does not migrate every legacy table. It does not preserve website-specific configuration as Inventory content. It does not treat old application screens or old navigation rules as the new data model. It also does not create the future read-only API; that is a separate piece of work.

## Main source areas

The importer currently reads from these source areas:

| Source area | What it contributes |
|---|---|
| JSON reference files | Languages and Countries used by the new application. |
| `mwnf3` | Discover Islamic Art style projects, museums, institutions, schools, objects, monuments, monument details, pictures, links, dynasties, authors, exhibitions, glossary, HCR timelines, and item media. |
| `mwnf3_sharing_history` | Sharing History projects, partners, objects, monuments, monument details, images, exhibitions, national context, historical background, bibliography, HCR timelines, item documents, media, and authors. |
| `mwnf3_explore` | Explore thematic cycles, countries, regions, locations, monuments, itineraries, filters, images, translations, and cross-references. |
| `mwnf3_travels` | Travels trails, itineraries, locations, travel-specific monuments, images, and translations. |
| `mwnf3_thematic_gallery` | Thematic galleries, gallery contexts, themes, item assignments, contextual item descriptions, related items, tags, contributors, and collection media. |

The source SQL dumps and table definitions live under `.legacy-database/`. The importer source lives under `scripts/importer/src/`.

## Import sequence

The importer runs in dependency order. This matters because later imports often need records created by earlier imports.

| Stage | What is imported | Main Inventory destination |
|---|---|---|
| Reference data | Default context, Languages, Language names, Countries, Country names. | Contexts, Languages, Language Translations, Countries, Country Translations. |
| Core `mwnf3` content | Projects, Partners, Schools, Objects, Monuments, Monument Details, Item Links, Authors, Dynasties, Exhibition hierarchy. | Projects, Contexts, Collections, Partners, Items, Item Translations, Item Links, Authors, Dynasties. |
| `mwnf3` images | Object, monument, detail, partner, and logo pictures. | Item Images, picture Items, Partner Images, Partner Logos. |
| Sharing History | Projects, partners, objects, monuments, details, images, exhibition structure, national context, historical background, bibliography. | Projects, Contexts, Collections, Partners, Items, Item Translations, Images, Collection relationships. |
| Glossary | Words, definitions, spellings. | Glossaries, Glossary Translations, Glossary Spellings. |
| Timelines | HCR chronology from `mwnf3` and Sharing History; Sharing History's project chronology from the `mwnf3` activities (`act_activities`). | Timelines, Timeline Events, Timeline Event Translations, Timeline Event Images, Timeline Event Item links. |
| Media and documents | Item audio/video URLs and document references. | Item Media and Item Documents. |
| Explore | Thematic cycles, country/region/location trees, monuments, itineraries, filters, images, translations, cross-references. | Collections, Items, Item Translations, Collection Images, Item Images, Tags, Item Links. |
| Travels | Trails, itineraries, locations, travel monuments, pictures, translations. | Collections, Items, Item Translations, Collection Images, Item Images. |
| Thematic Galleries | Galleries, themes, contextual descriptions, item assignments, related items, gallery tags, contributors, media. | Collections, Item Translations, Collection Item links, Item Links, Tags, Contributors, Collection Media. |
| Final linking and cleanup | Partner-to-monument links, collection media, empty-project cleanup. | Partner monument references, Collection Media, removal of projects without Items. |

## Important transformation rules

### One legacy content unit becomes one Inventory record plus translations

Many legacy tables store one row per language. The importer groups those rows first. It then creates one Inventory record and several Translation records.

For example, legacy object rows with the same project, country, museum, and object number become one Item of type `object`. The language-specific rows become Item Translations.

### Project import creates three records

For each legacy project, the importer creates:

- a Context;
- a Collection;
- a Project.

All three keep the same legacy reference. This makes it clear that the project context, project collection, and project record all come from the same legacy project.

### Legacy codes are standardized

Legacy language and country values are mapped into standardized new identifiers. A legacy two-letter language or country code can therefore appear differently in the Inventory.

This is expected. Validate the meaning, not only the literal legacy code.

### Text is cleaned for the new system

The importer converts legacy HTML-like text into Markdown-oriented text where transformers apply that rule. It also trims or rejects values when a field cannot accept the legacy value as-is.

This means formatting can change while the content meaning stays the same.

### Some legacy fields move into `extra`

When a legacy field has no stable normalized place in the Inventory, the importer can preserve it in an `extra` field. Treat `extra` as preserved source information, not as the primary place for regular content.

### Images are imported in two steps

The import first creates image records in the database. At that stage, image rows can use placeholder file size values because the binary files have not yet been synchronized.

The separate image synchronization step then copies or symlinks legacy image files into the new storage area and updates image records with the final file path and size.

For object, monument, and detail pictures, the importer also creates child Items of type `picture`. The first suitable image is attached to the parent Item, and every imported image receives its own picture Item. This lets users validate both the main image and each individual legacy image.

### Relationships become explicit links or collection membership

The importer chooses the destination according to the meaning of the legacy relationship:

- relationships between two content records become Item Links;
- placement in an exhibition, gallery, trail, itinerary, location, region, or theme becomes Collection structure or Collection membership;
- classification labels become Tags.

### Glossary spellings are preserved as source data

The glossary import reads words, definitions, and spellings. The legacy system sometimes used spelling variants to express synonyms. The importer preserves the spellings as they are. Editorial cleanup can later decide which spellings represent true variants and which need synonym treatment.

## Traceability through `backward_compatibility`

Every important imported record keeps a `backward_compatibility` value. This is the primary validation pointer.

The general format is:

```text
{legacy_schema}:{legacy_table}:{legacy_primary_key_parts}
```

Examples:

| New record | Example source reference pattern |
|---|---|
| Project, project Context, project Collection | `mwnf3:projects:{project_id}` |
| `mwnf3` object Item | `mwnf3:objects:{project_id}:{country}:{museum_id}:{number}` |
| `mwnf3` monument Item | `mwnf3:monuments:{project_id}:{country}:{institution_id}:{number}` |
| `mwnf3` monument detail Item | `mwnf3:monument_details:{project_id}:{country_id}:{institution_id}:{monument_id}:{detail_id}` |
| Partner from a museum | `mwnf3:museums:{museum_id}:{country}` |
| Partner from an institution | `mwnf3:institutions:{institution_id}:{country}` |
| Sharing History object Item | `mwnf3_sharing_history:sh_objects:{project_id}:{country}:{number}` |
| Sharing History monument Item | `mwnf3_sharing_history:sh_monuments:{project_id}:{country}:{number}` |
| Glossary entry | `mwnf3:glossary:{word_id}` |
| `mwnf3` HCR country timeline | `mwnf3:hcr:country:{country_id}` |

For multilingual legacy tables, the language column is usually not part of the parent record reference. The language-specific content lands in Translation records.

## How to validate an imported record

Use this order when checking import quality.

1. Start from the new Inventory record.
2. Find its `backward_compatibility` value.
3. Use that value to identify the legacy table and key values.
4. Compare the new record with the source rows in `.legacy-database/` or in the legacy database export.
5. Check translations separately by language and context.
6. Check images separately because image metadata can be imported before binary file synchronization finishes.
7. Check relationships through Collections, Item Links, Tags, and parent-child Items instead of looking for an identical legacy table shape.

## Validation questions by content type

### Items

Check that:

- the Item type matches the source content;
- object and monument identity matches the legacy composite key;
- details are children of the correct monument;
- dates, owner reference, MWNF reference, country, project, and partner are sensible after mapping;
- all expected translations exist where the legacy source has usable text;
- fields that no longer have a normalized destination are preserved in `extra` when needed.

### Partners

Check that:

- museums, institutions, and schools map to Partner records;
- names and descriptions are present as Partner Translations;
- country and coordinates match the source where available;
- partner images and logos exist after the relevant import steps;
- the partner-to-monument link exists when the legacy museum record includes a monument reference.

### Collections

Check that:

- projects, exhibitions, galleries, themes, trails, itineraries, countries, regions, and locations appear as Collections rather than duplicated Items;
- hierarchy matches the editorial structure of the source system;
- Items are attached to the right Collections;
- contextual descriptions are translations in the correct context.

### Images

Check that:

- item pictures are attached to the expected parent content;
- each imported object, monument, or detail picture also has a child Item of type `picture`;
- partner images and logos are attached to the correct Partner;
- collection, contributor, and timeline images are attached to the correct parent record;
- image file synchronization has run before judging missing physical files.

### Links and tags

Check that:

- explicit related-content relationships are Item Links;
- exhibition, gallery, theme, itinerary, region, and location placement is represented through Collections;
- keywords, materials, filters, and gallery labels are Tags;
- relationship explanations appear in translations when the legacy source provides them.

### Glossary and timelines

Check that:

- glossary words, definitions, and spellings are present;
- spellings are preserved even when they require later editorial cleanup;
- HCR events are grouped under the expected Timeline;
- event translations, item links, bibliography data, and images are present where the source provides them.

## Logs and skipped records

The importer logs progress, skipped records, warnings, and errors. Skips are not always failures. A record can be skipped because it already exists, because a duplicate relation is detected, or because the source record lacks a required parent.

Use logs during validation to distinguish these cases:

- A skipped duplicate usually means the importer protected the Inventory from creating the same record twice.
- A warning usually means the importer preserved the run but found a data quality issue.
- An error means the importer did not import that specific record or stage correctly.

Validation should use both the Inventory record and the import log. The record shows what landed; the log explains what the importer accepted, skipped, or rejected.

## Practical validation checklist

Before signing off a content area, confirm these points:

- The expected source area is covered by the importer stage.
- New records have `backward_compatibility` values that point back to legacy tables.
- The same content is not duplicated when it should be shared through Collection membership or Item Links.
- Translations appear under the expected language and context.
- Images are checked after image synchronization, not only after database import.
- Legacy-specific fields that do not fit the new model are either intentionally omitted or preserved in `extra`.
- Any warning or error in the import log has been reviewed and classified.

This validation checks the success of the transformation. It does not require the new Inventory database to look like the old databases.
