# Register of merged legacy fields

The importer never merges two legacy fields into one. Each legacy column keeps
a field of its own, and a site composes the line its legacy page composed. A
merge is allowed only by an explicit exception from the project owner, and every
merge is recorded here, like the `extra` keys in [EXTRA.md](EXTRA.md).

Paths are relative to `src/`; `T:` is `domain/transformers/`.

## Accepted exceptions

| Merge                                                                            | Legacy source                    | Written by                                                  | Exception                                                                                                                                          |
| -------------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `monument_contact.address` (item_translations.extra) = street, then zip and city | mwnf3_explore.exploremonumentext | importers/phase-06/explore-monument-translation-importer.ts | 2026-10-29: Explore addresses. A monument contact has a single `address`, as mwnf3's and Sharing History's monuments have a single address column. |
| `contacts[].address` (collection_translations.extra) = street, then zip and city | mwnf3_explore.locations_contact  | importers/phase-06/explore-location-translation-importer.ts | The same Explore address, under the exception above.                                                                                               |

If the review of `extra` moves monument contacts into the model, note that
`partner_translations` keeps `address_line_1`, `postal_code` and `city_display`
apart.

## Composed, with every part kept

| Field                              | Composed from                                                                   | Written by              |
| ---------------------------------- | ------------------------------------------------------------------------------- | ----------------------- |
| `authors.name` and `internal_name` | firstname and lastname, else givenname. Each is also written to its own column. | T:author-transformer.ts |

## Merges to remove

No exception covers these. Each joins legacy columns into one description:

| Field                                                                    | Joined legacy columns                                                                                                                                  | Written by                                             |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| `partner_translations.description`                                       | sh_partners description, department, how_to_reach, opening_hours (adding the labels "Department:", "How to reach:", "Opening hours:")                  | T:sh-partner-transformer.ts                            |
| English `collection_translations.description` of an Explore location     | explorelocation description, how_to_reach, info, contact (adding "How to reach:", "Contact:"); replaced only when locationtranslated has a description | importers/phase-06/explore-location-importer.ts        |
| `collection_translations.description` of a thematic gallery              | thg_gallery_lang long_title, short_text                                                                                                                | importers/phase-10/thg-gallery-lang-importer.ts        |
| `collection_translations.description` of a thematic gallery's exhibition | exhibition_i18n subtitle, heading, about (each also in `extra.exhibition_i18n`)                                                                        | importers/phase-10/thg-gallery-translation-importer.ts |
| project `collection_translations.description`                            | thg_projects.name, " - ", thg_gallery.name or thg_gallery_lang.title                                                                                   | importers/phase-01/project-importer.ts                 |
