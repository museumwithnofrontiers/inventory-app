---
layout: default
title: Thematic galleries
parent: Site families
grand_parent: User Manual
nav_order: 1
---

# Thematic galleries
{: .no_toc }

The 37 thematic galleries (Amulets, Carpets, Ceramics, Calligraphy, Woodwork…) are built by the **dxa-gallery** exporter, one site per gallery.

1. TOC
{:toc}

## What makes up a gallery

A gallery site is built from **one collection of type Gallery**, under **Galleries** in the collection tree.

- **Its items** are the objects and monuments **placed** in that collection ([Placements]({{ '/user-manual/master/collections' | relative_url }}#placements-the-items-of-a-collection)). Their pictures come with them, and a monument brings its details.
- Many members belong to other projects: Amulets owns none of its objects, it borrows them from Islamic Art, Sharing History and others. A borrowed object keeps its own texts: the sheet prints its translation in the context of **its own project**, not the gallery's.

So, to add an object to a gallery, place it in the gallery's collection (**Attach** on the collection's **Items** tab). To take it out, **Detach** it there.

## What the site shows, and where it comes from

| On the site | In the panel |
|---|---|
| The gallery's name, in each language | The gallery collection's **Translations**: **Title**. The site offers the languages in which the gallery has a title. |
| The item sheet | The item's translation in its own project's context ([Which field is which text]({{ '/user-manual/master/items' | relative_url }}#which-field-is-which-text)), including the artist, dynasty and credit lines as printed and the linked authors. |
| A second, short text on some sheets | The item's *Explore Islamic Art Collections* translation, which the sheet shows as a short description. |
| The pictures of a sheet | The item's **picture items**, in their order ([Pictures]({{ '/user-manual/master/items' | relative_url }}#pictures)). |
| Related objects | The item's **Links** tab ([Related items]({{ '/user-manual/master/items' | relative_url }}#related-items)), with their justifications. |
| "On display in" | The other galleries and exhibitions the item is placed in, if they are sites of their own. |
| The search facets (artist, dynasty, material, subject, type) | The gallery facet **tags** linked to the item. |
| Partners | The partners holding the gallery's items, and the museums of the gallery's own project. |
| Dynasties | The **Dynasties** linked to the gallery's items. |
| Featured and live date | Not in the panel: the gallery's instance file, as legacy set them. Ask the team. |

## Things to know

- **Facet tags come from legacy.** The search facets use only the gallery tags imported from legacy (their legacy code starts with `thg:tags:`). A tag created in the panel is not offered as a facet. Ask the team if a new facet value is needed.
- **No status filter.** Every placed object and monument is shown, whatever its translations' status ([The status]({{ '/user-manual/master/items' | relative_url }}#the-status)).
- A gallery has a site when it has an instance file. **Draft** on the gallery collection doesn't remove a gallery site; it only matters to the sites that place the gallery's collection under one of theirs.
- The home page shows galleries picked at random, so **Featured** doesn't decide what the home page shows.

## Settings outside the panel

In the gallery's instance file (`scripts/exporters/instances/<gallery>.json`), written from legacy:

- the gallery's address and slug, its legacy project and its legacy label groups;
- the gallery's **image**, its **banner** image and the **banner object**, the home page object and image;
- whether the gallery has a timeline and a country timeline.

In the website repository: the labels, the About and Credits pages, the layout. The development team changes them on request.
