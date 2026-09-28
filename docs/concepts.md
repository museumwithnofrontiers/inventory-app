---
layout: default
title: Core Concepts
nav_order: 3
nav_exclude: true
description: >-
  Explains the core concepts, entities and processes of the Inventory Management API
  to allow any stakeholder — from business users to developers — to understand and
  work with the system effectively.
---

# Core Concepts

{: .no_toc }

This document explains the purpose and structure of the Inventory Management API from a conceptual point of view. It is intended for any stakeholder — business users, content managers, and developers alike — who needs to understand how the system works before using or extending it.

## Table of Contents

{: .no_toc .text-delta }

1. TOC
   {:toc}

---

## What is this system?

The Inventory Management API is the backbone of the **Museum With No Frontiers (MWNF)** digital infrastructure. Its primary purpose is to store and serve the **inventory of museum artifacts, monuments, and related content** managed by partner institutions around the world.

The system is designed around two key ideas:

1. **One record, many representations.** The same artifact can be described differently depending on the language of the visitor and the audience context (general public, academic, educational, etc.).
2. **Flexible organization.** Items can be grouped, cross-referenced, and organized in multiple ways — by collection, exhibition, thematic trail, and more — without duplicating the underlying data.

---

## Core Entities

### Item

The **Item** is the central entity of the system. It represents a single piece of content in the inventory — an artifact, a monument, a detail of an artifact, or a photograph.

#### Item types

| Type       | Description                                          |
| ---------- | ---------------------------------------------------- |
| `object`   | A museum object or artifact (e.g., a vase, a statue) |
| `monument` | An architectural monument or archaeological site     |
| `detail`   | A close-up detail or specific part of another item   |
| `picture`  | A photograph or image resource                       |

#### Item key attributes

- **Partner** — The institution or museum that owns or manages this item. Every item must belong to a Partner.
- **Country** — The country where the item is located or originates from.
- **Collection** — The primary collection this item belongs to (optional). An item can also be attached to additional secondary collections.
- **Project** — The project under which this item was entered into the system (optional).
- **Parent/children** — Items can be organised hierarchically. A monument might contain several detail items; those details have the monument as their parent. The depth of the hierarchy is unlimited.
- **Display order** — Items that share the same parent are ordered by a `display_order` value. This controls the sequence in which children appear.
- **GPS coordinates** — Latitude, longitude, and map zoom level for geographic placement.
- **Date range** — A start and end date representing the item's creation period or dating attribution.
- **Owner reference / MWNF reference** — External identifiers linking the item to the owning institution's own system and to the MWNF catalogue.

#### Item content

