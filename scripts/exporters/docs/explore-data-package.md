# Explore data package — specification

Date: 2026-09-28 · Story [#2119](https://github.com/museumwithnofrontiers/inventory-app/issues/2119),
epic [#1745](https://github.com/museumwithnofrontiers/inventory-app/issues/1745).

One package, `@museumwnf/explore-data`, for one website: the Explore site
that replaces <https://explore.museumwnf.org>. It is produced by its own
exporter, `scripts/exporters/explore`, driven by the `standalone` instance
file `instances/explore.json`. The legacy behaviour it reproduces is
documented in [`explore-legacy-analysis.md`](explore-legacy-analysis.md): read
it for the why of every rule below.

## Scope

Explore is no project. Its collections live in the Explore context under the
site root (purpose `explore-root`), and most of its monuments are other
databases' records that Explore's locations, themes and itineraries point at
(decision D3). So the scope (`src/core/scope.ts`) is:

- **the collection tree** under the site root, as legacy shows it:
  - a theme only when its English translation's `legacy_status` is `e`: the
    6 live thematic cycles, of 11;
  - an itinerary only when it is Explore's own (`extra.explore_itinerary`),
    never the old site's (`mwnf3_explore:old_itinerary:*`);
  - under the itineraries root, a thematic itinerary (legacy type 4), and a
    location route (types 1–3) only when it is linked to a location
    (`location_ids`): legacy reaches a route from its location's page;
  - a hidden collection hides its whole subtree;
- **the Travels locations the historical backgrounds show** (G10, #2156): a
  location's background is their introduction, and they are no part of the
  Explore tree, so they ship after it, reached by their key;
- **the items**: the members of those collections, their own details
  (legacy's "Special Features") and the records they link to (their
  "Virtual Museum", Travels and Sharing History related content), one hop out.

It carries no dynasty and no timeline. The site's own texts (its six pages)
are not in the package: `scripts/site-i18n` extracts them for the site's
locales (G6a).

## File layout

```
manifest.json
collections.json
items.json
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

The shapes are the standalone packages' (`sharinghistory`, `islamicart`),
with the differences below.

## manifest.json

- `kind: "explore"`, `rights`, `languages` (every language in the database),
  as every package.
- `site.key: "explore"`.
- `site.languages`: the languages of Explore's own texts, those of the shipped
  collections' translations in the Explore context, with their native labels.
  A monument's source record may carry more.
- `site.names`: the Explore root's title per language: legacy's dictionary
  word `explore_mwnf` ("EXPLORE with MWNF"), in English, Spanish and Italian
  (G14, #2163).
- `projects`: the projects the shipped items belong to (Discover Islamic Art,
  Discover Baroque Art, Sharing History). Travels records and native Explore
  monuments belong to none.

## collections.json

The tree, parents first, siblings in display order: the root, its three
sections, then themes (in legacy's order, G9, #2155), countries,
territories, locations, itineraries and sub-itineraries. After the tree, the
Travels locations the historical backgrounds name, in the order they are
first named: their parents are not shipped, so no walk of the tree reaches
them. Each record adds `map_zoom` and `extra` to the standalone shape, and
each membership in `items` keeps its `extra`: Explore keeps its structure
there.

| Where | `extra` key | What it is |
|---|---|---|
| the root | `explore_home` | the home banners and the featured partnerships ([Site records](explore-legacy-analysis.md#site-records)) |
| the root | `explore_travel` | the travel layer: books, tours, accommodations and their categories, guided visits, useful websites |
| a location | `historical_background` | the keys (`backward_compatibility`) of the Travels locations whose introduction it shows, in order ([Historical background](explore-legacy-analysis.md#historical-background)); each ships after the tree |
| an itinerary | `explore_itinerary` | legacy's `type` (4 thematic, 1–3 location route), `order`, `location_home_link` |
| a location's membership | `explore_monument_ids` | the Explore monument ids the member stands for |
| a location's membership | `explore_geo` | each of those monuments' position, by id: `{ latitude, longitude, map_zoom }` (G12, #2161). The member's own `latitude`/`longitude` are its own database's, when it has any: a map reads this |
| an itinerary's membership | `mn_order`, `desc_types`, `explore_mn_desc`, `tr_mn_desc`, `vm_mn_desc` | the monument's place and texts in the itinerary |

A country, a territory and a location carry their position in `latitude`,
`longitude` and `map_zoom`: where legacy centres their map (a country's since
G16, #2168). A monument's is on its location membership, above.

A top-level itinerary has one image, legacy's picture of it (G13, #2162). A
sub-itinerary has none: legacy's API shows the first picture of its first
location's first monument instead.

The translations (`translations/collections.<lang>.json`) carry the title and
description and their `extra`: a location's `how_to_reach`, `info`, `contact`,
`prepared_by`; a Travels location's `author`, `about` and `prepared_by`; a
theme's `country_ids` and `country_texts`; an itinerary's `location_ids`,
`country_ids`, `territory_ids`, `duration`, `local_team`, `author`,
`introd_type`, `et_title`, `et_introduction` (G11, #2160).

Only legacy's texts are shipped (G14, #2163): the root's title is its
dictionary word, it has no description, and the three sections have no
translation at all. Their texts, "Explore by Theme" and the home page's
section introductions, are the site's own labels, carried by its i18n.

**Which page shows a site record** (banners, partnerships, travel layer) is
the rule of the analysis doc's "Site records" section, applied by the site
from each record's `scope`.

## items.json

The standalone item shape, without Sharing History's `display_status`. Each
item keeps its own `project_id` and `parent_id`: a detail points at its
monument, a linked object belongs to its own project.

`related_items` lists the outgoing links whose target ships: after the scope
above, that is every one.

`filters` lists the item's Explore filters (the tags of category `filter`,
such as `Mudejar` or `Religious`), which also stay in `tags`: the by-country
page narrows a country's monuments by them.

## translations/items.<lang>.json

A monument's content is its own record's:
- its project's context (an ISL, BAR or Sharing History record);
- the Travels context for a Travels record, which belongs to no project;
- the Explore context for a monument native to Explore.

A second source context (EPM next to ISL) gives `short_description`, as in
`islamicart`.

Explore's own row for a monument that is another database's record ships
apart, as `explore`: Explore's `name` for it (legacy lists monuments by that
name) and, now and then, Explore's own texts (`description`, `how_to_reach`,
`info`, `prepared_by`, `further_readings`). It is never mixed into the
record's own fields.

## partners.json

Explore has no partner directory: its partners are the holders of the
shipped items, which a sheet names. The shape is the shared one (decision
D4); `level`, `parent_id` and `project_uuids` come from the curated hierarchy
of the items' projects, where it has them.

## glossary.json, countries.json, languages.json

As in every package. The glossary is the entries a spelling of the shipped
items or collections references.

## Numbers (staging, 2026-09-29)

Against the live API, per the analysis doc's parity map:

| | Package | Live |
|---|---|---|
| Themes | 6 | 6 |
| Countries | 23 | 23 |
| Territories | 18 | 18 |
| Locations | 649 | 649 |
| Itineraries | 12 | 12 |
| Sub-itineraries | 114 (109 exhibition trails, 5 location routes) | 114 |
| Monument ids on location memberships | 1,691 | 1,693 |
| Monument positions on location memberships | 1,679 | 1,681 |
| Itinerary pictures | 12 | 12 |

The two monuments missing are legacy's data defects (1682 has no name, 1801
points at a record never imported), left for the comparison story (E.6).
Twelve monuments have no position in legacy either.

In all, 962 collections (the tree's 826, and 136 Travels locations for the
historical backgrounds) and 3,191 items: 1,982 monuments, their 878 details
and 331 linked objects. Also 82 partners and 379 glossary entries.

## Verification

- Two exports of one database are byte-identical, apart from `generatedAt`.
- The counts above are re-read from a staging export.
