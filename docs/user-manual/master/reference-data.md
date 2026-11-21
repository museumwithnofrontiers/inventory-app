---
layout: default
title: 6. Reference data
parent: Master manual
grand_parent: User Manual
nav_order: 6
---

# 6. Reference data
{: .no_toc }

Records that many items and collections share: tags, artists, dynasties, the glossary, contributors and authors, timelines, links and publications. A change to one of them reaches every site that uses it.

1. TOC
{:toc}

## Tags

**Shared Data → Tags** lists every tag. A tag has an **internal name**, a **description** (the label a site shows), a **category** (keyword, material, artist, dynasty, subject, type, theme, filter…) and, for some, a **language**.

![The Tags list]({{ '/user-manual/images/tags.png' | relative_url }})

Tags drive the search facets and filters of the sites. Each family uses its own categories: the galleries use their own facet tags, Explore its *filter* tags, the Books site its *subject*, *theme* and *audience* tags. The [site family manuals]({{ '/user-manual/sites/' | relative_url }}) say which.

- To tag an item, open the item's **Content** tab, then **Tags → Attach**. To tag many items, select them in the **Items** list and use the bulk action **Attach tag**.
- The **keyword line** an item sheet prints is a text in the item's translation, not the tags. Changing the tags doesn't change the line ([Texts and links stay apart]({{ '/user-manual/master/items' | relative_url }}#texts-and-links-stay-apart)).

## Artists

**Shared Data → Artists** lists the artists, with the number of items linked to each. Type in **Search** to find one by name.

![The Artists list, searched for Bernini]({{ '/user-manual/images/artists.png' | relative_url }})

An artist has a **name**, a **period of activity**, and the place and date of **birth** and of **death**. Its page lists the **Items** linked to it.

![An artist's page]({{ '/user-manual/images/artist-view.png' | relative_url }})

![The items linked to an artist]({{ '/user-manual/images/artist-items.png' | relative_url }})

- **Edit** corrects the artist's record. The change reaches every item linked to it, on the pages that use the links (artist indexes, filters).
- **Attach** on the **Items** tab links an existing item to the artist; **Detach** removes the link and keeps both records. The item's **Origin** tab does the same from the item's side.
- The artist **lines** printed on an item sheet are texts in each item's translation ([Artist section]({{ '/user-manual/master/items' | relative_url }}#which-field-is-which-text)). Correcting the artist record doesn't rewrite them, and editing a line doesn't rename the artist.
- Legacy has no artist records, so the import creates none: an artist is created here, by an editor, and linked to its items. An artist is never created from a text by the inventory itself.

## Dynasties

**Shared Data → Dynasties** lists the dynasties, with their years, their number of translations and of linked items.

![The Dynasties list, searched for Mamluk]({{ '/user-manual/images/dynasties.png' | relative_url }})

A dynasty has its years **from** and **to**, in the Common Era (**AD**) and the Hijri calendar (**AH**). Its page has two tabs:

![A dynasty's page]({{ '/user-manual/images/dynasty-view.png' | relative_url }})

- **Translations**: one per language, with the dynasty's **name**, **Also known as**, the **date descriptions** (AD and AH) as written, its **area**, its **history**, and the authors of its text (author, text copy editor, translator, translation copy editor). **New dynasty translation** adds a language; **Edit** changes one.

  ![The translations of the Mamluks]({{ '/user-manual/images/dynasty-translations.png' | relative_url }})

- **Items**: the items linked to the dynasty. **Attach** and **Detach** work as for artists.

Discover Islamic Art's dynasty browser shows every dynasty, with its texts and its items ([Discover Islamic Art]({{ '/user-manual/sites/islamicart' | relative_url }})). The dynasty **line** on an item sheet is the item translation's own text, as for artists.

## Glossary

**Shared Data → Glossaries** holds the glossary terms the sites explain in a pop-up. A term has:

- **Translations**: its **definition** per language;
- **Spellings**: the forms of the word to look for, per language (*Mihrab*, *Maharib*…);
- **Synonyms**: other terms with the same meaning.

![The spellings of the glossary term Mihrab]({{ '/user-manual/images/glossary-spellings.png' | relative_url }})

The inventory links the texts to the glossary **by itself**. When you add or change a spelling, or save a text, it looks for the spelling, as a whole word, in the texts of that language (item names and descriptions, the other item fields, collection and timeline texts, dynasty texts), in the background. A site shows a term on the texts that contain one of its spellings, and ships only the terms some text uses. So:

- to make a word clickable, add its spelling, in the right language, to the term;
- to stop a wrong match, remove or correct that spelling.

## Contributors

**Inventory → Contributors** holds the credits of the **collections**: who curated an exhibition, wrote its texts, coordinated it locally, took its photographs. Each contributor belongs to one collection and has:

- a **category** (author, curated by, prepared by, credits, local coordinator, local team, photo by, Travels author…): the site prints the credits under their category;
- a **display order**;
- **Visible**: a hidden contributor is not exported;
- **Translations** per language: the **name** as printed, a **description**, a **link** and an alt text;
- **Images**, such as a sponsor's logo, attached through the image pipeline.

You also reach them from the collection's **Contributors** tab. Names in credits are published on the sites; enter them only as the person agreed to be credited.

## Authors and credits

**Shared Data → Authors** lists the authors of item texts: the writers, copy editors and translators. An author has a **name** and an internal name.

An item translation links up to four authors (author, text copy editor, translator, translation copy editor) and keeps, next to each link, the credit line **as printed** ([Credits as printed]({{ '/user-manual/master/items' | relative_url }}#credits-as-printed)). Correcting an author's name changes the link everywhere, but not the credit lines as printed.

## Timelines

A **timeline** is a list of events for one country, often for one collection (a Sharing History exhibition, for example). **Inventory → Timelines** lists them; **Browse timeline tree** shows them with their events.

![The timeline tree with one timeline opened]({{ '/user-manual/images/timeline-tree.png' | relative_url }})

A **timeline event** (**Inventory → Timeline Events**) has:

- its years **from** and **to**, in AD and AH, or exact dates, and a **display order**. An event with no end year has none: leave **to** empty, not 0;
- **Translations**: its **name**, **description**, and the date descriptions as written;
- **Images**, attached through the image pipeline;
- **Items**: the items that illustrate it. An item's **Timeline** tab shows the same links.

## Links

A **link** is an address on the web, attached to an item, a collection or a partner, on their **Links** tab (on an item: the **Media** tab). Its fields:

| Field | What it holds |
|---|---|
| **Type** | Video, Audio, Document, Website, Shop, Catalogue entry, Further reading, Virtual visit. |
| **URL**, **Title**, **Language** | The address, its title, and the language of the page. |
| **Description**, **Authors** | A short description and its authors, as printed. |
| **Category** | Legacy's category number; the site shows its name. |
| **Resource type**, **Location**, **Country code**, **Further reading** | Further details some sites print. |
| **Display order** | |

## Publications

**Inventory → Publications** holds the books and catalogues of the Books site, the travel books of Islamic Art and the publications that accompany a trail or an exhibition. A publication has:

- **Core information**: its **category**, its **status** (published, in preparation), its **main language**, project, country and display order;
- **Translations**: **title**, **subtitle**, **description**, **introduction**, and the **author**, **photography** and **coordination** credits as printed;
- **Editions**: one per language and format;
- **Images**: covers and sample pages;
- **Documents**: sample and credits PDFs;
- **Collections** (the trails or exhibitions it accompanies), **Items** (the items it catalogues) and **Tags**.

The [Books manual]({{ '/user-manual/sites/publications' | relative_url }}) explains how the Books site uses each of them.
