---
layout: default
title: Inventory Model Core Concepts
nav_order: 2
nav_exclude: true
description: >-
  A business-oriented explanation of the Inventory model, its main concepts,
  and how legacy concepts map into the new content inventory.
---

# Inventory Model Core Concepts

This document explains the Inventory model in business terms for people who know the legacy MWNF systems and need a clear way to understand the new model without starting from database tables or application code.

The Inventory is the shared content base for MWNF. It stores museum content, its structure, its translations, its images, and the relationships needed to publish it in different contexts. It does not store website-specific configuration, server configuration, or application-only data.

## The main idea

The legacy systems often mix several responsibilities in the same databases: cultural content, website presentation, administrative settings, contact information, and application-specific behavior. The Inventory separates these concerns.

In the new model:

- The Inventory stores the content itself.
- The Filament `/admin` application is the main back-office for managing that content.
- The management API remains available for programmatic management tasks.
- Future front-end applications and the planned read-only API consume content from this common Inventory instead of reading legacy databases directly.

This means a record belongs in the Inventory when it describes reusable MWNF content. A record does not belong in the Inventory only because one old website needed it for layout, navigation, configuration, or local behavior.

## The core rules

### One content record, many uses

The Inventory aims to keep one record for one content unit, then let that record appear in many places. An object can appear in a project collection, a thematic gallery, an itinerary, and a related-content link without creating several independent copies of the same object.

### Content is separate from presentation

The Inventory keeps content and structure. It does not decide the final design of a public website. A front-end application decides how to display records, but it reads the same shared content base.

### Translations are first-class content

Most important content is stored through translations. A translation always belongs to a language and, for major content entities, to a context. This lets MWNF preserve different texts for different audiences or editorial purposes without duplicating the main record.

### Legacy identity is preserved

Imported records keep a `backward_compatibility` reference. This value records where the new record came from in the legacy databases. It is the main bridge for validation because it lets you compare a new Inventory record with its legacy source row.

## The main entities

### Item

An Item is the central content unit. It represents something that can be described, illustrated, grouped, linked, and published.

Item types are:

| Type | Meaning |
|---|---|
| `object` | A museum object or artifact. |
| `monument` | A monument, archaeological site, or architectural location. |
| `detail` | A detail or component of another item, usually a child of a monument. |
| `picture` | A picture treated as its own identifiable child item. |

An Item can have:

- a Partner that owns or contributes it;
- a Country;
- a Project;
- a primary Collection;
- additional Collections where it appears;
- a parent Item and child Items;
- Images, media, documents, tags, artists, dynasties, authors, and links to other Items.

The descriptive text of an Item lives in Item Translations. The Item record itself keeps shared facts such as type, ownership references, project, country, date range, coordinates, and relationships.

### Partner

A Partner represents an institution, museum, individual, or school connected to Inventory content. Partners replace several legacy notions such as museums, institutions, schools, and some contributor-like records when they represent a content-owning or content-providing body.

A Partner can have:

- translations for its public name and description;
- a country and coordinates;
- images and logos;
- a link to the monument Item that represents its physical location, when the legacy data provides that reference;
- collection participation levels such as partner, associated partner, and minor contributor.

### Collection

A Collection is a virtual grouping of content. It is the main tool for representing exhibitions, galleries, themes, trails, itineraries, regions, locations, and other editorial structures.

Collection types include:

| Type | Typical use |
|---|---|
| `collection` | A general grouping of items. |
| `exhibition` | A curated exhibition. |
| `gallery` | A gallery or thematic presentation. |
| `theme` | A thematic grouping. |
| `subtheme` | A nested theme. |
| `exhibition trail` | A guided exhibition trail. |
| `itinerary` | A route or itinerary. |
| `location` | A city, place, or location grouping. |
| `region` | A regional grouping. |

Collections can form trees. For example, a Travels structure can be represented as a root collection, then trails, then itineraries, then locations, then monument Items. An Explore structure can be represented through thematic cycles, countries, regions, locations, and monuments.

An Item can belong to one primary Collection and also appear in other Collections. This is how the Inventory avoids duplicating the Item when the same content appears in several editorial products.

### Publication

A Publication is a work MWNF or a partner published (the legacy "books"): an exhibition-trail guide, a virtual-museum catalogue, an educational guide, a gallery book. It has translations per language and context (title, subtitle, texts and the credit lines as printed), editions (one language, format, edition number, ISBN, publisher as text), covers and sample pages as images, and links to the Collections it accompanies, the Items it cites and its Tags (subjects, themes, target readers).

### Project

A Project represents a content initiative or legacy project grouping. During import, a legacy project creates three related Inventory records:

- a Context;
- a Collection;
- a Project.

These records share the same legacy reference so validators can trace them back to the same legacy project. The Project stores project-level status and launch information. The Collection gives the imported content an editorial home. The Context identifies the project-specific editorial context when one is needed.

