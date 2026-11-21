---
layout: default
title: 4. Collections and placements
parent: Master manual
grand_parent: User Manual
nav_order: 4
---

# 4. Collections and placements
{: .no_toc }

1. TOC
{:toc}

## What a collection is

A **collection** groups items, and other collections. Every website is built from one collection tree, or from the collections of a project: a gallery is a collection, an exhibition is a collection whose themes are child collections, an Explore itinerary is a collection related to location collections. **Browse collection tree** shows the whole tree ([chapter 1]({{ '/user-manual/master/getting-started' | relative_url }}#the-tree-browsers)).

The **Type** says the collection's shape:

| Type | Used for |
|---|---|
| **Collection** | Roots, project collections, Sharing History's sections, Explore's countries. |
| **Gallery** | A thematic gallery. |
| **Exhibition** | A virtual exhibition. |
| **Theme**, **Subtheme** | The themes and sub-themes of an exhibition, an Explore theme. |
| **Exhibition trail** | A Travels trail; an Explore sub-itinerary. |
| **Itinerary** | A Travels or Explore itinerary. |
| **Location** | A Travels or Explore location. |
| **Region** | An Explore territory. |

The **Purpose** marks a few collections that the sites look for: the roots of each section (*Exhibitions root*, *Galleries root*, *Explore root*, *Travels root*, *Historical profiles root*…) and Sharing History's *National context* collections. Don't change a type or a purpose: the sites depend on them.

## The view page

![The Publishing section of a collection's form]({{ '/user-manual/images/collection-publishing.png' | relative_url }})

**Core Information** holds the type, the purpose, the parent, the collection's own **context** and **language**, the country, the map position, the **Cover picture** (a picture item) and, for a Travels itinerary, its number of **Days**.

The tabs under it:

| Tab | What it holds |
|---|---|
| **Child collections** | The collections under this one: an exhibition's themes, a trail's itineraries. |
| **Translations** | The collection's texts, per language and context. |
| **Items** | The **placements**: the items in the collection, in order. |
| **Partners** | The partners taking part in the collection, with their level. |
| **Countries** | The countries the collection covers. |
| **Related collections** | Links to other collections, by kind (location, territory, theme…). |
| **Images** | The collection's own images: banner, cover, illustrations ([chapter 3]({{ '/user-manual/master/images' | relative_url }})). |
| **Publications** | The publications that accompany it. |
| **Contributors** | The credits of the collection: curators, authors, photographers… ([chapter 6]({{ '/user-manual/master/reference-data' | relative_url }}#contributors)). |
| **Links** | Videos, audio, websites and reading lists attached to the collection. |
| **Visit information** | For a location ([chapter 5]({{ '/user-manual/master/partners' | relative_url }})). |

## The collection's texts

**Translations** holds one row per language and context. Select **Edit** on a row (or open **Translations → Collection Translations** in the menu) to change:

| Field | What it holds |
|---|---|
| **Title** | The collection's name. On galleries and exhibitions, the languages with a title are the languages the site offers. |
| **URL** | A legacy address part, where the site uses one. |
| **Subtitle** | |
| **Description** | The main text. On an exhibition theme it is the theme's presentation. |
| **Introduction** | The introduction, as written (Markdown). |
| **Quote** | The pull quote above a theme's presentation. |
| **Duration** | A trail's duration, as written. |
| **Cover caption** | The cover picture's caption, as written. |

## The editorial flags

The **Publishing** section of the collection's form holds the only site settings the inventory keeps. Everything else about a site's look belongs to the site ([ADR 006]({{ '/adr/006-what-goes-in-extra' | relative_url }}), rule 4).

| Flag | What it does |
|---|---|
| **Visible** | Shown on the sites. Where a site reads it, turning it off hides the collection and everything under it: an Islamic Art or Baroque Art exhibition, an Explore theme. On Sharing History, a non-visible exhibition keeps its titles and placements but is marked unpublished. |
| **Featured** | A gallery among the featured galleries. |
| **Published** | A gallery's live date. |

Not every site reads every flag. The [site family manuals]({{ '/user-manual/sites/' | relative_url }}) say which flag matters where. A flag that a site doesn't read changes nothing on it.

## Placements: the items of a collection

The **Items** tab lists the items placed in the collection. The order of the rows is the order on the site.

![The placements of an exhibition theme]({{ '/user-manual/images/theme-placements.png' | relative_url }})

The row actions are at the end of each row; scroll the table to the right to see them.

![The row actions of a placement]({{ '/user-manual/images/placement-actions.png' | relative_url }})

| Action | What it does |
|---|---|
| **Attach** (above the table) | Places an existing item in the collection, with the placement's fields below. |
| **View** | Opens the item. |
| **Edit** | Changes the placement's fields. |
| **Detach** | Takes the item out of the collection. The item itself is kept. |
| **View appearance** | Opens the placement's texts for this collection. |

The **⇅** button at the top left of the table lets you drag the rows into a new order. The **Items** list page has a bulk action too, **Attach to collection**, to place several selected items at once.

You can also work from the item's side: its **Collection appearances** table (Content tab) lists every collection it is placed in.

### The placement's fields

Select **Edit** on the row.

![The fields of a placement]({{ '/user-manual/images/placement-edit.png' | relative_url }})

| Field | What it does |
|---|---|
| **Display order** | The place of the item in the collection. |
| **Variant** | Legacy's variant number at this place: two items with the same display order and different variants are alternatives shown at the same place. |
| **Detail view of variant** | For a detail view: the variant number it belongs to, at the same display order. |
| **Picture shown** | Which of the item's pictures the collection shows. Only the placed item's own picture items are offered. Islamic Art and Baroque Art exhibitions show the first image of the picture chosen here. When the placed item is itself a picture, leave it empty. |
| **Curator selection** | Whether the curator selected the item: *Selected*, *Not selected* or *Not given*. Sharing History prints it. |
| **Extra metadata** | Technical. Leave it as it is. |

### The placement's texts

A placement can carry its own texts, per language, which the site prints **instead of** the item's own texts on that collection's page. The same picture can carry a different caption in each exhibition theme.

1. Select **View appearance** on the placement's row.

   ![The appearance page of a placement]({{ '/user-manual/images/placement-appearance.png' | relative_url }})

2. In **Translations**, select **Edit** on a language's row, or **Add a language**.

   ![The texts of a placement in one language]({{ '/user-manual/images/placement-texts.png' | relative_url }})

| Section | Field | What it holds |
|---|---|---|
| **Texts** | **Title** | A detail view's name. |
| | **Description** | The item's text on this collection (Markdown): an exhibition's contextual description, an Explore or Travels entry. |
| | **Caption** | The image caption on this collection. |
| **Caption of the item** | **Name**, **Date**, **Location**, **Museum**, **Dynasty**, **Artist**, **Material** | The item's caption lines on this collection, as written. Islamic Art and Baroque Art exhibitions print them. |
| **Justifications** | **Curator**, **Partner** | Why the curator, and the partner, selected the item. |
| | **National Context** | Sharing History's National Context gives one justification. |

So, to correct a caption on an exhibition page, edit the **placement's** text. Editing the item's own translation changes its item sheet, not the exhibition page.

The appearance page also has an **Explore monuments** button. It matters only for Explore's location placements ([Explore]({{ '/user-manual/sites/explore' | relative_url }})).

## Child collections

An exhibition's themes, a trail's itineraries and a gallery's sub-collections are its **Child collections**.

![The themes of the Water in Islam exhibition]({{ '/user-manual/images/exhibition-themes.png' | relative_url }})

- **Create** makes a new child collection: give it the same type and context as its siblings.
- **Attach existing** moves an existing collection under this one.
- **Detach** takes a child collection out, without deleting it.

The order of child collections on a site is their display order. The panel doesn't show that order yet; ask the team if themes must be reordered.

## Related collections

**Related collections** links a collection to others, each link with a **kind** and an **order**:

| Kind | Used by |
|---|---|
| **Location** | An Explore itinerary's locations, in order. |
| **Territory** | An Explore itinerary's territories. |
| **Theme** | The themes of an Explore region. |
| **Additional region** | Further regions of an Explore region. |
| **Historical background** | The Travels locations an Explore location draws its history from. |

![The locations of an Explore itinerary]({{ '/user-manual/images/related-collections.png' | relative_url }})

**Attach** adds a link, **Edit** changes its kind or order, **Detach** removes it.

## Partners of a collection

The **Partners** tab lists the partners taking part in the collection. Each participation has a **Level** (*Partner*, *Associated Partner*, *Minor Contributor*) and a **Visible** switch: a partner that isn't visible is left out of the site's partner list. The same participations appear, from the partner's side, on the partner's **Collection participations** tab ([chapter 5]({{ '/user-manual/master/partners' | relative_url }})).
