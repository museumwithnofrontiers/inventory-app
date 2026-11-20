# Register of `extra` keys

The importer writes into an `extra` JSON column only legacy data the inventory
model has no field for, so that nothing is lost in the import. `extra` is a
holding area, not a second schema: every key below is to be reviewed. A review
moves the data into the model, keeps it with the reason recorded here, or drops
it.

Rules for a change to the importer:

- Look for a model field first. Never put runtime data, site-specific data or
  site configuration in the inventory: those belong to the sites.
- Never merge two legacy fields into one, in `extra` or anywhere else. Each
  legacy column keeps its own key, named after the column.
- A pull request that adds, renames or removes a key updates this register.

Paths are relative to `src/`; `T:` is `domain/transformers/`.

## item_translations.extra

These keys are written here first, then moved to columns of their own by
`importers/phase-11/item-translation-columns-importer.ts`, the text as written:
- M16 B1 (#2635): `materials` → `materials`, `description2` → `short_description`, `dynasty` → `dynasty`,
  `province` → `region`, `history` → `history`;
- M16 B4 (#2638): `credits_as_written.{author, copy_editor, translator, translation_copy_editor}` →
  `author_credit`, `copy_editor_credit`, `translator_credit`, `translation_copy_editor_credit`; and the
  Explore and Travels `prepared_by` → `author_credit`;
- M16 B2 (#2636), B3 (#2637): `keywords`, `artist`, `period_activity` → `artist_period_of_activity`,
  `artist_birthdate` → `artist_birth_date`, `artist_birthplace` → `artist_birth_place`,
  `artist_deathdate` → `artist_death_date`, `artist_deathplace` → `artist_death_place`, `workshop`,
  `scriber` → `scribe`, `patrons`, `architects`. They are display texts: the keyword Tags and the
  Artist links the object importers create stay as they are, and nothing is derived from the texts.
- M16 B5 (#2639), B6 (#2640): `linkcatalogs` → `catalogue_references` (codes and citations as written; the Book
  links come from the codes, separately), the Sharing History `notice` → `notice` and `notice_c` →
  `external_notice`, as written; and `legacy_display_status` N → `status` = `hidden`, a flag, not a text.
- M16 B7 (#2690): Sharing History's `third_name` → `original_name` (the name in the item's original language),
  `archival` → `archival_reference`, `holding_institution_org` → `holder_original_name` (the holding institution's
  own-language name, next to `holder`), as written.

The pictures' `photographer` and `copyright` (M16 F1, #2651) move to the picture's image row instead, by
`importers/phase-11/picture-credits-importer.ts`:
- `photographer` → `item_images.photographer`.
- `copyright` → `item_images.credit`, where the burned `copyright` can't give it back: ISL and IAM pictures, which burn
  their project's line, and texts legacy wrote with the mark.
- Where every row of the picture carries the same text, the image row holds it.
- Where the rows differ or some have none (M16 B7, #2690), the image takes the default language's text. Each language
  legacy wrote a text for keeps it on the image's translation row (`image_translations.copyright` /
  `photographer`, `image_type` `item_image`), as written, and a language legacy left empty stays empty.
- The parent object's or monument's copy of the image takes the same values.

The same step drops `legacy_type` (`plan`, `security`) where the picture carries the same `image-type` tag, which the
picture importers write next to it (M16 B7). One without the tag stays and is reported.

None stays after a full import. After re-running one of their writers on its own, run `--only item-translation-columns` again. The exporters give the keys back to the packages
(`scripts/exporters/shared/item-columns.mjs`); the two lists in `utils/item-translation-columns.ts` and
that module stay equal.

| Key                                                                                                                                                                                          | Legacy source                                                                                                                                            | Written by                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `province`                                                                                                                                                                                   | mwnf3.objects.province                                                                                                                                   | T:object-transformer.ts                                                                          |
| `credits_as_written.{author, copy_editor, translator, translation_copy_editor}`                                                                                                              | preparedby, copyeditedby, translationby, translationcopyeditedby (mwnf3 objects and monuments, sh_objects_texts, sh_monuments_texts)                     | T:credits-as-written.ts                                                                          |
| `artist`                                                                                                                                                                                     | objects, monument_details, sh_objects_texts, sh_monument_detail_texts                                                                                    | T:object, monument-detail, sh-object, sh-monument-detail                                         |
| `workshop`                                                                                                                                                                                   | objects, sh_objects_texts                                                                                                                                | T:object, sh-object                                                                              |
| `copyright` (→ `image_rights`, F1)                                                                                                                                                         | `copyright`, else `notice_b` (objects, monuments, sh_objects_texts, sh_monuments_texts)                                                                  | T:object, monument, sh-object, sh-monument                                                       |
| `binding_desc`, `catalogue_holding_link` (→ the item's `catalogue` link, F3 #2653), `scriber`                                                                                                                                          | objects                                                                                                                                                  | T:object                                                                                         |
| `linkcatalogs`                                                                                                                                                                               | objects, monuments, sh_objects_texts, sh_monuments_texts                                                                                                 | T:object, monument, sh-object, sh-monument                                                       |
| `dynasty`                                                                                                                                                                                    | objects, monuments, sh_objects_texts, sh_monuments_texts; for a custom exhibition picture, exhibition_page_images_fields `item_dynasty`                  | T:object, monument, sh-object, sh-monument; importers/phase-01/mwnf3-exhibition-item-importer.ts |
| `materials`                                                                                                                                                                                  | objects, sh_objects_texts                                                                                                                                | T:object, sh-object                                                                              |
| `keywords`                                                                                                                                                                                   | objects, monuments, sh_objects_texts, sh_monuments_texts                                                                                                 | T:object, monument, sh-text-fields                                                               |
| `artist_birthdate`, `artist_birthplace`, `artist_deathdate`, `artist_deathplace`, `period_activity`                                                                                          | birthdate, birthplace, deathdate, deathplace, period_activity (objects, sh_objects_texts)                                                                | T:object, sh-object                                                                              |
| `external_sources` (→ `external_sources` column, F3)                                                                                                                                   | monuments, sh_monuments_texts                                                                                                                            | T:monument, sh-monument                                                                          |
| `monument_contact.{address, phone, fax, email, institution}`                                                                                                                                 | mwnf3.monuments                                                                                                                                          | T:monument                                                                                       |
| `monument_contact.{address, phone, fax, email, responsible_institution}`                                                                                                                     | sh_monuments_texts                                                                                                                                       | T:sh-monument                                                                                    |
| `patrons`, `architects`, `history`                                                                                                                                                           | monuments, sh_monuments_texts                                                                                                                            | T:monument, sh-monument                                                                          |
| `description2`, `second_name`, `third_name`                                                                                                                                                  | sh_objects_texts, sh_monuments_texts                                                                                                                     | T:sh-object, sh-monument                                                                         |
| `archival`, `dimensions`, `period_activity`, `production_place`, `holding_institution_org`                                                                                                   | sh_objects_texts                                                                                                                                         | T:sh-object                                                                                      |
| `datation_method`                                                                                                                                                                            | datationmethod (sh_objects_texts, sh_monuments_texts)                                                                                                    | T:sh-object, sh-monument                                                                         |
| `provenance_method`, `obtention_method`                                                                                                                                                      | provenancemethod, obtentionmethod (sh_objects_texts)                                                                                                     | T:sh-object                                                                                      |
| `notice`, `notice_c`                                                                                                                                                                         | sh_objects_texts, sh_monuments_texts                                                                                                                     | T:sh-object, sh-monument                                                                         |
| `responsible_institution_org`                                                                                                                                                                | sh_monuments_texts                                                                                                                                       | T:sh-monument                                                                                    |
| `country_id_present_days`                                                                                                                                                                    | pd_country (sh_objects, sh_monuments), as an ISO code                                                                                                    | T:sh-object, sh-monument                                                                         |
| `date`, `location`                                                                                                                                                                           | sh_monument_detail_texts                                                                                                                                 | T:sh-monument-detail                                                                             |
| `legacy_type`                                                                                                                                                                                | the picture tables' `type` (objects_pictures, monuments_pictures, sh_object_images, sh_monument_images, exploremonument_pictures, tr_monuments_pictures) | the picture importers of phases 02, 03, 06, 07                                                   |
| `photographer`, `copyright`                                                                                                                                                                  | the picture text rows of the tables above                                                                                                                | the picture importers of phases 02, 03, 06, 07                                                   |
| `structured_bibliography`, `disabled_structured_bibliography`                                                                                                                                | rel_sh_bibliography_objects, rel_sh_bibliography_monuments, sh_bibliography, sh_bibliography_langs                                                       | importers/phase-03/sh-bibliography-hb-importer.ts                                                |
| `legacy_display_status`                                                                                                                                                                      | display_status (sh_objects, sh_monuments)                                                                                                                | importers/phase-11/sh-item-display-status-importer.ts                                            |
| `prepared_by`, `how_to_reach`, `info`, `contact`, `history`, `note`, `abstract` (column `abstratc`), `further_reading` (column `furtherreading`), `url_prog_pdf`, `pdf_text`, `url_prog_doc` | mwnf3_explore.exploremonumentext                                                                                                                         | importers/phase-06/explore-monument-translation-importer.ts                                      |
| `monument_contact.{institution, address, phone, fax, email, website}`                                                                                                                        | exploremonumentext (`website` is `url`)                                                                                                                  | importers/phase-06/explore-monument-translation-importer.ts                                      |
| `further_readings[].{title, abstract, file_details, url}`                                                                                                                                    | exploremonument_further_reading. Stays (M16 F3): its PDFs are missing on legacy, listed in docs/models/m16-f3-further-readings-missing-on-legacy.csv | importers/phase-06/explore-monument-translation-importer.ts                                      |
| `additional_explore_partners[]`                                                                                                                                                              | exploremonument_museums                                                                                                                                  | importers/phase-06/explore-monument-crossref-importer.ts                                         |
| `how_to_reach`, `info`, `contact`, `prepared_by`                                                                                                                                             | mwnf3_travels.tr_monuments                                                                                                                               | importers/phase-07/travels-monument-translation-importer.ts                                      |

## collection_translations.extra

The collection credits below (`author`, `travels_author`, `prepared_by`, `curated_by`, `credits`,
`local_coordinator`, `local_team`, `photo_by`) are written here first, then moved to Contributors of the
collection by `importers/phase-11/collection-credits-importer.ts` (M16 I5, #2648), the key as the
Contributor's `category` and the text as written in its translation. None stays after a full import. After
re-running one of their writers on its own, run `--only collection-credits` again. The exporters give the
keys back to the packages (`scripts/exporters/shared/credits.mjs`).

Four texts below are written here first, then moved to columns of their own by
`importers/phase-11/collection-translation-columns-importer.ts` (M16 E1, #2647), the text as written:
`subtitle` → `subtitle`, `intro_text` (mwnf3) and `introduction` (Travels) → `introduction`, `duration` →
`duration`. None stays after a full import. After re-running one of their writers on its own, run
`--only collection-translation-columns` again. The exporters give the keys back to the packages
(`scripts/exporters/shared/collection-columns.mjs`); the two lists in
`utils/collection-translation-columns.ts` and that module stay equal.

The Explore id lists below (`country_ids`, `location_ids`, `territory_ids`, `theme_ids`,
`additional_regions`), on a collection's English text in its own context, are moved to the model by
`importers/phase-11/collection-relations-importer.ts` (M16 E3, #2649), each id resolved by its legacy key:
`collection_country`, and `collection_collection` by kind, in legacy's order. A list holding an alias country
code (`ix`, `px`) or an id that resolves to nothing stays, reported. After re-running one of their writers on
its own, run `--only collection-relations` again. The exporters give the keys back
(`scripts/exporters/shared/collection-relations.mjs`, `country-codes.mjs`).

The editorial flags below move to `collections` columns by `importers/phase-11/collection-flags-importer.ts`
(M16 E4a, #2650, decision 6): `legacy_exhibition.show` and `legacy_status` → `visible`, `thg_gallery.featured`
(`A`/`H`) → `featured`, `thg_gallery.live_date` → `published_at`. A flag stays when the translations of its
collection disagree. The same step drops the legacy codes nothing reads: `introd_type`, `et_title`,
`et_introduction`, `showOnMonument`, `hb_type`, `hb_general_type`, `territory_level`. Run `--only
collection-flags` again after re-running one of their writers on its own. The exporters give the flags back
(`scripts/exporters/shared/collection-flags.mjs`).

`thg_gallery`, `thg_gallery_lang`, `legacy_exhibition` and `exhibition_i18n` below, and `thg_gallery`,
`logos`, `explore_home`, `explore_travel` and `explore_itinerary` on `collections.extra`, are site
configuration (M16 E4b, #2673, decision 6). They live in the instance files
(`scripts/exporters/instances/*.json`, each file's `collections`), not in the inventory:
`importers/phase-11/site-configuration-out-importer.ts` removes them from `extra`, and the exporters read
them back from the instance files (`scripts/exporters/shared/site-configuration.mjs`). The importers that
wrote them build them for the `site-config` command instead, which reads legacy alone (SELECT only) and
writes the instance files; it is not part of `import`. Re-run it when legacy's gallery, exhibition or
Explore tables change, and review the change as a diff of the instance files:

```sh
npx tsx src/cli/import.ts site-config          # writes ../exporters/instances
npx tsx src/cli/import.ts site-config --check  # compares with an inventory imported before E4b
```

It refuses a local copy of legacy (a gallery host that is no public https museumwnf address) and a
collection no instance file takes.

| Key                                                                                                                                                                                                          | Legacy source                                                                                  | Written by                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `credits`, `intro_header`, `intro_text`, `subtitle`                                                                                                                                                          | mwnf3 exhibition_fields `exh_*`, artintro_fields `art_*`                                       | importers/phase-01/mwnf3-exhibition-translation-importer.ts                                                |
| `subtitle`                                                                                                                                                                                                   | theme_subtitle (exhibition_theme_fields, artintro_theme_fields)                                | importers/phase-01/mwnf3-exhibition-translation-importer.ts                                                |
| `legacy_exhibition.{project_id, display_order, show, new_status, portal_image, exh_link}`                                                                                                                    | mwnf3.exhibitions (`display_order` is `n`)                                                     | importers/phase-01/mwnf3-exhibition-translation-importer.ts                                                |
| `legacy_exhibition.{project_id, show, new_status}`                                                                                                                                                           | sh_exhibitions                                                                                 | importers/phase-11/sh-exhibition-show-flag-importer.ts                                                     |
| `subtitle`, `curated_by`, `cover_images` (→ `cover_caption`, F2), `further_reading`, `see_also_links`                                                                                                                                | sh_exhibitionnames                                                                             | importers/phase-03/sh-exhibition-translation-importer.ts                                                   |
| `further_reading`, `see_also_links`                                                                                                                                                                          | sh_exhibition_themenames, sh_exhibition_subthemenames                                          | importers/phase-03/sh-exhibition-translation-importer.ts                                                   |
| `bibliography`, `disabled_bibliography`                                                                                                                                                                      | rel_sh_bibliography_exhibition, rel_sh_bibliography_hb, sh_bibliography, sh_bibliography_langs | importers/phase-03/sh-bibliography-hb-importer.ts                                                          |
| `hb_type`                                                                                                                                                                                                    | sh_countries_historicalbackground.gn                                                           | importers/phase-03/sh-bibliography-hb-importer.ts                                                          |
| `remark`                                                                                                                                                                                                     | sh_countries_historicalbackground_pages                                                        | importers/phase-03/sh-bibliography-hb-importer.ts                                                          |
| `image_captions.{image}.{lang}.{name, sname, name_detail, date, dynasty, museum, location, artist, material}` (→ the image's ImageTranslations, F2; a caption with another field, or whose image isn't found, stays)                                                                                                | sh_countries_historicalbackground_image_texts                                                  | importers/phase-03/sh-bibliography-hb-importer.ts                                                          |
| `map_descriptions.map_{id}.{lang}` (→ the map image's ImageTranslation `caption`, F2)                                                                                                                                                                           | sh_countries_historicalbackground_maps_texts.desc                                              | importers/phase-03/sh-bibliography-hb-importer.ts                                                          |
| `hb_general_type` (a constant per source table)                                                                                                                                                              | sh_project_about_historical_background, sh_project_about_topics                                | importers/phase-11/sh-hb-general-importer.ts                                                               |
| `duration`, `local_team`, `author`, `introd_type`, `et_title` (column `et_short_introduction`), `et_introduction` (column `et_long_introduction`)                                                            | explore_itineraries_langs                                                                      | importers/phase-06/explore-itinerary-content-importer.ts                                                   |
| `travels_author` (only when the description is a Travels itinerary's; `''` when it names none)                                                                                                               | mwnf3_travels.tr_itineraries.author                                                            | importers/phase-06/explore-itinerary-content-importer.ts                                                   |
| `location_ids`, `country_ids`, `territory_ids`                                                                                                                                                               | explore_itineraries_rel_locations, _rel_country, _rel_territory                                | importers/phase-06/explore-itinerary-content-importer.ts                                                   |
| `territory_level`, `theme_ids`                                                                                                                                                                               | regions.type, regionsthemes.themeId                                                            | importers/phase-06/explore-region-importer.ts                                                              |
| `additional_regions`                                                                                                                                                                                         | regionlocations, regions.type                                                                  | importers/phase-06/explore-region-location-linker.ts                                                       |
| `how_to_reach`, `info`, `contact`, `description_1`, `prepared_by`, `showOnMonument`                                                                                                                          | locationtranslated, explorelocation                                                            | importers/phase-06/explore-location-translation-importer.ts                                                |
| `contacts[].{name, address, phone, fax, email, website}`                                                                                                                                                     | locations_contact                                                                              | importers/phase-06/explore-location-translation-importer.ts                                                |
| `legacy_status`                                                                                                                                                                                              | thematiccycle.status                                                                           | importers/phase-06/explore-thematiccycle-importer.ts                                                       |
| `country_ids`, `country_texts[].{countryId, langId, text}`                                                                                                                                                   | thematiccyclecountries, thematiccycle_country_texts                                            | importers/phase-06/explore-thematiccycle-translation-importer.ts                                           |
| `author`, `about`, `prepared_by`                                                                                                                                                                             | mwnf3_travels.tr_locations                                                                     | importers/phase-07/travels-location-translation-importer.ts                                                |
| `subtitle`, `curated_by`, `local_coordinator`, `photo_by`, `region_territory`                                                                                                                                | mwnf3_travels.trails                                                                           | importers/phase-07/travels-trail-translation-importer.ts                                                   |
| `description_2` (column `description2`), `author`, `introduction`, `prepared_by`                                                                                                                             | mwnf3_travels.tr_itineraries                                                                   | importers/phase-07/travels-itinerary-translation-importer.ts                                               |
| `thg_gallery.{image, banner_image, banner_item, new_expire_date, landing_url, portal_image, live_date, homepage_image, homepage_item, has_timeline, has_country_timeline, featured, link, mwnf3_project_id}` | thg_gallery                                                                                    | importers/phase-10/thg-gallery-lang-importer.ts, thg-gallery-translation-importer.ts                       |
| `thg_gallery_lang.{mouse_over_text, keywords}`                                                                                                                                                               | thg_gallery_lang                                                                               | importers/phase-10/thg-gallery-lang-importer.ts                                                            |
| `exhibition_i18n.{enabled, subtitle, heading, about, exh_img_caption, popup_logo_show, popup_logo}`                                                                                                          | exhibition_i18n                                                                                | importers/phase-10/thg-gallery-translation-importer.ts                                                     |

## collections.extra

`historical_background`, `thg_theme.cover_picture` and `days` below are moved by the same step (M16 E3,
#2649): to `collection_collection` (kind `historical_background`), `cover_item_id` and `days`. `logos`,
`thg_gallery`, `explore_*`: see above (E4b).

| Key                                                                                                         | Legacy source                                                                                                                                      | Written by                                                  |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `thg_gallery.{mwnf3_project_id, slug, host, i18n_group_id, i18n_common_group_id}`                           | thg_gallery (`slug` is `link`), thg_gallery_url                                                                                                    | importers/phase-10/thg-gallery-importer.ts                  |
| `thg_gallery.hidden_partners[]`                                                                             | exhibition_hidden_mwnf3_museums                                                                                                                    | importers/phase-10/thg-hidden-museum-importer.ts            |
| `thg_theme.cover_picture`                                                                                   | theme_cover_image, theme_item                                                                                                                      | importers/phase-10/thg-theme-cover-image-importer.ts        |
| `further_readings[]`                                                                                        | exhibition_related_content(_i18n) with no link and no document                                                                                     | importers/phase-10/thg-gallery-content-importer.ts          |
| `logos[].{file, link, category_id, category_name, visible, labels, alts, further_readings, display_order}`  | exhibition_logo, _category, _i18n                                                                                                                  | importers/phase-10/thg-gallery-content-importer.ts          |
| `logos[].{file, link, display_order}`                                                                       | sh_exhibitions logo1..3 with url1..3                                                                                                               | importers/phase-03/sh-exhibition-image-importer.ts          |
| `explore_itinerary.{type, order, location_home_link, countries[]}`                                          | explore_itineraries                                                                                                                                | importers/phase-06/explore-itinerary-importer.ts            |
| `explore_home.banners[]`, `explore_home.featured_partnerships[]`                                            | explore_home_banners, featured_partnerships(_langs)                                                                                                | importers/phase-06/explore-home-importer.ts                 |
| `explore_travel.{books, tours, accommodations, accommodation_categories, guided_visits, useful_websites}[]` | featured_books_explore, featured_tours_explore, accommodation_hotels(_langs), accommodation_types, guided_visits_contacts(_langs), useful_websites | importers/phase-06/explore-travel-importer.ts               |
| `historical_background[]`                                                                                   | locations.et_loc_introduction, tr_locations, locationtranslated                                                                                    | importers/phase-06/explore-location-translation-importer.ts |
| `days`                                                                                                      | mwnf3_travels.tr_itineraries                                                                                                                       | importers/phase-07/travels-itinerary-importer.ts            |

## collection_item.extra

A row is a placement: an item on a collection, with its own UUID `id` (M16 C1, #2641). Six keys below are
written here first, then moved to the placement's columns, or dropped, by
`importers/phase-11/collection-item-columns-importer.ts`:
- `n2` → `variant_order` and `parent_n2` → `parent_variant_order`, as written: positions, not links,
  since some detail views have no parent placement;
- `curator_status` Y/N → `curator_selected` true/false; absent stays NULL;
- `picture` (a legacy path) → `picture_item_id`, the placed item's picture whose image has that original name;
- `n` is dropped: it equals `display_order`. `detail_n` is dropped: it is always 1.

A value the step can't place (an `n` that differs from `display_order`, a `detail_n` other than 1, a
`curator_status` other than Y or N, a `picture` that resolves to no picture or to more than one) stays here and
is reported. None stays after a full import. After re-running one of their writers on its own, run
`--only collection-item-columns` again. The exporters read the columns themselves.

A placement's texts are its own, per language (M16 C2, #2642; decision 4 (a)): the same item on two themes
keeps two descriptions and two captions. They are written here first, then moved to the placement
translations, `collection_item_translations`, one row per placement and language, by
`importers/phase-11/collection-item-translations-importer.ts`. Each key goes to one column, as written:
- `detail_name` → `title`; `image_captions` → `caption`;
- `contextual_descriptions` (thematic gallery themes, Travels trails) or `detail_justification` (mwnf3
  exhibition pages) → `description`. A placement has one or the other; an mwnf3 collection's is
  `detail_justification`, and a placement where that doesn't hold keeps the key here;
- `justifications`: `{curator, partner}` → `curator_justification` and `partner_justification`, JSON nulls
  included; the National Context's single text → `justification`;
- `item_name`, `item_date`, `item_location`, `item_museum`, and `item_dynasty`, `item_artist`, `item_material`
  (C3, #2643) → the columns of the same name: the item's caption on that page, as written (decision 1 (a));
- `source_bc_by_language` → `backward_compatibility`: each theme text's own legacy key (ADR 006 rule 3).

A key of another shape stays here and is reported. None stays after a full import. After re-running one of their
writers on its own, run `--only collection-item-translations` again. The exporters put the keys back
(`scripts/exporters/shared/placement-translations.mjs`), so the packages are unchanged.

Explore lists its monuments by its own ids, which the model doesn't hold (M16 C4, #2644): one placed item can
stand for several, and an Explore monument merged into another record has no item of its own. So each Explore
monument a placement stands for is a row of the placement, `collection_item_explore_monuments`, written here
first, then moved by `importers/phase-11/collection-item-explore-monuments-importer.ts`, as written:
- on an Explore location: `explore_monument_ids` → one row per id, in order (`position`), its legacy key
  `mwnf3_explore:monument:<id>`; `explore_geo` → its `latitude`, `longitude`, `map_zoom`; `explore_museums` →
  its partners, resolved by legacy key;
- on an Explore itinerary: `explore_monument_id` → one row; `location_id` → its `location_collection_id`,
  resolved by legacy key; `desc_types`, `tr_mn_desc`, `explore_mn_desc`, `vm_mn_desc` → `description_types`,
  `travels_description_ref`, `explore_description_ref`, `virtual_museum_description_ref`: legacy's references
  to the texts it showed. No exporter or site reads these four today; they are kept so nothing is lost.

A placement whose keys have another shape, or whose location or museum doesn't resolve, keeps them all here,
reported. After re-running an Explore importer on its own, run `--only collection-item-explore-monuments`
again. The exporters put the keys back (`scripts/exporters/shared/explore-monuments.mjs`).

| Key                                                                                                                                                                                                              | Legacy source                                                                        | Written by                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `n`, `n2`                                                                                                                                                                                                        | exhibition_page_images, exhibition_images, artintro_page_images                      | importers/phase-01/mwnf3-exhibition-item-importer.ts                                                      |
| one key per EAV field (`detail_name`, `detail_justification`, `item_artist`, `item_date`, `item_description`, `item_dynasty`, `item_location`, `item_material`, `item_museum`, `item_name`), each `{lang: text}` | exhibition_page_images_fields, exhibition_images_fields, artintro_page_images_fields | importers/phase-01/mwnf3-exhibition-item-importer.ts                                                      |
| `details[].{n, n2, ref_detail_item, picture_details, EAV fields}`                                                                                                                                                | exhibition_page_image_details(_fields)                                               | importers/phase-01/mwnf3-exhibition-item-importer.ts                                                      |
| `justifications.{lang}.{partner, curator}`, `curator_status`                                                                                                                                                     | rel_{objects,monuments}_{exhibitions,themes,subthemes}(_justification)               | importers/phase-03/sh-exhibition-item-importer.ts, phase-11/sh-exhibition-item-justifications-importer.ts |
| `source_image_id`, `source_image_item`, `justifications.{lang}`                                                                                                                                                  | sh_national_context_exhibition_images, rel_*_nc_exhibition_justifications            | importers/phase-03/sh-national-context-importer.ts                                                        |
| `picture`                                                                                                                                                                                                        | sh_countries_historicalbackground_images                                             | importers/phase-03/sh-bibliography-hb-importer.ts                                                         |
| `explore_monument_id` (column `momument_id`), `location_id`, `mn_order`, `desc_types`, `explore_mn_desc`, `tr_mn_desc`, `vm_mn_desc`                                                                             | explore_itineraries_rel_monuments                                                    | importers/phase-06/explore-itinerary-content-importer.ts                                                  |
| `explore_monument_ids[]`, `explore_geo`, `explore_museums`                                                                                                                                                       | exploremonument, exploremonument_museums                                             | importers/phase-06/explore-monument-importer.ts                                                           |
| `contextual_descriptions`, `image_captions`, `source_bc_by_language`                                                                                                                                             | theme_item_i18n                                                                      | importers/phase-10/thg-theme-item-translation-importer.ts                                                 |
| `membership` (a constant)                                                                                                                                                                                        | thg_gallery.mwnf3_project_id                                                         | importers/phase-10/thg-gallery-native-project-importer.ts                                                 |
| `contextual_descriptions` (`{language id: text}`)                                                                                                                                                                | objects_trails_justification                                                         | importers/phase-07/travels-trail-entry-importer.ts                                                        |

## Partner fields (M16 D2, #2646)

The partner importers (museums, institutions, schools, Sharing History) write these keys into every translation
of a partner first. `importers/phase-11/partner-columns-importer.ts` then moves them, one partner at a time, only
where all of the partner's translations agree:

| Key | Goes to |
| --- | --- |
| `contact_person_1`, `contact_person_2` (`name`, `title`, `email`, `phone`, `fax`) | `partner_contacts`, display order 1 and 2, as written |
| `partner_category` (Sharing History) | `partners.category`, one of six values; the one `Museums` joins `museums` |
| `portal_display` (`y`/`n`) | `partners.featured` |
| `city` (Sharing History) | `partners.city`, as written |
| `ex_name` (per translation) | `partner_translations.also_known_as`, as written |

A value the translations disagree on, an unknown category or flag, and a contact with a field the model lacks all
stay here and are reported. What stays: `region`, `region_id` and `ex_description`, which no exporter reads (ADR 006
rule 5). After re-running one of the writers on its own, run `--only partner-columns` again. The exporters give the
keys back (`scripts/exporters/shared/partner-columns.mjs`).

## Visit information (M16 D1, #2645)

The visit keys of three translation tables are written into `extra` first, then moved to the shared
`visit_information` model, one row per owner, language and context, every text as written, by
`importers/phase-11/visit-information-importer.ts`:

| Table | Keys |
| --- | --- |
| `item_translations` (monuments: mwnf3, Travels, Explore) | `how_to_reach`, `info`, `contact`, `monument_contact.{address, institution, phone, fax, email, website}` |
| `collection_translations` (Explore locations) | `how_to_reach`, `info`, `contact` |
| `partner_translations` (mwnf3 museums) | `how_to_reach`, `opening_hours` |

- `info` goes to `practical_information` whole: it mixes opening hours, fees and access.
- `monument_contact.responsible_institution` (Sharing History, 38 rows) is dropped: it equals the row's own
  `responsible_institution_org` on every row, and the exporters restore it from there.
- A value that isn't a text, a `monument_contact` part with no field, and a responsible institution that differs
  all stay here and are reported.
- A collection's `contacts` list (`mwnf3_explore.locations_contact`, 1 row) stays: it is a list of entries, a
  one-off (ADR 006 rule 5).

None of the moved keys stays after a full import. After re-running one of their writers on its own, run
`--only visit-information` again. The exporters give the keys back (`scripts/exporters/shared/visit-information.mjs`,
through `item-columns.mjs`, `collection-columns.mjs` and the Explore and Travels partner exporters).

## Other tables

| Table                | Key                                                                                                                                                                                 | Legacy source                                                                  | Written by                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| partner_translations | `source`, `region_id`, `region`, `contact_person_1`, `contact_person_2`, `urls[]` (→ the partner's `website` links, F3)                                                                                                   | mwnf3.institutions, regionnames                                                | T:institution-transformer.ts                                                                                         |
| partner_translations | `source`, `postal_address`, `ex_name`, `ex_description`, `opening_hours`, `how_to_reach`, `region_id`, `region`, `portal_display`, `contact_person_1`, `contact_person_2`, `urls[]` (→ the partner's `website` links, F3) | mwnf3.museums, museumnames, regionnames                                        | T:museum-transformer.ts                                                                                              |
| partner_translations | `source`, `postal_address`, `fax`, `region_id`, `region`, `contact_person_1`, `contact_person_2`                                                                                    | mwnf3.schools, regionnames                                                     | T:school-transformer.ts                                                                                              |
| partner_translations | `source`, `partner_category`, `contact_person_1`, `contact_person_2`, `urls[]` (→ the partner's `website` links, F3), `region_id`, `portal_display`                                                                       | sh_partners                                                                    | T:sh-partner-transformer.ts                                                                                          |
| partner_translations | `entity_country`, `contact_title`, `contact_name`, `contact_fax`, `further_reading`                                                                                                 | exhibition_partner_i18n                                                        | importers/phase-10/thg-gallery-content-importer.ts                                                                   |
| partner_images       | `copyright`, only where legacy wrote the mark itself (I4 #2659); `photographer` moves to its column (F1 #2651)                                                                                                                                                       | museums_pictures, institutions_pictures, schools_pictures, sh_partner_pictures | importers/phase-02/partner-picture-importer.ts, phase-01/school-importer.ts, phase-03/sh-partner-picture-importer.ts |
| links (collection)   | `overview_page` (a one-off: nothing reads it)                                                                                                                                                                     | theme_audio, theme_video                                                       | T:media-transformer.ts                                                                                               |
| links (collection)   | none: `authors`, `category_id`, `further_reading`, `entity_location`, `entity_country` and `type_resource` are Link columns (F3)                                                                                   | exhibition_related_content(_i18n)                                              | importers/phase-10/thg-gallery-content-importer.ts                                                                   |
| item_documents       | `img_count`                                                                                                                                                                         | sh_objects_document                                                            | T:media-transformer.ts                                                                                               |
| timeline_event_item  | `texts.{lang}.{name, sname, name_detail, detail_justification, date, dynasty, museum, location, artist, material}`                                                                  | sh_hcr_image_texts                                                             | importers/phase-05/timeline-importer.ts                                                                              |
| timelines            | `bibliography`, `disabled_bibliography`                                                                                                                                             | rel_sh_bibliography_hcr_country, sh_bibliography(_langs)                       | importers/phase-05/timeline-importer.ts                                                                              |

Image types are tags, not `extra`. The legacy picture type (`mwnf3.picture_type`) is an `image-type` tag:
- the monument pictures' `plan` and `security`, on the picture item;
- the Sharing History history-page images' `map`, on the collection image;
- since M16 B8 (#2691), the Travels trail pictures' `cover`, `map` and `title` (`tr_trails_pictures.type`) and the
  itinerary pictures' `sketch`, on their collection images
  (`importers/phase-07/travels-trail-picture-importer.ts`, `travels-itinerary-picture-importer.ts`).

## Publications (phase 12)

| Table                      | Key                                                                                                                                                                                                               | Legacy source                    | Written by                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------- |
| publications               | `region`, `date`, `legacy_category` (column `category`: mwnf / other)                                                                                                                                             | mwnf3.bookbase                   | importers/phase-12/publication-importer.ts          |
| publication_translations   | `remarks_1`, `remarks_2` (columns `remarks1`, `remarks2` of the reference edition)                                                                                                                                | mwnf3.books                      | importers/phase-12/publication-edition-importer.ts  |
| publication_editions       | `legacy_texts.{title, subtitle, description1, description2, author, photographer, local_coordinator, remarks1, remarks2}`: this edition's texts where they differ from its translation's reference edition (D-P9) | mwnf3.books                      | importers/phase-12/publication-edition-importer.ts  |
| publication_editions       | `shop_links[].{name, url}` (columns `get_from_name_01..10`, `get_from_url_01..10`; D-P8, never exported; → the edition's `shop` links, F3)                                                                                                          | mwnf3.books                      | importers/phase-12/publication-edition-importer.ts  |
| publication_item           | `linkcatalogs[]`: the catalogue codes, as legacy wrote them, that cite the publication                                                                                                                            | mwnf3.objects, mwnf3.monuments   | importers/phase-12/publication-relation-importer.ts |
| collections (Explore root) | `explore_travel.books[].publication_id`                                                                                                                                                                           | featured_books_explore.read_more | importers/phase-12/publication-relation-importer.ts |

## Found while building this register

To review with the keys above:

- Merged legacy fields, Explore's addresses among them, are registered in
  [MERGE.md](MERGE.md).
- Every language inside `extra`, as a key or a value, is a language id
  (`eng`, `swe`, `zho`), never a legacy code (#2394). That includes the SH
  bibliography maps, the SH and National Context justifications (an
  exhibition's `{lang: {partner, curator}}`, a National Context's
  `{lang: text}`), the mwnf3 placement fields, the SH image captions and map
  texts, and Explore's `country_texts[].langId`. A legacy code belongs only in
  `backward_compatibility`, where it is the legacy id. The exporters write the
  packages' legacy codes from the ids (`languages.backward_compatibility`).
- `monument_contact` has two shapes: `institution` (mwnf3) and
  `responsible_institution` (SH).
- `mwnf3-exhibition-importer.ts` builds an `extra` (`show`, `portal_image`,
  `exh_link`) that it never writes.
- `updateTimelineExtra` is documented as a merge but replaces the column.
- The picture importers' headers say `legacy_type` goes to the item's `extra`;
  it goes to the picture's `item_translations.extra`.
