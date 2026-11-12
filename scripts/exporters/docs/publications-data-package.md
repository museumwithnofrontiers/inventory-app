# Publications data package — specification

Date: 2026-11-12 · Story [#2536](https://github.com/museumwithnofrontiers/inventory-app/issues/2536),
epic [#2514](https://github.com/museumwithnofrontiers/inventory-app/issues/2514) (M14).

One package, `@museumwnf/publications-data`, for one website: the
Publications site that replaces <https://books.museumwnf.org>. It is produced
by its own exporter, `scripts/exporters/publications`, driven by the
`standalone` instance file `instances/publications.json`. The model behind
it is part 2 of the M14 proposal ("Publications and Travels in the
Inventory", 2026-11-12); the decisions are on #2517.

## Scope

Publications is no project and no collection tree. The scope
(`src/core/scope.ts`) is:

- **every publication** (legacy `bookbase`), in display order;
- **the exhibition trails they accompany** (`publication_collection`);
- **as references only**, the items a publication catalogues
  (`publication_item`) and its trails' entries (the trails' own members).
  A publication reaches a trail entry through its trail: nothing derivable
  is stored twice, and nothing of the item's sheet is copied.

The editions legacy hides (`visible` false, D-P2) ship nowhere, nor do their
covers, pages and PDFs. The editions' shop links (`extra.shop_links`) are
never exported (D-P8).

## File layout

```
manifest.json
publications.json
editions.json
tags.json
references.json
trails.json
countries.json
languages.json
translations/
  publications.<lang>.json
  countries.<lang>.json
LICENSE.md
README.md
```

Translations keep the layout of every package, `translations/<entity>.<lang>.json`.

## manifest.json

- `kind: "publications"`, `rights`, `languages` (every language in the
  database), as every package.
- `site.key: "publications"`; `site.languages`: the languages of the
  publications' translations, with their native labels; `site.names`: empty,
  as legacy names no site for the books in its data (the website's name is
  its own text); `site.origin`: the site's address, from its instance file
  (see *Links to other sites*).
- `projects`: the publications' projects (IAM, AMA, AMT, GPA, ISL), each with
  its `home_site`.

## publications.json

One record per work:

| Field | |
|---|---|
| `id`, `backward_compatibility`, `internal_name` | `backward_compatibility` is `mwnf3:bookbase:{id}`: a website turns legacy's `book/{id}/{lang}` address into the publication's page with it |
| `category` | `exhibition-trail`, `virtual-museum`, `educational`, `gallery`, `other` |
| `project_id`, `country_id`, `language` | `language` is the work's main language code |
| `status`, `display_order`, `extra` | `extra`: the work's legacy columns kept there (`region`, `date`, `legacy_category`) |
| `cover` | the cover rendition `{ url, alt_text, photographer, display_order, edition_id }`: the cover of a shown edition in the main language, else of another shown edition, else one with no edition; null when it has none |
| `pages` | the sample pages, as renditions of the same shape |
| `documents` | the work's PDFs that belong to no edition: `{ id, kind, url, language }`, `kind` `sample` or `credits` |
| `edition_ids`, `tag_ids`, `trail_ids`, `catalogue_item_ids` | the ids of its records in `editions.json`, `tags.json`, `trails.json` and `references.json`, in order |
| `languages` | the codes it has a translation in |

Renditions are `/pub/{path}` URLs on the image base URL, burned like every
attached image (D-P5). Documents are `/doc/{uuid}.pdf` URLs (ADR 004). A
document whose file never synced (it keeps the size placeholder 1: legacy
names some files that do not exist) is left out, as is one not yet stored
under its `/doc` name, with a warning. Images follow the other exporters,
which ship every attached image row.

## translations/publications.\<lang\>.json

Per publication: `title`, `subtitle`, `description`, `introduction` and the
three credit lines as printed, `author_credit`, `photography_credit`,
`coordination_credit`. The text is the publication's project's context, the
default context for a work without a project (D-P7).

## editions.json

One record per shown version (one language × publisher × format × edition):
`id`, `publication_id`, `backward_compatibility`, `language`, `format`
(`print`, `print-on-demand`, `ebook`), `edition`, `publish_year`, `isbn`,
`publisher` (text, D-P4), `page_count`, `image_count`, `plan_count`,
`dimensions`, `binding`, `display_order`, `cover` (its cover rendition, or
null), `documents` (its sample and credits PDFs) and `texts`: the edition's
own texts where they differ from the publication's (`extra.legacy_texts`,
D-P9), or null.

## tags.json

The subjects, themes and target readers the publications carry:
`{ id, internal_name, category, language, description }`, `category` one of
`subject`, `theme`, `audience`.

## references.json

The catalogue items and the trail entries, as references only:

```json
{
  "id": "…",
  "type": "object",
  "backward_compatibility": "mwnf3:objects:ISL:jo:Mus01:12",
  "names": { "en": "…", "fr": "…" },
  "picture": "https://inventory.metanull.eu/pub/….jpg",
  "sites": [
    { "site": "islamicart", "path": "/item/…", "url": "https://museumwithnofrontiers.github.io/islamicart/#/item/…" },
    { "site": "ceramics", "path": "/item/…", "url": "https://museumwithnofrontiers.github.io/ceramics/#/item/…" }
  ]
}
```

`names` is the item's own project's text per language; `picture` its first
picture; `sites` the sites that show it, its home site first, from the
shared rule (`shared/sites.mjs`, D1). The item's sheet stays on its own site.

## trails.json

The trails the publications accompany: `{ id, backward_compatibility,
titles, subtitles, site, path, url, entry_ids }`, its page on the Travels
site and its entries (their ids in `references.json`).

## Links to other sites

Every link to another site's page carries `site` (its slug), `path` (the
route) and `url` (`<origin>/#<path>`): a website can use the address as it is,
or rebuild it from the slug and path as viewer-core's `siblingSiteUrl` does.
A site's origin is its instance file's `origin`, or its GitHub Pages address
(`https://museumwithnofrontiers.github.io/<slug>`) until its domain cutover;
Publications and Travels keep books.museumwnf.org and travels.museumwnf.org
when they move. The routes are `/item/:id` (Explore: `/monument/:id`),
`/publication/:id` on Publications and `/trail/:id` on Travels.
