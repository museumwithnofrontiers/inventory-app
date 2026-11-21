---
layout: default
title: User Manual
nav_order: 2.5
has_children: true
permalink: /user-manual/
---

# User Manual

These manuals are for the editors who maintain the content of the Museum With No Frontiers websites in the inventory's back-office, the **panel** at `/admin`.

Every website and mini-site already exists: their content came from the legacy databases. So the manuals explain how to **find and maintain existing content**. They don't explain how to create a new website: that is the development team's work ([New website]({{ '/deployment/new-website' | relative_url }})).

## How the manuals are organised

| Manual | Read it when |
|---|---|
| [Master manual]({{ '/master-manual/' | relative_url }}) | Always first. It covers everything common to every site: signing in, finding records, items and their texts, images, collections and placements, partners, reference data, legacy links, and what happens after you save. |
| [Site families]({{ '/site-families/' | relative_url }}) | You maintain one family of sites. Each page adds only what is specific to that family: which panel records make up the site, which texts it prints, and which settings live outside the panel. |

## Three rules to keep in mind

1. **An edit reaches a website only with the next export.** Saving in the panel changes the inventory at once, but a public site shows the change only after the team exports, publishes and propagates the data packages. See [From the panel to the website]({{ '/user-manual/master/publishing-cycle' | relative_url }}).
2. **Texts are kept as written.** A text field holds the text the site prints, and a link (to an artist, a dynasty, a tag, an author) holds the structure next to it. One never replaces the other: correcting a dynasty line doesn't change the Dynasty link, and linking a Dynasty doesn't rewrite the line ([ADR 006]({{ '/adr/006-what-goes-in-extra' | relative_url }})).
3. **Site settings are not in the panel.** Banners, site colours, menu entries, logos in a site's footer and similar settings live in the sites' configuration files, which the development team maintains. Each family manual says which settings those are.

## The examples

The screenshots come from a test copy of the inventory, filled from a full import of the legacy databases. They use real records, such as the *Aleppo Room* of the Museum für Islamische Kunst or the *Water in Islam* exhibition, so that what you see matches what you will find in the panel. Your panel may show more or fewer menu entries, depending on your role.
