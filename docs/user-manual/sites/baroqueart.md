---
layout: default
title: Discover Baroque Art
parent: Site families
grand_parent: User Manual
nav_order: 4
---

# Discover Baroque Art
{: .no_toc }

*Discover Baroque Art* and its 8 mini-sites (*Absolutism*, *Bourgeoisie*, *Devotion*, *Enlightenment*, *Ephemera*, *Languages of the Baroque*, *Reformation*, *Travelling and Exotism*) are built by the **baroqueart** exporter. It works like [Discover Islamic Art]({{ '/user-manual/sites/islamicart' | relative_url }}): read that page first. This page lists the differences.

1. TOC
{:toc}

## What makes up the site

- **The items**: every object and monument of the *Discover Baroque Art* project.
- **The collections**: the collections in that project's context, under **Discover Baroque Art** in the collection tree: the virtual exhibitions and their themes.
- **The partners**: the partners taking part in the project, with a level and **Visible** on.
- **Mini-sites**: one exhibition collection each, as for Islamic Art.

## What is different from Islamic Art

| Topic | Discover Baroque Art |
|---|---|
| **Dynasties** | None: the site has no dynasty browser. |
| **Details** | A monument's **detail** items are shown inside the monument's sheet, as its special features, never as items of their own. A detail without a parent monument is not shown. To add a special feature, create a detail item under the monument. |
| **Exhibition captions** | The placement's **Caption of the item** also prints the **Artist** and the **Material**. |
| **Detail views on exhibition pages** | A detail view is a placement at the same display order as its main view, with **Detail view of variant** set to that view's variant number ([The placement's fields]({{ '/user-manual/master/collections' | relative_url }}#the-placements-fields)). |
| **Related exhibition trails** | An item sheet lists the Travels trails the item is an entry of ([Travels]({{ '/user-manual/sites/travels' | relative_url }})). |

## Things to know

- **Hiding an exhibition.** **Draft** on an exhibition hides it and everything under it, as on Islamic Art.
- **No status filter on items.**

## Settings outside the panel

The mini-sites' instance files (`scripts/exporters/instances/baroqueart-<name>.json`) and the main site's file hold the legacy exhibition settings; the website repositories hold the labels, menus and pages. The development team changes them on request.
