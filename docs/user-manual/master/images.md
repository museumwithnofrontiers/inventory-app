---
layout: default
title: 3. Images and documents
parent: Master manual
grand_parent: User Manual
nav_order: 3
---

# 3. Images and documents
{: .no_toc }

1. TOC
{:toc}

## How images work

An image always goes through the same steps. There is no shortcut, and the panel offers none: this path protects the original files and the copyright.

1. **Upload** the file to the pool of **Available Images**. The panel checks that it is a valid image and reduces it if it is larger than the maximum size.
2. **Attach** it from the pool to a record: an item (usually a picture item), a collection, a partner, a contributor, a timeline event or a publication. The image leaves the pool.
3. The websites show it through its **public address**, `/pub/<file name>`, with the **copyright burned** into the picture.
4. **Detach** puts the image back into the pool, unchanged, to attach it elsewhere. **Delete permanently** destroys it.

The original file is never public. What a website shows is a copy with the copyright line burned in, made the first time someone asks for it.

## Uploading an image

1. In the menu, open **Available Images → Available Images**.
2. Select **Upload image**.

   ![The Available Images page]({{ '/user-manual/images/available-images.png' | relative_url }})

3. Drop the file on the dialog, or select **Browse**. JPEG, PNG, GIF and WebP files are accepted, up to the size limit (20 MB unless the team changed it).

   ![The Upload image dialog]({{ '/user-manual/images/image-upload-dialog.png' | relative_url }})

4. Select **Submit**. *Image uploaded and available* means the image is in the pool. *Image processing failed* means the file is not a valid image: nothing was added.

On the pool's list, **Edit** lets you fill in, before you attach it, a **Comment** that helps you find the image when you attach it, the **Burned on the picture** text, the **Picture credit** and the **Photographer**. The last three travel with the image when you attach it.

## Attaching an image to a record

1. Open the record, for example a picture item, and go to its **Media** tab (on a collection or a partner: its **Images** tab).
2. In **Images**, select **Attach image**.
3. In **Available image**, type part of the file name or comment and pick the image.
4. Optionally type an **Alt text**: a short description for readers who can't see the picture.
5. Select **Submit**. The image is attached and leaves the pool.

![The Images table of an item, with its row actions]({{ '/user-manual/images/item-images.png' | relative_url }})

On an item sheet, the pictures are the item's **picture items**, each with its own image ([Pictures]({{ '/user-manual/master/items' | relative_url }}#pictures)). So attach a new picture to a new picture item, not to the object itself.

## The image's own fields

Select **Edit** on the image's row.

![The edit form of an attached image]({{ '/user-manual/images/image-edit-form.png' | relative_url }})

| Field | What it does |
|---|---|
| **Alt text** | The description for screen readers. |
| **Display order** | The order among the record's images. |
| **Burned on the picture** | The copyright line written into the picture itself. **Leave it blank** in the normal case: the picture then gets the copyright of the record's **project**, or, without one, "© Museum With No Frontiers". Fill it only when this picture needs another line. |
| **Picture credit** | The picture's own credit, where it is not the burned line. The item sheets print it instead of the burned line. It is never burned into the picture. |
| **Photographer** | The photographer's name, as printed. |
| **Translations** | The picture's texts per language: **caption**, **name**, **date**, **museum**, **location**, and **credit** and **photographer** where they differ by language. Select **Add a language** to add one. |

When the burned line changes, the websites get the new picture by themselves: its public address stays the same, and the next visitor receives the new version.

## Viewing, downloading, detaching, deleting

| Action | What it does |
|---|---|
| **View image** | Opens the original file in a new tab. |
| **Download** | Downloads the original file. |
| **Detach** | Takes the image off the record and puts it back into the pool, with its copyright, credit and photographer. Its public copy is removed: the website no longer shows it after the next export. You can attach it again later. |
| **Delete permanently** | Destroys the image and its original file. It can't be undone. Use **Detach** unless you are sure. |

## Partner logos

A partner's **Logos** tab lists its logos. You can view, download and edit them (type, alt text, order, copyright), and delete them. Logos came with the import: the panel has no button to add one. A logo is never burned with a copyright.

## Documents

### Documents of an item

An item's **Media** tab has a **Documents** table, for PDF files about the item: a condition report, a catalogue sheet, a scan of a publication.

1. Select **Upload document**.
2. Choose the PDF file, its **Language**, a **Title** and a **Display order**.
3. Select **Submit**. The file is checked in the background, then listed.

Item documents are **private**: no website shows them. They are kept for the team.

### Documents of a publication

A publication's sample pages and credits pages are PDF files too, and those are public: the Books site links to them. See [Publications]({{ '/user-manual/master/reference-data' | relative_url }}#publications) and the [Books manual]({{ '/user-manual/sites/publications' | relative_url }}).
