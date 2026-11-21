---
layout: default
title: Galleries hub
parent: Site families
grand_parent: User Manual
nav_order: 8
---

# Galleries hub
{: .no_toc }

The galleries hub, the site that lists every thematic gallery and the museums of the galleries, is built by the **galleries** exporter. It ships no items of its own: the galleries are separate sites ([Thematic galleries]({{ '/user-manual/sites/dxa-gallery' | relative_url }})).

1. TOC
{:toc}

## What makes up the site

- **The galleries**: the collections of type **Gallery** under **Galleries** (purpose *Galleries root*) that have a site of their own.
- **The partner directory**: the museums of the *MWNF Galleries* project, and that project's objects and monuments they hold.

## What the site shows, and where it comes from

| On the site | In the panel |
|---|---|
| A gallery's name, in each language | The gallery collection's **Translations**: **Title**. |
| A gallery's featured flag and live date | Not in the panel: the gallery's instance file, as legacy set them. Ask the team. |
| A partner's level | The partner's participation in the *MWNF Galleries* project: *Partner* shows as "Partner", no level as "Affiliate". |
| A partner's texts, logos, pictures | The partner's **Translations**, **Logos** and **Images** ([Partners]({{ '/user-manual/master/partners' | relative_url }})). |

## Things to know

- **The order** of the gallery list is alphabetical, by English name.
- **Hiding a gallery** from the hub is not done in the panel: a gallery is listed when it has its own site (an instance file). Ask the team.
- **Featured** is shipped, but the hub's home page shows galleries and partners picked at random.

## Settings outside the panel

The images and other settings of the galleries without a site of their own are in `scripts/exporters/instances/galleries.json`. The grid icons and the "Other Virtual Museums" pictures belong to the website repository. The development team changes them on request.
