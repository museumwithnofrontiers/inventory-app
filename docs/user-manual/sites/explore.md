---
layout: default
title: Explore
parent: Site families
grand_parent: User Manual
nav_order: 6
---

# Explore
{: .no_toc }

*Explore with MWNF* is built by the **explore** exporter. Explore belongs to no project: it is a **collection tree**, and the records the tree holds, whatever their project.

1. TOC
{:toc}

## What makes up the site

Everything is under **EXPLORE with MWNF** (purpose *Explore root*) in the collection tree, in the *explore* context:

| Section | Collections |
|---|---|
| **Themes** | collections of type **Theme** |
| **Countries** | collections of type **Collection** |
| **Territories** | collections of type **Region** |
| **Locations** | collections of type **Location** |
| **Itineraries** | collections of type **Itinerary**, and their sub-itineraries of type **Exhibition trail** |

- **The items**: the monuments, objects and details placed in those collections, their details, and the items they link to.
- **The Travels locations** that an Explore location names as its historical background come too.

## How an itinerary is put together

An itinerary doesn't hold its locations as child collections: it **links** them, in order, on its **Related collections** tab ([Related collections]({{ '/user-manual/master/collections' | relative_url }}#related-collections)).

![The locations of an itinerary, as related collections]({{ '/user-manual/images/related-collections.png' | relative_url }})

| Kind of link | On |
|---|---|
| **Location** | an itinerary: its locations, in order |
| **Territory** | an itinerary: its territories |
| **Theme** | a region: its themes |
| **Additional region** | a region: further regions |
| **Historical background** | a location: the Travels locations it draws its history from |

## What the site shows, and where it comes from

| On the site | In the panel |
|---|---|
| A monument's page | The monument's own text (its Islamic Art, Baroque Art, Sharing History or Travels translation) **and** its *explore* translation, which Explore shows apart: name, description, how to reach, information, "prepared by" (the **Author, as printed** line). |
| How to reach a monument, opening hours | The monument's **Visit** tab, in the *explore* context ([Visit information]({{ '/user-manual/master/partners' | relative_url }}#visit-information)). |
| The monuments of a location | The location's **Items** tab. A placement can stand for several Explore monuments: the appearance page's **Explore monuments** button lists them, with their position on the map and their museums. |
| The order of an itinerary's monuments, and their texts | The itinerary's placements and their texts. |
| The filters | The **tags** of category *filter*. |
| Museums | The partners holding the items, and the museums named on the placements. A museum's **Also known as** and its visit information are shown. |
| A collection's texts | Its **Translations** in the *explore* context. |

## Things to know

- **A draft theme isn't shown.** A theme is shown only when **Draft** is off. A collection that isn't shown hides everything under it.
- **Itineraries need their settings.** An itinerary is shown only if it has Explore's itinerary settings in the instance file (below).
- **Linking a new collection breaks the export.** The related-collection links still travel under the linked collection's legacy code. Linking a collection that has none, for example one created in the panel, makes the export fail. Ask the team before linking a new collection.

## Settings outside the panel

In `scripts/exporters/instances/explore.json`, written from legacy:

- the **home page**: banners and featured partnerships;
- the **travel** page: travel books, tours, accommodation, guided visits, websites;
- each **itinerary's** type, order, countries and home link.

The six text pages of the site are in its website repository, with the labels and menus. The development team changes them on request.