### Context

A Context describes the purpose or editorial situation of a text. It is not a language. It answers a different question: "For which audience or use is this text written?"

Examples in the imported data include the default context, project contexts, Explore context, Travels context, and Thematic Gallery contexts. A translation can therefore say: this text is in English, and it belongs to this context.

### Language and Country

Languages and Countries are reference data. Languages use ISO-style language identifiers in the new system. Countries use ISO 3166-1 alpha-3 codes.

Legacy language and country codes are mapped during import. This is important for validation: a legacy two-letter language or country value can appear as a different standardized code in the Inventory.

### Translation

A Translation stores the readable text for a record. Major translated entities include Items, Partners, Collections, Glossary entries, Timeline events, Contributors, and item-to-item links.

For major content entities, a translation combines:

- the parent record;
- the language;
- the context;
- the translated fields, such as title, name, description, date text, bibliography, or other entity-specific content.

This is why the new model can hold several descriptions for the same Item without treating them as different objects.

### Tag

A Tag is a flexible classification label. Tags are used when the legacy data expresses classification through keywords, materials, gallery tags, filters, or similar labels.

Tags can have a category and language. They are attached to Items and, in some cases, to images.

### Item Link

An Item Link records an explicit relationship from one Item to another Item. It replaces legacy relationship tables that connect objects to objects, objects to monuments, monuments to monuments, or related thematic-gallery items.

The link itself has a context. Its translations carry the readable explanation of the relationship, including reciprocal wording when the source data provides it.

### Images, Media, and Documents

Images are attached to content through typed image records:

- Item Images;
- Partner Images;
- Partner Logos;
- Collection Images;
- Contributor Images;
- Timeline Event Images.

For object, monument, and detail pictures, the import also creates child Items of type `picture`. This makes every imported picture individually identifiable while still allowing a main image to appear directly on the parent Item.

Media records store audio or video URLs. Document records store file references such as PDFs.

### Glossary

The Glossary stores specialized words used in the content. A glossary entry has definitions and spellings. The importer preserves legacy spellings as spellings; cleanup of spelling variants and true synonyms remains an editorial task.

Glossary spellings can later be linked to translations so terms in item, collection, or timeline texts can be recognized and explained.

### Timeline and Timeline Event

Timelines represent Heritage Conservation Resources chronology content. A Timeline groups Timeline Events. A Timeline Event stores date information, translations, images, and links to related Items when the legacy source provides item references.

### Author, Artist, Dynasty, Workshop, Contributor

These supporting entities preserve people, periods, and contributor structures around the main content:

- Authors describe editorial authorship, translation, and copy-editing roles.
- Artists and Workshops describe creation of Items.
- Dynasties describe historical periods and can be linked to Items.
- Contributors represent contributor records attached to Collections, especially from Thematic Gallery data.

## How legacy concepts map to the Inventory

| Legacy concept | Inventory concept |
|---|---|
| Object rows | Item of type `object`, plus Item Translations. |
| Monument rows | Item of type `monument`, plus Item Translations. |
| Monument detail rows | Item of type `detail`, usually as a child of the monument Item. |
| Object, monument, and detail pictures | Item Images, plus child Items of type `picture`. |
| Museums, institutions, schools | Partners. |
| Project records | Project, Context, and Collection. |
| Exhibitions, galleries, themes, subthemes | Collections in a hierarchy. |
| Trails, itineraries, locations, regions | Collections in a hierarchy. |
| Relationship and related-item tables | Item Links or Collection membership, depending on the source meaning. |
| Keywords, materials, filters, curated gallery labels | Tags. |
| Glossary words, definitions, spellings | Glossary entries, translations, and spellings. |
| HCR chronology | Timelines and Timeline Events. |
| Audio, video, PDFs | Item Media, Collection Media, and Item Documents. |

## What to look for when validating content

When you validate imported content, focus first on meaning and traceability.

Check these questions:

- Does the new record represent the same real-world content as the legacy row?
- Does the `backward_compatibility` value point to the correct legacy source?
- Is the Item type correct: object, monument, detail, or picture?
- Is the Partner correct?
- Is the Country correct after code conversion?
- Are the available translations present in the expected languages?
- Is project, exhibition, gallery, trail, itinerary, region, or location structure represented as Collections rather than duplicated Items?
- Are related Items linked instead of copied?
- Are pictures attached to the right parent content, and are picture Items created where expected?
- Is any leftover legacy-specific information preserved in `extra` fields when no normalized Inventory field exists?

This validation approach is more useful than checking whether the new database repeats every legacy table. The goal is not to reproduce the old shape. The goal is to preserve the content in a simpler structure that MWNF can reuse across applications.

## Related resources

- [Legacy Data Import](legacy-data-import) explains how data moves from legacy databases into this model.
- [Database Models](models/) provides developer-level model details when you need field-level reference.
