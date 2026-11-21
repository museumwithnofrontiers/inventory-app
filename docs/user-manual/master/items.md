---
layout: default
title: 2. Items and their texts
parent: Master manual
grand_parent: User Manual
nav_order: 2
---

# 2. Items and their texts
{: .no_toc }

1. TOC
{:toc}

## The four kinds of item

Every object or monument a site describes is an **item**. The **Type** says which kind:

| Type | What it is | Its parent |
|---|---|---|
| **Object** | A movable work held by a museum. | none |
| **Monument** | A building or a site. | none |
| **Detail** | A part of a monument shown on its own: a portal, a mihrab, a ceiling. | its monument |
| **Picture** | One picture of an object or a monument, with its own caption. | its object or monument |

So an object's pictures, and a monument's details and pictures, are **child items**. The *Aleppo Room* is an object with three picture children: *Aleppo Room. (1)*, *(2)* and *(3)*.

## Opening an item

Find the item with the global search, the **Items** list or **Browse item tree** ([chapter 1]({{ '/user-manual/master/getting-started' | relative_url }}#finding-records)). The view page shows:

- **Core Information**: the type, the parent, the **Partner** (the museum or institution that holds it), the country, the project, the display order among its siblings, and the map position (latitude, longitude, map zoom) used by the maps of Explore and Travels.
- **System Information** (folded): UUID, internal name, legacy code, dates.
- **Legacy links**: the item's pages on the legacy websites ([chapter 7]({{ '/user-manual/master/legacy-links' | relative_url }})).
- The **tabs** with everything related to the item.

![The tabs of an item, with the Content tab open on its child items]({{ '/user-manual/images/item-relation-tabs.png' | relative_url }})

| Tab | What it holds |
|---|---|
| **Content** | Child items; **Translations** (the texts); **Pictures**; **Collection appearances** (every collection the item is placed in); **Tags**; **Publications** that cite it. |
| **Media** | **Images** attached to the item; **Links** (videos, websites, catalogue entries…); **Documents** ([chapter 3]({{ '/user-manual/master/images' | relative_url }})). |
| **Origin** | The **Artists** and **Dynasties** the item is linked to. |
| **Links** | Links to related items, in both directions: **Outgoing** and **Incoming**. |
| **Timeline** | The timeline events that illustrate themselves with this item. |
| **Visit** | Visit information, for monuments ([chapter 5]({{ '/user-manual/master/partners' | relative_url }}#visit-information)). |

**Edit** at the top of the page changes the core fields. The internal name and the legacy code are technical: leave them as they are.

## Translations: the texts of an item

Everything a site prints about an item, apart from its pictures and its links, is in its **translations**. An item has one translation per **language** and **context**.

![The Translations table of the Aleppo Room]({{ '/user-manual/images/item-translations.png' | relative_url }})

### Which translation a site uses

The **context** says which site family the text was written for. The *Aleppo Room* has two English texts: one in the *Discover Islamic Art* context and one in the *Explore Islamic Art Collections* context.

- A site prints the translation in the context of the item's **project**. A gallery that borrows an Islamic Art object still prints its *Discover Islamic Art* text.
- Some sites also read a second context. Explore and Travels, for example, read their own context for the texts written for them. The [site family manuals]({{ '/site-families/' | relative_url }}) say which.
- The **★** column marks the translation in the default language and the default context. Some items have none: their texts are all in a site context. **Create default translation** creates one. You don't need it to maintain a site.

So **edit the translation in the context of the site you are maintaining**, and leave the other contexts' texts to their own sites.

### Editing a translation

1. On the item's **Content** tab, find the row in the **Translations** table.
2. Select **Edit translation** (at the end of the row). The panel opens the translation's own page.
3. Change the texts, then select **Save changes**.

You can also reach every translation from **Translations → Item Translations** in the menu, with filters on language, context and status.

![The top of a translation's form: item, language, context and status]({{ '/user-manual/images/item-translation-edit-top.png' | relative_url }})

The form is in folded sections. Select a section's heading to unfold it.

![The folded sections of a translation's form]({{ '/user-manual/images/item-translation-sections.png' | relative_url }})

### Which field is which text

Each field holds one text, **as the site prints it**. Nothing is computed from another field, and no field is filled from another one.

| Section | Field | What it holds |
|---|---|---|
| **Basic Text** | **Name** | The item's title. |
| | **Alternate name** | Another name ("also known as", "other name"). |
| | **Description** | The main text. Markdown: `*italic*`, `**bold**`, links. |
| | **Short description** | A second, shorter text, where legacy had one. |
| **Object Details** | **Type** | The kind of object or monument as a text ("Ceramics", "Mosque"). |
| | **Dates** | The date line ("c. Hegira 930–35 / c. AD 1530–35"). |
| | **Location** | Where it was made or found, or where the monument stands. |
| | **Dimensions** | |
| | **Materials** | The materials and techniques line. |
| | **Dynasty** | The dynasty line as printed. The Dynasty links are on the item's **Origin** tab. |
| | **Keywords** | The keyword line as printed. The Tags are on the item's **Content** tab. |
| | **Region** | Region or province. |
| | **Place of production** | |
| | **Holder**, **Owner**, **Initial owner** | The holding museum, the owner and the original owner, as written. |
| **Research & Provenance** | **Method for datation**, **Method for provenance** | How the date and the provenance were established. |
| | **Provenance**, **Obtention** | Where the item comes from and how the museum obtained it. |
| | **Bibliography** | |
| | **Catalogue references** | Catalogue codes and citations as written. |
| **Monument** | **History** | The monument's history. |
| **Artist** | **Artist**, **Period of activity**, **Date** and **Place of birth**, **Date** and **Place of death**, **Workshop**, **Scribe**, **Patrons**, **Architects** | The artist lines as printed. The Artist links are on the item's **Origin** tab. |
| **Notices and rights** | **Notice**, **External notice** | Sharing History's notices. |
| | **Image rights** | The rights line of the object's pictures. |
| | **External sources**, **Name in the original language**, **Holding institution (original language)**, **Archival reference** | Sharing History's additional lines. |
| **Contributors** | **Author**, **Text copy editor**, **Translator**, **Translation copy editor** | Links to Author records ([chapter 6]({{ '/user-manual/master/reference-data' | relative_url }}#authors-and-credits)). |
| | **…, as printed** | The credit lines as the site prints them. |
| **Legacy & Metadata** | Legacy code, extra data | Technical. Leave them as they are. |

Not every kind of item uses every field. Objects use nearly all of them. Monuments use the descriptive ones and the history. Details and pictures use the name, description, dates and location: **a picture's caption is its translation**. [Item types and their translation columns]({{ '/models/item-types' | relative_url }}) gives the figures.

![Object Details unfolded: type, dates, location, dimensions, materials]({{ '/user-manual/images/item-translation-object-details.png' | relative_url }})

### Texts and links stay apart

The dynasty, keyword, artist and credit lines exist twice, on purpose:

- the **text** in the translation is what the item sheet prints, as written;
- the **link** (to a Dynasty, a Tag, an Artist, an Author) is what indexes, filters and browse pages use.

Correct each one where it is. Linking a Dynasty doesn't change the dynasty line, and rewording the line doesn't change the link. An item with a text and no link is normal: linking it is editorial work you can do on the **Origin** or **Content** tab.

### The status

Every translation has a **Status**:

| Status | Meaning |
|---|---|
| **Published** | The normal state. |
| **Unedited** | The text exists but has not been reviewed yet. It is a marker for editors: no website reads it today, so an unedited text is shown like a published one. |
| **Hidden** | Left out of lists and search; the pages that link to it still show it. Today only Sharing History acts on it: one hidden translation makes the whole item a "Historical Background illustration only" item there ([Sharing History]({{ '/user-manual/sites/sharinghistory' | relative_url }})). The other sites show it like a published one. |

To take an item off a site, ask yourself first what makes it appear there: usually a **placement** in one of the site's collections ([chapter 4]({{ '/user-manual/master/collections' | relative_url }})). Detaching that placement is what removes it.

### Credits as printed

The **Contributors** section has two fields per role. The link (**Author**, **Translator**…) points to an Author record. The **…, as printed** field holds the credit line exactly as the site prints it, which can differ from the Author's name (an initial, another spelling, a line in Arabic). The site prints the line; keep the link for the Author's list of texts. When you add a credit, fill both.

## Pictures

A picture item is a child of its object or monument. The **Pictures** table on the parent's **Content** tab lists them, in their **Order**. The item sheet shows the pictures in that order, each with the image attached to that picture item.

To add a picture to an item sheet:

1. On the parent's **Content** tab, in **Pictures**, select **Create**. Give it the same partner, country and project as its parent: the sites show only the pictures of the item's own project.
2. On the new picture's page, add its **translation**: its name and its caption (the description).
3. Upload the image to the pool and attach it to the **picture** item ([chapter 3]({{ '/user-manual/master/images' | relative_url }})).
4. Set its **display order** among the pictures.

To change a caption, edit the picture item's translation, not the parent's.

## Related items

The **Links** tab lists the item's links to other items: the related objects of an item sheet, or the related pictures of an exhibition picture. Each link has a context and a text per language: **Description (source → target)** and **Reciprocal description (target → source)**, the justification a site prints next to the related item. The menu entry **Item Links** lists every link.

## Tags, artists, dynasties

- **Tags** (Content tab) feed the search facets and filters of the sites. **Attach** links an existing tag. The **Items** list also has a bulk action, **Attach tag**, to tag several items at once.
- **Artists** and **Dynasties** (Origin tab): **Attach** links an existing record, **Detach** removes the link. To create or correct an artist or a dynasty, use their own pages ([chapter 6]({{ '/user-manual/master/reference-data' | relative_url }})).

![The Origin tab of the Aleppo Room: one artist, one dynasty]({{ '/user-manual/images/item-origin.png' | relative_url }})
