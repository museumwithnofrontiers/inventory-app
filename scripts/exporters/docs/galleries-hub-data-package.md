# Galleries hub data package — specification

Date: 2026-09-28 · Story [#2113](https://github.com/museumwithnofrontiers/inventory-app/issues/2113),
epic [#1744](https://github.com/museumwithnofrontiers/inventory-app/issues/1744).

One package, `@museumwnf/galleries-data`, for one website: the galleries hub
that replaces <https://galleries.museumwnf.org>. It is produced by its own
exporter, `scripts/exporters/galleries`, driven by the `standalone` instance
file `instances/galleries.json`. It is not a `dxa-gallery` instance: the hub
lists galleries and a handful of partners and ships no items.

## Scope, decided on 2026-09-28

- **A new exporter.** Legacy runs the hub as one more `dxa-api` deployment,
  configured as gallery 45 ("Thematic Galleries", hidden). Pascal chose a
  dedicated exporter that ships the galleries list and a partner directory,
  and nothing else: **no items, no item sheets and no timeline.**
- **The partner directory is legacy's**: the museums of the `GALLERIES`
  project, 8 today. It is not the union of every gallery's partners, which
  each gallery site already lists.
- **`gallery-partners.museumwnf.org`** already redirects to
  `galleries.museumwnf.org` (checked on 2026-09-28), so nothing is rebuilt for
  it.

## The legacy site

`galleries.museumwnf.org` is a compiled Vue client whose source is not in
`.legacy-code`: `dxa-client` only links to it. Everything below was read
from the live bundle and the live API (`/api/v2`) on 2026-09-28.

| Route | What it shows | API calls |
|---|---|---|
| `/` | Four featured galleries, then "Other Virtual Museums" (Discover Islamic Art, Discover Baroque Art, Sharing History), then a carousel of featured partners | `thg/galleries/featured`, `partners/featured`, then each partner's detail |
| `/list/:page?` | The count of galleries; a drop-down that jumps to any gallery's site; an A–Z / Z–A toggle; on page 1, a featured block; then a paged grid of every gallery with an icon and its name in capitals | `thg/galleries` |
| `/partners` | The partners grouped by country, with an A–Z / Z–A toggle on countries. Each partner shows its name and city, its project and "Partner" or "Affiliate", a logo, "Read more", and "View objects" when it holds objects | `partners` |
| `/partner/:database/:country/:id/:language` | One partner's profile | `mwnf3/partners/…` |
| `/about`, `/credits` | Text pages | `i18n` |
| `/partner-objects/…`, `/database-item/…`, `/timeline-results` | A partner's objects, an item sheet, the timeline | — out of scope |

What the live API answers:

- `thg/galleries` lists **37 galleries**, in `sortOrder` order. Exhibitions
  are not listed.
- `thg/galleries/featured` answers **4 galleries picked at random** on each
  request: it ignores the `featured` flag (see `isFeatured` in
  `dxa-gallery/src/exporters/gallery-exporter.ts` for that flag's polarity
  defect).
- `partners` lists **8 partners**, all of project `GALLERIES`.
  `partners/featured` answers **3 of them picked at random**
  (`DXA_NUMBER_OF_FEATURED_PARTNERS`, `ApiV2Controller::partnersFeatured`):
  there is no featured flag behind it, and every one of the 8 has
  `portal_display = 'n'`.
- `i18n` carries the hub's texts. Only English has the hub's own keys
  (`about-title`, `about-text`, …); the other nine languages carry only the
  shared keys. The hub is an English site.

Assets that live in the legacy client, not in any database, and so belong to
the website (story H.4), not to this package:
- **The grid icon** of each gallery, `./<galleryKey>.png`. It is bundled in the
  client and served as `img/<galleryKey>.<hash>.png`.
- **The three "Other Virtual Museums" pictures.** Their addresses are
  viewer-core's `mwnfLinks` (`islamicArt`, `baroqueArt`, `sharingHistory`).

## File layout

```
manifest.json
galleries.json
partners.json
countries.json
languages.json
translations/
  partners.<lang>.json
  countries.<lang>.json
LICENSE.md
README.md
```

## manifest.json

The same skeleton as a gallery package's (`dxa-gallery-data-package.md`):
- `generatedAt`, `version`, `rights`;
- `kind: "galleries-hub"`;
- `languages`;
- `site`:
  - `key: "galleries"`;
  - `languages`: the hub's own UI languages, today `[{ "code": "en", "label": "English" }]`;
  - `names`: the hub's name per language, from gallery 45's collection translations ("Thematic Galleries" in English, as legacy titles it).
- `projects`: one entry per project UUID that the partners belong to (`GALLERIES` today), in the standard shape viewer-core's `projectLabel` and `projectLinks` read.

Source: the collection `mwnf3_thematic_gallery:thg_gallery:45`
(`gallery_galleries`) and its `collection_translations`, the same reads
`dxa-gallery`'s `ManifestExporter` makes for a gallery.

## galleries.json

Every gallery under the galleries root that legacy shows, as an array:

```jsonc
[
  {
    "id": "<collection uuid>",
    "backward_compatibility": "mwnf3_thematic_gallery:thg_gallery:4",
    "slug": "amulets_and_talismans",          // legacy key, verbatim
    "legacy_host": "https://amulets.museumwnf.org",
    "names": { "en": "Amulets and Talismans", "ar": "…" },
    "languages": ["ar", "en", "es", "fr"],     // the gallery's UI languages
    "image_path": "thematic_gallery/thg_galleries/4/1.jpg",
    "featured": false,
    "live_date": "2022-12-01T00:00:00.000Z"
  }
]
```

**Which galleries:** the children of the collection whose `purpose` is
`galleries-root`, of type `gallery`, whose `thg_gallery.status` is `A`.
- On staging that's 37 of 42.
- The 5 hidden ones are legacy's `excluded`, `galleries` (the hub itself),
  `curiosities`, `unclear` and `doubts`.
- Exhibitions sit under their own root and are not listed, as on legacy.

**Fields:** they are exactly those of a gallery package's `sibling_galleries`
(`GalleryExporter.exportSiblings`), with the same sources:
- the anchor `collections.extra.thg_gallery`: `slug`, `host`;
- the chrome `collection_translations.extra.thg_gallery`: `image`, `featured`, `status`, `live_date`;
- names from `collection_translations.title`.

`languages` is the key set of `names`, the same derivation as a gallery
package's `gallery.json`.

**Order: English name, A to Z.**
- Legacy orders by `thg_gallery.sort_order`, which the importer does not
  carry: it is NULL for every gallery on staging.
- Legacy's `sort_order` is itself English-name A–Z order. That's verified against
  the live list on 2026-09-28, even though it is not gallery-id order
  (Historical Cars, 49, sits between Gold and Silver, 19, and Ivory, 20).
- So the exporter sorts by English name and reproduces legacy's order
  without an importer change. If a curated order ever diverges from
  alphabetical, importing `sort_order` becomes a story of its own.

**Links:** `legacy_host` is a reference, never a built URL (decision Q3).
The website links a gallery the way the gallery sites link their siblings
(viewer-core `useGalleryData`): to its `legacy_host`.

**Featured:** `featured` keeps its documented meaning (`featured = 'A'`),
but the hub's featured block reproduces legacy's actual behaviour: 4
galleries picked at random. The site picks them; the package ships the flag.

## partners.json

The museums of the `GALLERIES` project:

```sql
SELECT p.* FROM partners p
JOIN projects pr ON pr.id = p.project_id
WHERE pr.backward_compatibility = 'mwnf3:projects:GALLERIES'
  AND p.type = 'museum'
```

That's 8 on staging, exactly legacy's 8. The query names the project by its
key, as `dxa-gallery`'s instance file names its collection. The exporter
takes that key from its own configuration, never from the website.

**Record shape:** the same as `dxa-gallery`'s `partners.json`, and so is
`translations/partners.<lang>.json`, which carries every language the
partner has.

The fields the hub needs:
- **`level`**, from `collection_partner` rows of `collection_type = 'project'`
  in the `GALLERIES` project's context:
  - `partner` is legacy's "Partner";
  - NULL is legacy's "Affiliate".

  Staging reproduces legacy exactly: Museu do Caramulo (`pt`/`Mus08`) is
  the one affiliate.
- **`project_uuids`:** the `GALLERIES` project, which `manifest.projects`
  names ("MWNF Galleries").
- **`logos`, `images`**, the translated profile fields, and the contact fields.
- **`featured`:** kept for shape compatibility. The hub's carousel picks 3
  of the 8 at random, as legacy does.

**`item_count` is 0 for every partner.** It counts the exported items a
partner holds, and the hub exports none. The key stays because the partner
shape is one shape across every dataset (decision D4, inventory-app#1699).

A count of 0 is also what makes viewer-core's partner record
(`record/partners.js`) omit both the object count and the objects link. So
legacy's "View objects" disappears without any hub-specific rule.

## countries.json

The countries of the partners, 8 today, with their translations: the
partners page groups by country name. The shape is `dxa-gallery`'s
`countries.json`, scoped to partner countries only.

## languages.json

As in every package: the languages any shipped translation uses.

## What the website adds (story H.4)

- The grid icons and the three museum pictures, as site assets (see above).
- The English UI texts, from `scripts/site-i18n` for gallery 45's i18n
  groups: `i18n_group_id` 58 and `i18n_common_group_id` 59, read from gallery
  45's anchor.
- The random picks: 4 galleries and 3 partners.

## Verification (story H.2)

- A staging export lists 37 galleries and 8 partners, 7 of them at level
  `partner` and 1 affiliate. Those are legacy's numbers.
- Two exports are byte-identical, apart from `generatedAt`.
