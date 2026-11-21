---
layout: default
title: Site families
parent: User Manual
nav_order: 2
has_children: true
permalink: /site-families/
---

# Site families

Each website is built by one **exporter**, and sites built by the same exporter form a **family**. The pages below add only what is specific to each family. Read the [master manual]({{ '/master-manual/' | relative_url }}) first.

| Family | Sites | Built from |
|---|---|---|
| [Thematic galleries]({{ '/user-manual/sites/dxa-gallery' | relative_url }}) | 37 galleries (Carpets, Ceramics, Amulets…) | one **gallery** collection each |
| [Thematic exhibitions]({{ '/user-manual/sites/dxa-exhibition' | relative_url }}) | 6 exhibitions (Water in Islam, The Use of Colours in Art…) | one **exhibition** collection and its themes each |
| [Discover Islamic Art]({{ '/user-manual/sites/islamicart' | relative_url }}) | the site and 19 mini-sites | the Discover Islamic Art projects; an exhibition per mini-site |
| [Discover Baroque Art]({{ '/user-manual/sites/baroqueart' | relative_url }}) | the site and 8 mini-sites | the Discover Baroque Art project; an exhibition per mini-site |
| [Sharing History]({{ '/user-manual/sites/sharinghistory' | relative_url }}) | the site and 10 mini-sites | the Sharing History project; an exhibition per mini-site |
| [Explore]({{ '/user-manual/sites/explore' | relative_url }}) | Explore with MWNF | the Explore collection tree |
| [Travels]({{ '/user-manual/sites/travels' | relative_url }}) | the Exhibition Trails | the Travels collection tree |
| [Galleries hub]({{ '/user-manual/sites/galleries' | relative_url }}) | the list of all galleries | the Galleries root and the MWNF Galleries project |
| [Books]({{ '/user-manual/sites/publications' | relative_url }}) | MWNF Books | every publication |
| [Global search]({{ '/user-manual/sites/search' | relative_url }}) | the search site | the items every other site shows |

## Settings that are not in the panel

The inventory keeps content and three editorial flags (**Visible**, **Featured**, **Published**). A site's own settings live elsewhere ([ADR 006]({{ '/adr/006-what-goes-in-extra' | relative_url }}), rule 4):

- **The instance files**, one per site, in the inventory repository (`scripts/exporters/instances/<site>.json`). They say which collection or project a site is built from, which partners a mini-site credits, and they keep the site configuration legacy held: a gallery's banner and home picture, an exhibition's subtitle, About text and logos, Explore's home page and itinerary settings. Part of each file is written from legacy by the import and must not be edited by hand.
- **The website repositories**, one per site: the labels and menus, the About and Credits pages, the colours and layout.

The **development team** changes both, through a reviewed pull request. If you need one of these settings changed, ask the team and say which site and which setting. Each family page lists the settings an editor is most likely to look for.
