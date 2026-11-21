---
layout: default
title: Travels
parent: Site families
grand_parent: User Manual
nav_order: 7
---

# Travels
{: .no_toc }

*MWNF Travel*, the Exhibition Trails, is built by the **travels** exporter. Like Explore, it is a collection tree, not a project.

1. TOC
{:toc}

## What makes up the site

Everything is under **Travels** (purpose *Travels root*) in the collection tree, in the Travels context:

```
Travels
└── trail                (type Exhibition trail, for example MUDEJAR ART)
    └── itinerary        (type Itinerary)
        └── location     (type Location)
            └── monuments placed in the location
```

![The itineraries of the MUDEJAR ART trail]({{ '/user-manual/images/travels-trail-itineraries.png' | relative_url }})

- **The monuments** are the items placed in the **locations**, with their details. The site shows them in the itineraries' galleries; there is no item page.
- **A trail's entries** are the items placed in the **trail** itself. They are Islamic Art records: the site shows them as references only (their name, first picture, and links to the sites that show them).

## What the site shows, and where it comes from

| On the site | In the panel |
|---|---|
| A trail's, an itinerary's, a location's texts | Their **Translations**: **Title**, **Subtitle**, **Introduction**, **Duration** (a trail's), and their **Contributors** (curated by, local coordinator, photo by, author, prepared by). |
| An itinerary's number of days | The itinerary's **Days** field. |
| A monument's text | The monument's translation in the **Travels** context, whatever its project. |
| The order of a location's monuments | The location's placements, in display order. |
| How to reach a location | The location's **Visit information** tab. |
| A trail entry's text | The placement's **Description** on the trail ([The placement's texts]({{ '/user-manual/master/collections' | relative_url }}#the-placements-texts)). |
| A trail's starting point | The trail's **Partners** tab: the partner at level *Partner*. |
| The books that accompany a trail | The trail's **Publications** tab. The link points to the book's page on the Books site. |

## Things to know

- **No hiding flag.** **Visible** doesn't hide a trail, an itinerary or a location on this site. Partners follow their participation's **Visible**.
- Travels locations can also appear on Explore, as the historical background of an Explore location ([Explore]({{ '/user-manual/sites/explore' | relative_url }})).

## Settings outside the panel

The instance file (`travels.json`) only says which part of the tree is the site's. The labels, menus and pages are in the website repository. The development team changes them on request.
