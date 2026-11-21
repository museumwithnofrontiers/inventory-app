---
layout: default
title: Discover Islamic Art
parent: Site families
grand_parent: User Manual
nav_order: 3
---

# Discover Islamic Art
{: .no_toc }

*Discover Islamic Art* and its 19 mini-sites (*Water*, *The Mamluks*, *The Ottomans*, *Pilgrimage*, *Artistic Introduction*…) are built by the **islamicart** exporter.

1. TOC
{:toc}

## What makes up the site

- **The items**: every object and monument of the two Discover Islamic Art projects, *Discover Islamic Art* and *Explore Islamic Art Collections*. Adding an object to the site means giving it one of these projects; there is no collection to place it in.
- **The collections**: every collection in those projects' context, under **Discover Islamic Art** in the collection tree:
  - **Virtual Exhibitions** (purpose *Exhibitions root*): each exhibition is a collection of type **Exhibition**, its themes and pages are child collections of type **Theme**;
  - **Artistic Introduction** (purpose *Artistic introduction root*): a collection with its chapters as **Theme** children.
- **The partners**: the partners taking part in the projects, with a level and **Visible** on ([Participations]({{ '/user-manual/master/partners' | relative_url }}#participations-whether-a-site-lists-the-partner)).
- **The dynasty browser**: every **Dynasty**, with its translations and its linked items.
- **The glossary**: the terms whose spellings appear in the site's texts ([Glossary]({{ '/user-manual/master/reference-data' | relative_url }}#glossary)).

## Mini-sites

A mini-site is one virtual exhibition published as a site of its own. It is built from **one exhibition collection** (named in its instance file) and everything under it: its themes, the items they place, and the curators the instance file names.

The main site keeps only the mini-site's exhibition and theme titles, and its placements for "on display in": the exhibition's pages are on the mini-site. So to edit the *Water* exhibition, open the *Water* exhibition collection under **Virtual Exhibitions** and work on its themes and placements.

## What the site shows, and where it comes from

| On the site | In the panel |
|---|---|
| The item sheet | The item's translation in the *Discover Islamic Art* context; the *Explore Islamic Art Collections* text gives the short description ([Which field is which text]({{ '/user-manual/master/items' | relative_url }}#which-field-is-which-text)). |
| The travel book on a sheet | The first Islamic Art in the Mediterranean publication of the item's country. It is chosen by a rule, not linked by hand. |
| An exhibition's or a theme's texts | The collection's **Translations**: **Title**, **Subtitle**, **Description**, **Introduction**, **Quote**; its **Contributors** as credits. |
| The objects of an exhibition page, in order | The theme's **Items** tab (placements). |
| The caption of an object on an exhibition page | The placement's texts: **Caption of the item** (**Name**, **Date**, **Dynasty**, **Location**, **Museum**), **Title** and **Description** ([The placement's texts]({{ '/user-manual/master/collections' | relative_url }}#the-placements-texts)). |
| The picture shown on an exhibition page | The placement's **Picture shown**; alternatives at the same place are **variants**. |
| Dynasty pages | **Shared Data → Dynasties**. |

## Things to know

- **Hiding an exhibition.** Turning **Draft** on for an exhibition hides it and everything under it, for the exhibitions whose settings came with a mini-site.
- **Exhibition captions are the placement's.** Correct a caption on the placement, not on the item.
- **No status filter on items.** Every object and monument of the projects is shown.

## Settings outside the panel

- In the mini-site's instance file (`scripts/exporters/instances/islamicart-<name>.json`): the exhibition collection, the partners credited as curators, the legacy address, and the legacy exhibition settings (portal picture, link, display order).
- The languages of the main site's language switcher are fixed in the exporter (Arabic, German, Greek, English, Spanish, French, Italian, Portuguese, Swedish, Turkish), each kept only if some item is translated in it. A mini-site offers the languages its exhibition has a title in.
- The labels, menus and pages of the sites are in their website repositories.

The development team changes them on request.
