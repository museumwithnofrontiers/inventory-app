---
layout: default
title: Thematic exhibitions
parent: Site families
grand_parent: User Manual
nav_order: 2
---

# Thematic exhibitions
{: .no_toc }

The six thematic exhibitions (*Arts in Dialogue*, *The Hijaz Railway*, *The Table is Set*, *The Use of Colours in Art*, *Water in Islam* and *With Brush and Qalam*) are built by the **dxa-exhibition** exporter. An exhibition is a gallery plus a curated tour: themes and sub-themes, each with hand-picked pictures and their own texts. Everything in the [galleries manual]({{ '/user-manual/sites/dxa-gallery' | relative_url }}) applies; this page adds the curated part.

1. TOC
{:toc}

## What makes up an exhibition

- **The exhibition** is a collection of type **Exhibition**, under **Exhibitions** in the collection tree. Its placements are the exhibition's objects and monuments, as for a gallery.
- **The themes** are its **child collections**, of type **Theme**. A sub-theme is a theme placed under a theme. The tour follows the themes' display order.
- **A theme's selections** are its placements, and each one is a **picture** item, not the object. The site links the picture to its parent object's sheet.

![The themes of Water in Islam, on the exhibition's Child collections tab]({{ '/user-manual/images/exhibition-themes.png' | relative_url }})

## What the site shows, and where it comes from

| On the site | In the panel |
|---|---|
| The exhibition's title | The exhibition collection's **Translations**: **Title**. |
| A theme's title, pull quote and presentation | The theme's **Translations**: **Title**, **Quote**, **Description**. |
| A theme's cover | The theme's **Cover picture**. |
| The pictures of a theme, in order | The theme's **Items** tab: its placements, in display order. |
| The text next to a picture, and its caption | The placement's texts (**View appearance**): **Description** and **Caption** ([The placement's texts]({{ '/user-manual/master/collections' | relative_url }}#the-placements-texts)). The same picture can carry a different text in each theme. |
| "Related pictures" | The picture item's **Links** tab, with their **Description** and **Reciprocal description**. |
| The partner strip | The exhibition's **Partners** tab: level and **Visible**. |
| Audio and video | The theme's or the exhibition's **Links** of type Video or Audio. |
| The reading list | The exhibition's **Links**. |

![The placements of a theme, with their contextual text]({{ '/user-manual/images/theme-placements.png' | relative_url }})

## Things to know

- **Edit the placement, not the picture.** The text and caption a theme prints for a picture are on the placement. Editing the picture item's own translation changes its caption elsewhere, not on the theme page.
- **Theme order.** The themes follow their display order, which the panel doesn't show yet. Ask the team to reorder themes.
- **Links created in the panel.** The related content (audio, video, reading list) is read from the links imported from legacy. A link added in the panel doesn't reach the site yet. Ask the team.
- **Hidden partners.** Some exhibitions hide partners from their lists while still showing their objects. That list is a site setting (below).

## Settings outside the panel

In the exhibition's instance file, written from legacy:

- per language: the **subtitle**, the banner heading, the **About** text, the pop-up logo text and whether it shows, the banner caption, and whether the language is **enabled**;
- the partners hidden from the lists;
- the **logos** of the footer and their links;
- the banner and home page object and image;
- optionally, the list of languages the site offers.

In the website repository: the labels, the menus, the layout. The development team changes them on request.
