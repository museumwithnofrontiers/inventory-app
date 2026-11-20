---
layout: default
title: Extra census
parent: Database Models
nav_order: 90
---

# Extra census

Several tables keep content the model has no column for in an `extra` JSON column. Milestone M16 ("Model: retire extra") gives that content a proper home. The census measures how much is left.

```bash
php artisan inventory:extra-census            # a table per table, keys by count
php artisan inventory:extra-census --json     # the same as JSON
php artisan inventory:extra-census --expect docs/models/extra-census-m16-epic-i.json
```

- The tables come from the schema: every table with an `extra` column is measured.
- A row counts when its `extra` holds something. `null`, `{}` and `[]` don't count.
- Keys are the top-level keys of the JSON object. An `extra` that is a JSON list counts under `(list)`, and a bare value under `(scalar)`.
- `item_translations` is also counted per item type (object, monument, detail, picture), under `by_item_type`.
- The command only reads.

## Baseline

[`extra-census-2026-11-18.json`](extra-census-2026-11-18.json) is the census on staging after reimport 16: **72,145 rows** with `extra`. Compare a later run with it to see what a story absorbed.

## Expectations

`--expect <file>` takes a JSON file of the same shape as `--json` and treats every key it lists as a ceiling. The command fails when a key is on more rows than that, and `0` means the key must be gone:

```json
{
  "tables": {
    "collection_item": { "keys": { "mn_order": 0 } }
  }
}
```

Keys the file doesn't list are not checked.

[`extra-census-m16-epic-i.json`](extra-census-m16-epic-i.json) holds what M16's Epic I removed: the keys it took out are at 0, and the 302 Travels `prepared_by` texts that stay as written (role labels, or a name an existing author spells with other accents) are the ceiling for that key. I5 added the eight collection credits of `collection_translations`, at 0: they are Contributors now.

