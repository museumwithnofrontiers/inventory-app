---
layout: default
title: Global search
parent: Site families
grand_parent: User Manual
nav_order: 10
---

# Global search
{: .no_toc }

The global search site searches the items of every MWNF website at once. It is built by the **search** exporter, and its index is loaded into the search engine from the published package ([ADR 005]({{ '/adr/005-global-search' | relative_url }})).

1. TOC
{:toc}

## What it contains

- **Every object, monument and detail that some site shows.** An item no site shows is left out. A detail without a page of its own opens its monument's page.
- A search result opens the item's page on the site that shows it.

So there is nothing to place for the search: an item is searchable when it is on a site.

## What is searched

Per language:

- the name the item's own site gives it, and its other names: its texts in other contexts, the **Alternate name**, the **Name in the original language**;
- the descriptions, type, holder, dates, location, dynasty, artist, history, keywords and materials lines;
- the **tags** of the categories keyword, material, type, artist, dynasty, subject and theme;
- the partner's and the country's names, reference numbers, and the item's first picture.

Bibliographies, credits and copyright lines are not searched.

## Things to know

- **No status filter.** Hidden and unedited translations are searched like published ones.
- **The search changes last.** A change reaches the search only after the team has published the packages and reloaded the search index from them ([From the panel to the website]({{ '/user-manual/master/publishing-cycle' | relative_url }})).

## Settings outside the panel

The instance file (`search.json`) has no settings. The search engine's settings (ranking, synonyms, filters) are in the search service's own code (`scripts/search/`), and the site's labels in its website repository. The development team changes them on request.
