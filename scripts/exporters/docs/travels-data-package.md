# Travels data package — specification

Date: 2026-11-12 · Story [#2537](https://github.com/museumwithnofrontiers/inventory-app/issues/2537),
epic [#2514](https://github.com/museumwithnofrontiers/inventory-app/issues/2514) (M14).

One package, `@museumwnf/travels-data`, for one website: the Travels site
that replaces the Exhibition Trails of <https://travels.museumwnf.org>
(D-T1). It is produced by its own exporter, `scripts/exporters/travels`, a
fork of `explore`, driven by the `standalone` instance file
`instances/travels.json`. The model behind it is part 3 of the M14 proposal;
the 2013 tour offers, guides and agencies are not in the inventory (D-T2).

## Scope

The scope (`src/core/scope.ts`) is Explore's tree walk, rooted at the
collection of purpose `travels-root` in the Travels context
(`mwnf3_travels:context`), with none of Explore's rules for hidden
collections: legacy shows the whole tree.

- **the collection tree**: the root, the exhibition trails, their
  itineraries and the itineraries' locations, parents first, siblings in
  display order;
- **the items**: the locations' members (the monuments, the site's own
  items) and their own details, with their pictures;
- **the trail entries**, as references only: a trail's own members are
  Islamic Art's objects and monuments, which stay that site's records.

## File layout

```
manifest.json
collections.json
items.json
references.json
partners.json
countries.json
glossary.json
languages.json
translations/
  collections.<lang>.json
  items.<lang>.json
  partners.<lang>.json
  countries.<lang>.json
  glossary.<lang>.json
LICENSE.md
README.md
```

The shapes are Explore's (`explore-data-package.md`), with the differences
below.

## manifest.json

- `kind: "travels"`, `rights`, `languages`, as every package.
- `site.key: "travels"`; `site.languages`: the languages of the tree's texts
  in the Travels context; `site.names`: the Travels root's title per
  language; `site.origin`: the site's address (see
  [`publications-data-package.md`](publications-data-package.md#links-to-other-sites)).
- `projects`: the projects of the site's monuments (IAM, GPA, D-T3), each with
  its `home_site`. No `trail_projects`: the records name their project.

## collections.json

Explore's collection shape. An exhibition trail also carries:

| Field | |
|---|---|
| `entries` | its entries, `{ id, display_order, contextual_descriptions }`: the reference's id in `references.json`, and legacy's justification of the entry per language |
| `partners` | the partners it links, `{ id, level }`: its "Starting point" museum at level `partner` (D-T6), whose record is in `partners.json` |
| `publications` | the publications that accompany it, `{ id, backward_compatibility, titles, site, path, url }`: the publication's page on the Publications site |

The texts' `extra` ships as the importer keeps it: a trail's `subtitle`,
`curated_by`, `local_coordinator`, `photo_by`, `region_territory`; an
itinerary's `description_2`, `author`, `introduction`, `prepared_by`; an
itinerary's `days` on the collection's own `extra`.

## items.json and translations/items.\<lang\>.json

Explore's item shape, without Explore's `filters` and its apart `explore`
row. A monument's text is its Travels row, whatever its project; a second
context's row gives only `short_description`.

## references.json

The trail entries, in the shape of the Publications package's
`references.json`: `{ id, type, backward_compatibility, names, picture,
sites }`, the home site (Islamic Art) first, each link the page that opens
the item on that site (no mini-site).

## partners.json, glossary.json, countries.json, languages.json

Explore's. The partners are the holders of the shipped monuments and the
trails' starting points.