[`extra-census-m16.json`](extra-census-m16.json) is the running expectation for the whole milestone: Epic I's keys, plus each later story's. B1 (#2635) puts `materials`, `description2`, `dynasty`, `province` and `history` of `item_translations` at 0: they are columns now. B4 (#2638) puts `credits_as_written` and `prepared_by` at 0: the credits as written are the four `*_credit` columns. B2 (#2636) and B3 (#2637) put `keywords` and the artist, workshop, scribe, patron and architect keys at 0: the lines are columns, as written. B5 (#2639) and B6 (#2640) put `linkcatalogs`, `notice`, `notice_c` and `legacy_display_status` at 0: the references and notices are columns, as written, and the flag is the `status` column. C1 (#2641) puts `n`, `n2`, `parent_n2`, `detail_n`, `curator_status` and `picture` of `collection_item` at 0: the placement's columns hold them, and `n` and `detail_n` carried nothing of their own. C2 (#2642) puts the placement texts of `collection_item` at 0 (`detail_name`, `contextual_descriptions`, `detail_justification`, `justifications`, `image_captions`, `item_name`, `item_date`, `item_location`, `item_museum` and `source_bc_by_language`): they are the placement translations' columns, one row per placement and language, and each theme text's legacy key is its `backward_compatibility`. C3 (#2643) puts `item_dynasty`, `item_artist` and `item_material` at 0 the same way: like the other caption keys, they are the placement's own caption, not the item's text in that context. C4 (#2644) puts Explore's keys of `collection_item` at 0 (`explore_monument_ids`, `explore_geo`, `explore_museums`, `explore_monument_id`, `location_id`, `desc_types`, `tr_mn_desc`, `explore_mn_desc`, `vm_mn_desc`): each Explore monument a placement stands for is a row of the placement (`collection_item_explore_monuments`), with its coordinates, museums, location and legacy's description references, as written. Only `membership` (58 gallery placements) stays on `collection_item`. D1 (#2645) puts the visit keys at 0: `how_to_reach`, `info`, `contact` and `monument_contact` of `item_translations`, `how_to_reach`, `info` and `contact` of `collection_translations`, `how_to_reach` and `opening_hours` of `partner_translations`. They are the `visit_information` model now; a collection's `contacts` list (1 row) stays. D1 (#2645) puts the visit keys at 0: `how_to_reach`, `info`, `contact` and `monument_contact` of `item_translations`, `how_to_reach`, `info` and `contact` of `collection_translations`, `how_to_reach` and `opening_hours` of `partner_translations`. They are the `visit_information` model now; a collection's `contacts` list (1 row) stays. D2 (#2646) puts `contact_person_1`, `contact_person_2`, `partner_category`, `portal_display`, `city` and `ex_name` of `partner_translations` at 0: the contacts are `partner_contacts`, the category, Portal flag and city are columns of `partners`, the other name is `also_known_as`; only `region`, `region_id` and `ex_description` stay. B7 (#2690) puts `copyright`, `photographer`, `legacy_type`, `third_name`, `archival` and `holding_institution_org` of `item_translations` at 0: per-language picture credits are image translations, `legacy_type` repeated the image-type tag, and the Sharing History texts are columns. E1 (#2647) puts `subtitle`, `intro_text`, `introduction` and `duration` of `collection_translations` at 0: they are the `subtitle`, `introduction` and `duration` columns. The collection and timeline `bibliography` stays in `extra` (ceilings 13 and 16): it is a list of entries per language, like the items' `structured_bibliography`, and joining the entries into one text would merge legacy fields. A structured home, if ever wanted, is one story for items, collections and timelines together, outside M16. F2 (#2652) puts `image_captions`, `map_descriptions` and `cover_images` of `collection_translations` at 0: the captions are ImageTranslations of the images they describe, found by legacy key, and the cover caption is the `cover_caption` column. F1 (#2651) puts the pictures' `photographer` and `copyright` on their image rows (`photographer`, `credit`), and `partner_images` and `publication_images` `photographer` at 0. Its two `item_translations` ceilings are what stays: the 341 photographer and 2,622 copyright texts of pictures whose language rows don't all carry the same text, kept until reviewed and listed in [`m16-f1-picture-texts-by-language.csv`](m16-f1-picture-texts-by-language.csv) (the image takes the English text, or none where the English row has none: 20 photographers and 123 copyrights), kept until reviewed, while the 785 objects' and monuments' `copyright`, the sheet's own rights line and not a picture's, is their translations' `image_rights` column. E3 (#2649) puts the Explore id lists of `collection_translations` (`country_ids`, `location_ids`, `territory_ids`, `theme_ids`, `additional_regions`) and `historical_background`, `thg_theme` and `days` of `collections` at 0: they are relations and columns now, each id resolved by its legacy key. E4a (#2650) puts `legacy_status` and the codes nothing read (`introd_type`, `et_title`, `et_introduction`, `showOnMonument`, `hb_type`, `hb_general_type`, `territory_level`) of `collection_translations` at 0: the status is `collections.visible`, with the exhibition show flag, and a gallery's featured flag and live date are `featured` and `published_at`. `further_readings` of `collections` stays (ceiling 3): bibliography entries with no URL, a list like `bibliography`. E4b (#2673) puts the site configuration at 0: `thg_gallery`, `thg_gallery_lang`, `legacy_exhibition` and `exhibition_i18n` of `collection_translations`, and `thg_gallery`, `logos`, `explore_home`, `explore_travel` and `explore_itinerary` of `collections`. It lives in the instance files now, written from legacy by the importer's `site-config` command. F3 (#2653) puts `catalogue_holding_link`, the partner translations' `urls` and the publication editions' `shop_links` at 0: they are Links. Its `external_sources` is at 0 too: a display column, as written, with no Link derived from it. The Explore monuments' `further_readings` of `item_translations` stays (ceiling 42): its 73 PDFs, on 42 translations, are missing on legacy (empty folders on legacy's share), so there is no file to make an ItemDocument from. They are listed in [`m16-f3-further-readings-missing-on-legacy.csv`](m16-f3-further-readings-missing-on-legacy.csv). ItemMedia and CollectionMedia became Links too, so `collection_media` is gone and its legacy keys sit on `links`.