The descriptive content of an item is **not stored directly on the item** record. Instead, it is stored in [translations](#translations-and-multilingual-content) (see below), allowing the same item to be described in multiple languages and for multiple audiences.

#### Item linking

Items can be explicitly linked to other items via **ItemItemLink** records. A link connects a source item to a target item within a given context (see [Context](#context)). Links can carry their own translations (descriptions of the relationship type in multiple languages). The link is directed: the source item has an outgoing link to the target item. Both directions are accessible from either item.

**Note:** The nature of the relationship expressed by a link (e.g., "is a part of", "is related to") is conveyed through the link's translations, not through a fixed enumerated type. The schema of these descriptions is not constrained — the meaning is carried entirely by the translated text.

---

### Partner

A **Partner** is an institution, museum, or individual who contributes content to the inventory. Every item in the system is owned by a partner.

#### Partner types

| Type          | Description                                   |
| ------------- | --------------------------------------------- |
| `museum`      | A museum or gallery                           |
| `institution` | A non-museum cultural or academic institution |
| `individual`  | An individual contributor                     |

#### Partner key attributes

- **Country** — The country where the partner is based.
- **Project** — The project the partner is primarily associated with (optional).
- **Monument item** — A partner can optionally be linked to an item that represents their main monument or building. This is a direct reference to an Item of type `monument`.
- **Visible** — A boolean flag controlling whether the partner is publicly visible. Partners with `visible = false` are typically hidden from public-facing outputs.
- **GPS coordinates** — The geographic location of the partner institution.

#### Partner participation in collections

Partners can be associated with collections at different levels of contribution (see [Collection](#collection) → Partner levels).

---

### Collection

A **Collection** is a virtual grouping of items. Collections are the primary mechanism for organising and publishing content, whether as an exhibition, a thematic gallery, an itinerary, or another form of curated set.

#### Collection types

| Type               | Description                                       |
| ------------------ | ------------------------------------------------- |
| `collection`       | A general-purpose grouping of items               |
| `exhibition`       | A curated set of items presented as an exhibition |
| `gallery`          | A set of items presented as a gallery             |
| `theme`            | A thematic grouping                               |
| `exhibition trail` | A guided itinerary through an exhibition          |
| `itinerary`        | A geographic or thematic tour                     |
| `location`         | A grouping based on a physical location           |

#### Collection purpose

Independently of its `type`, a collection can carry a **purpose**: a value from a controlled vocabulary identifying the structural role the collection plays in a published website. Most collections have no purpose (`purpose` is `null` — the norm); it is set only on the "marker" collections that anchor a section of a site, and on the National Context overlays.

| Purpose                                                                            | Role                                                                                          |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `exhibitions-root`                                                                 | Parent of a project's virtual exhibitions                                                     |
| `artistic-introduction-root`                                                       | Parent of the Artistic Introduction tree (Islamic Art)                                        |
| `historical-background-root`                                                       | Parent of the general Historical Background essays (Sharing History)                          |
| `topics-root`                                                                      | Parent of the Historical Background "Read more" topics (Sharing History)                      |
| `historical-profiles-root`                                                         | Parent of the per-country Historical Profiles (Sharing History)                               |
| `galleries-root` / `travels-root` / `explore-themes-root` / `explore-countries-root` / `explore-itineraries-root` | Parents of the corresponding Explore Islamic Art sections |
| `explore-root`                                                                     | The Explore website: parent of its three section roots; its `extra` holds the site's own records (home banners, featured partnerships, travel information) |
| `national-context`                                                                 | A National Context overlay collection (may occur many times)                                  |

`*-root` purposes are unique per context; `national-context` may repeat. The purpose is assigned by the data importer when it creates these marker collections (and by its one-off `collection-purpose-backfill` step on databases populated before the field existed). Data exporters pass `purpose` through to the published data-packages, and the public viewers resolve their section anchors **exclusively** through it — it replaces the earlier practice of parsing `backward_compatibility` keys, which are now informational only.

#### Collection hierarchy

Collections can have a parent collection, creating a tree structure of unlimited depth. For example, an exhibition might contain several sub-galleries, each of which is itself a collection.

#### How items are added to a collection

There are two distinct relationships between items and collections:

1. **Primary membership** — An item has a `collection_id` foreign key pointing to its primary collection. This is a straightforward one-to-many relationship: one collection owns many items directly.
2. **Secondary (attached) membership** — Items can additionally be _attached_ to other collections through a pivot table (`collection_item`). This many-to-many relationship allows the same item to appear in multiple collections without duplicating data.

Both types of membership can coexist. An item may have a primary collection and also be attached to several other collections.

#### Collection default language and context

Each collection records a **default language** and a **default context**. These specify which language and audience context should be used as the primary mode of presentation for this collection. They do not restrict what translations can be created; they express an editorial preference.

#### Partner levels

Partners can be associated with a collection at one of three contribution levels:

| Level                | Description                                                  |
| -------------------- | ------------------------------------------------------------ |
| `partner`            | Primary partner providing content directly to the collection |
| `associated_partner` | Partner contributing indirectly or in a supporting role      |
| `minor_contributor`  | Partner with a minor or peripheral contribution              |

---

### Project

A **Project** represents a campaign or initiative under which content (items and collections) is created and published. It provides a way to group content that was produced as part of a specific effort and to control its public availability.

#### Project visibility

A project is publicly visible only when **all three** of the following conditions are met:

1. `is_enabled` is `true` — the project has been administratively enabled.
2. `is_launched` is `true` — the project has been explicitly launched by an editor.
3. `launch_date` is in the past — the scheduled launch date has been reached.

This three-condition model allows content to be prepared in advance and released on a scheduled date, while also allowing emergency disabling at any time.

#### Project association

Every project has:

- A default **language** — the primary language in which its content is authored.
- A default **context** — the primary audience context for which its content is intended.

---

### Context

A **Context** defines a specific audience or purpose for which content is written. It is a key part of the multi-language, multi-audience content model.

Examples of contexts might be: "General public", "Academic", "Educational", "Children". (The actual names are defined by the administrators of the system.)

One context is marked as the **default context** (`is_default = true`). The default context is used as a fallback when a translation in the requested context does not exist (see [Translation fallback logic](#translation-fallback-logic)).

---

### Language

A **Language** identifies a supported language in the system using its [ISO 639-1](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes) code (e.g., `en`, `fr`, `ar`). Languages use their ISO code as their primary key rather than a UUID.

One language is designated as the **default language** (`is_default = true` / `english()` scope). The default language participates in translation fallback logic.

**Language names** are stored in a `LanguageTranslation` model which maps a language to its name _as displayed in another language_ (e.g., "English" displayed as "Anglais" in French). This uses a `display_language_id` rather than a context — it is a simpler, context-free translation compared to entity translations.

---

### Country

A **Country** identifies a geographic country using its [ISO 3166-1 alpha-3](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-3) code (e.g., `EGY`, `FRA`, `MAR`). Countries use their ISO code as their primary key rather than a UUID.

Countries are used to associate items and partners with a geographic origin or location. They are reference data and do not carry complex business logic.

**Country names** are stored in a `CountryTranslation` model which maps a country to its name in a given language. Unlike entity translations, country translations use only a `language_id` and have no context dimension — a country's name does not vary by audience.

---

## Translations and Multilingual Content

Every major entity in the system supports multilingual, multi-audience content through a **translation** model. The pattern is consistent across all entities.

### How translations work

For every entity (Item, Partner, Collection, etc.), there is a corresponding translation table (e.g., `item_translations`, `partner_translations`). Each translation record combines:

- A **language** — the language in which the content is written.
- A **context** — the audience for which the content is intended.
- The **actual content** — name, description, and other fields specific to the entity type.

A single entity can therefore have many translations: one per language-context combination. For example, an item might have:

- A French translation for the general public context.
- A French translation for the academic context.
- An English translation for the general public context.
- An Arabic translation for the general public context.

### Item translation fields

The `ItemTranslation` model is the richest translation model. In addition to the basic name and description, it stores museum-specific scholarly metadata:

- `name`, `alternate_name` — The item's primary and alternate names in this language.
- `description` — The main descriptive text.
- `type` — A textual description of the item type (e.g., "oil on canvas").
- `holder`, `owner`, `initial_owner` — Institutional custody and ownership information.
- `dates`, `location`, `dimensions` — Physical and temporal attributes of the item.
- `place_of_production`, `method_for_datation`, `method_for_provenance` — Scholarly provenance information.
- `provenance`, `obtention`, `bibliography` — Historical record of the item's custody and academic references.
- `extra` — A flexible JSON field for preserving data from legacy systems. Because this API merges and replaces several pre-existing databases, some columns from those systems may not map cleanly onto the new model's structured fields. Rather than polluting the schema with rarely-used columns or discarding original data, the `extra` field stores those residual values as a JSON object. Its structure is not enforced and will vary depending on the legacy source system from which the item was imported.
- **Authors** — Four editorial roles are tracked:
  - `author` — The person who wrote the main descriptive text.
  - `text_copy_editor` — The person who edited the text.
  - `translator` — The person who translated the content into this language.
  - `translation_copy_editor` — The person who edited the translation.

### Translation fallback logic

When requesting content for a specific language and context, the system uses the following fallback chain:

1. Look for a translation matching **exactly** the requested language **and** the requested context.
2. If not found, look for a translation matching the requested language **and the default context**.
3. If still not found, return `null` (no content available).

This means it is sufficient to create a single "default context" translation for an entity to ensure it is always reachable, while more specific context translations can be added progressively.

---

## Tags

A **Tag** is a free-form label that can be attached to any number of items. Tags allow flexible, ad-hoc categorisation of content that does not fit into the formal collection structure.

Tags have:

- An optional **category** grouping (e.g., "material", "period", "style").
- An optional **language** association (a tag may be language-specific).

The API supports querying items by tags in two modes:

- **All tags (AND)** — Return only items that have every specified tag.
- **Any tag (OR)** — Return items that have at least one of the specified tags.

---

## Artists and Workshops

**Artists** and **Workshops** describe the _creation_ of an item.

- An **Artist** is a person who created or contributed to the creation of an item. An artist record stores biographical information (name, place and date of birth and death, period of activity).
- A **Workshop** is a place or atelier where an item was created.

Both are linked to items through many-to-many relationships. An item can have multiple artists and multiple workshops.

---

## Glossary

The **Glossary** is a structured dictionary of specialised terms used in the inventory and its descriptions. Each glossary entry has:

- **Translations** — the meaning of the term in each language and context (following the standard translation model).
- **Spellings** — variant spellings of the term (e.g., alternate transliterations), which can be linked to specific item translations to annotate the text.
- **Synonyms** — links to other glossary entries that carry the same or a similar meaning.

The glossary is designed to support editorial annotation: editors can link a glossary spelling to the text of an item translation to flag that a term is defined in the glossary.

---

## Image Management

### The image workflow

Images in the system follow a two-stage workflow:

1. **Upload stage** — A file is uploaded and tracked as an `ImageUpload` record (raw file metadata: path, name, extension, MIME type, size). This is purely a tracking mechanism for the upload process.

2. **Available stage** — Once processed, the image becomes an `AvailableImage` record. This represents a pool of images that are ready to be attached to content but have not yet been assigned.

3. **Attachment stage** — An available image is attached to a specific entity (Item, Partner, or Collection), creating a typed image record:
   - `ItemImage` — attached to an Item.
   - `PartnerImage` — attached to a Partner.
   - `PartnerLogo` — a logo attached to a Partner.
   - `PartnerTranslationImage` — an image attached to a specific partner translation (language-specific partner imagery).
   - `CollectionImage` — attached to a Collection.

### Display ordering

All attached image records carry a `display_order` field. Images associated with the same entity are sorted by this value. The system provides `moveUp()` and `moveDown()` operations, and a `reorderItemImages()` method that normalises the ordering to eliminate gaps when images are removed.

---

## Authentication and Permissions

The API uses **Laravel Sanctum** for token-based authentication. All endpoints require a valid bearer token, except for a small number of informational endpoints (`/api/info`, `/api/health`, `/api/version`).

Access to operations is controlled by the following permissions:

| Permission        | Scope                                  |
| ----------------- | -------------------------------------- |
| `view data`       | Read any data                          |
| `create data`     | Create new records                     |
| `update data`     | Modify existing records                |
| `delete data`     | Delete records                         |
| `manage users`    | Create, edit, and delete user accounts |
| `assign roles`    | Assign roles to users                  |
| `manage roles`    | Create and modify roles                |
| `manage settings` | Change system configuration            |

Permissions are assigned to users through roles (powered by Spatie Laravel Permission).

---

## Key Design Decisions

### UUID primary keys

All entities use UUIDs as primary keys, with two exceptions: `Language` uses its ISO 639-1 code as the primary key, and `Country` uses its ISO 3166-1 alpha-3 code. This makes IDs self-describing and stable across systems.

The `User` model uses the Laravel default integer key for compatibility with the authentication framework.

### `internal_name` and `backward_compatibility`

Every entity has an `internal_name` field. This is a human-readable identifier used **internally** by editors and administrators. It is not the public-facing name (which is stored in translations) but rather a stable label for use within the management interface.

The `backward_compatibility` field is a critical migration aid. Because this API merges and replaces several legacy systems, each new record may correspond to a row that existed in one of those systems under a different identifier. The `backward_compatibility` field stores a **string representation of the primary key** from the originating legacy system, allowing a direct mapping between new records and the legacy rows they replace. This is essential for data import scripts and for cross-referencing the new model against legacy databases during and after migration. This field is populated during data import; new records created directly in this system will typically leave it empty.

### Atomic deletion

Several models (Item, Glossary, PartnerTranslation) implement custom `delete()` methods that perform cascading deletions within a database transaction. This ensures referential integrity is always maintained even for complex, cross-table relationships that cannot be handled entirely by foreign key constraints.

---

## Relationships at a Glance

The following diagram summarises the main relationships between core entities:

```
Country ◄─── Item ◄─── ItemTranslation (language × context)
              │              └── Author × 4 roles
              │              └── GlossarySpelling (many-to-many)
              ├── Partner ◄── PartnerTranslation (language × context)
              ├── Collection (primary, via FK)
              ├── Collection (secondary, via pivot)
              ├── Project
              ├── Parent Item (self-referential)
              ├── Children Items (self-referential)
              ├── Tags (many-to-many)
              ├── Artists (many-to-many)
              ├── Workshops (many-to-many)
              └── ItemItemLink (source → target, with context)

Collection ◄── CollectionTranslation (language × context)
            ├── Items (primary, HasMany via FK)
            ├── Items (secondary, BelongsToMany via pivot)
            ├── Partners (many-to-many, with level)
            ├── Parent Collection (self-referential)
            └── Children Collections (self-referential)

Project ──► Context
        ──► Language

Partner ──► Country
        ──► Project
        ──► Monument Item (BelongsTo Item)

Language ──► LanguageTranslation (language × display_language)
Country  ──► CountryTranslation  (language only — no context dimension)

Glossary ──► GlossaryTranslation (language × context)
         ──► GlossarySpelling ──► ItemTranslation (many-to-many)
         ──► Synonyms (self-referential, many-to-many)
```
