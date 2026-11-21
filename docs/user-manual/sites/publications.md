---
layout: default
title: Books
parent: Site families
grand_parent: User Manual
nav_order: 9
---

# Books
{: .no_toc }

*MWNF Books*, the publications site, is built by the **publications** exporter. It shows **every publication** in the inventory, in their display order.

1. TOC
{:toc}

## What makes up the site

**Inventory → Publications** lists them. A publication brings:

- its **editions**, one per language and format (print, print on demand, e-book…);
- its **covers** and **sample pages** (images);
- its **sample** and **credits** PDFs (documents);
- the **trails** it accompanies (its **Collections**) and the **items** it catalogues. Those are shown as references: their name, picture and a link to the site that shows them.

## What the site shows, and where it comes from

| On the site | In the panel |
|---|---|
| Title, subtitle, description, introduction | The publication's **Translations**, in its project's context. |
| The author, photography and coordination credits | The translation's **Author credit**, **Photography credit**, **Coordination credit**, as printed. |
| Category, status, country, main language | The publication's **Core information**. **Status** (*Published*, *In preparation*) is shown; it doesn't hide the book. |
| An edition's format, edition number, year, ISBN, publisher, pages, images, plans, dimensions, binding | The publication's **Editions** tab. |
| The covers and sample pages | The publication's **Images**, of kind *Cover* or *Page*. A cover is the **Cover of edition** of one edition. The book's main cover is the cover of a visible edition in its main language. |
| The sample and credits PDFs | The publication's **Documents** tab. |
| Subjects, themes, audiences | The publication's **Tags** of those categories. |

![The editions of a publication]({{ '/user-manual/images/publication-editions.png' | relative_url }})

## Editions

**New publication edition** adds an edition; **Edit** on a row changes it. Each edition has a **Visible** switch: **an edition that is not visible is not shown anywhere**, and neither are its covers, sample pages or PDFs. Use it to withdraw an edition without deleting it.

## Documents: sample and credits PDFs

![The documents of a publication]({{ '/user-manual/images/publication-documents.png' | relative_url }})

1. On the publication's **Content** tab, in **Documents**, select **Upload document**.
2. Choose the PDF file, its **kind** (*Sample* or *Credits*), its **edition**, its **language** and its display order.
3. Select **Submit**. The file is checked in the background, then listed.

Publication documents are public: the site links to them at a stable address, `/doc/<id>.pdf`. They are served as uploaded, without a stamp.

## Things to know

- The editions' shop links are not shown on the site.
- A publication linked to a Travels trail also appears on the Travels site, and an Islamic Art in the Mediterranean book can appear as the travel book of Islamic Art item sheets ([Discover Islamic Art]({{ '/user-manual/sites/islamicart' | relative_url }})).

## Settings outside the panel

None in the instance file. The labels, menus and pages are in the website repository. The development team changes them on request.
