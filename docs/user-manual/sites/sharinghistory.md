---
layout: default
title: Sharing History
parent: Site families
grand_parent: User Manual
nav_order: 5
---

# Sharing History
{: .no_toc }

*Sharing History* and its 10 mini-sites (*Cities and Urban Spaces*, *Economy and Trade*, *Migrations*, *Travelling*…) are built by the **sharinghistory** exporter.

1. TOC
{:toc}

## What makes up the site

Everything belongs to the *Sharing History* project and its context, under **Sharing History** in the collection tree:

- **The items**: the project's objects and monuments.
- **The exhibitions**: collections of type **Exhibition**, with **themes** (type **Theme**) and **chapters** (type **Subtheme**).
- **The sections** found by their purpose:

| Section | Collection |
|---|---|
| **Historical Background** | under the collection with purpose *Historical background root* |
| **Topics** | under the collection with purpose *Topics root* |
| **Historical Profiles** | under the collection with purpose *Historical profiles root* |
| **National Contexts** | the collections with purpose *National context*: one per country and exhibition |

- **Timelines**: the timelines of each country and exhibition, with their events.
- **Partners**: the partners taking part in the project, with a level and **Visible** on. Their **City** is printed in the partner list.

## Mini-sites

A mini-site is one exhibition published as a site of its own: the exhibition collection and its themes and chapters, **without its national contexts**. Its partners are the holders of the items it places, plus those its instance file names.

## What the site shows, and where it comes from

| On the site | In the panel |
|---|---|
| The item sheet | The item's translation in the Sharing History context. Sharing History uses more fields than any other site: **Alternate name** (other name), **Name in the original language**, **Archival reference**, **Holding institution (original language)**, **External sources**, **Notice** and **External notice** ([Which field is which text]({{ '/user-manual/master/items' | relative_url }}#which-field-is-which-text)). |
| An item's place in an exhibition, with the curator's and the partner's justification | The placement's texts: **Justifications** → **Curator** and **Partner** ([The placement's texts]({{ '/user-manual/master/collections' | relative_url }}#the-placements-texts)). |
| The single justification of a National Context | The placement's **Justifications** → **National Context**. |
| Whether the curator selected the item | The placement's **Curator selection**. |
| The picture captions of Historical Background pages and the map captions of Historical Profiles | The collection's **Images** → **Edit** → **Translations**: caption, name, date, museum, location ([The image's own fields]({{ '/user-manual/master/images' | relative_url }}#the-images-own-fields)). |
| The timelines | **Timelines** and **Timeline Events** of each country and exhibition ([Timelines]({{ '/user-manual/master/reference-data' | relative_url }}#timelines)). |
| The partner list | Partners: **name**, **City**, **Category**. |

## Things to know

- **The Hidden status matters here.** If **any** translation of an item has the status **Hidden**, the item becomes a "Historical Background illustration only" item: it is left out of the search and of the Permanent Collection, but the Historical Background and timeline pages that use it still show it. One hidden language hides the whole item there.
- **A draft exhibition** is not removed: it keeps its titles and placements, marked unpublished, and its national contexts are left out. Its timelines become Permanent Collection timelines.
- **Historical Background captions created in the panel.** The captions are read from the images imported from legacy. A caption on an image attached in the panel doesn't reach the site yet. Ask the team.

## Settings outside the panel

The instance files (`sharinghistory.json` and `sharinghistory-<name>.json`) hold the legacy exhibition settings and the mini-sites' logos; the website repositories hold the labels, menus and pages. The development team changes them on request.
