# Explore — legacy analysis and parity map

Date: 2026-09-28 · Story [#2118](https://github.com/museumwithnofrontiers/inventory-app/issues/2118),
epic [#1745](https://github.com/museumwithnofrontiers/inventory-app/issues/1745).

This document describes what legacy Explore serves and maps each part onto
what the importer already puts in the inventory database. It is the input to
the Explore data-package specification and exporter (story E.2) and to the
importer stories that close the gaps it names.

## Sources

- **The live site:** <https://explore.museumwnf.org>, a compiled Vue client on
  its own API at `/api/…`. Neither the client nor the API is in
  `.legacy-code`.
  - The routes and the API calls below were read from the live bundle
    (`js/app.63b3c409.js`) on 2026-09-28.
  - The API was then crawled from its entry points by following every
    `links` URL.
- **Legacy database:** `mwnf3_explore`, through the DDL and data dumps in
  `.legacy-database/`. Use them for column meaning, not for counts: the dumps
  drift from live legacy.
- **The PHP tree under `.legacy-code/explore/`** is the older Explore site, not
  the live one. Use it for field semantics only. Its old domain now serves an
  unrelated site: never link it.
- **Staging:** the inventory database the exporters read (`staging-mysql`),
  queried on 2026-09-28.

## The live site

| Route | What it shows | API |
|---|---|---|
| `/` | Home: banners, the themes, what's new, featured partners | `banners`, `themes`, `texts/home`, `texts/what-is-new`, `featured-partnership` |
| `/themes/:theme/:country?/:territory?/:location?/:monument?/:language?/:tab?` | Browse by theme, then down to a monument | `themes/{id}` → `countries?t=` → `locations?…` → `monuments/{id}` |
| `/countries/:country/:filter?/:territory?/:location?/:route?/:monument?/:language?/:tab?` | Browse by country, optionally narrowed by a filter | `countries/{cc}` → `territories?c=`, `locations?c=`, `monuments?c=&l=` |
| `/itineraries/:country/:territory?/:itinerary?/:subItinerary?/:monument?/:language?/:tab?` | Browse the itineraries of a country, then an itinerary, then a sub-itinerary, then its monuments | `itineraries/countries`, `itineraries/itineraries/{id}`, `itineraries/sub-itineraries/{id}` |
| `/search/:type` | Search | (client side, over the lists) |
| `/about`, `/credits`, `/get-involved`, `/important-information`, `/new` | Text pages | `texts/{about,credits,get-involved,important-information,what-is-new}` |

The API is hypermedia. Every record carries `links` to its children, and a
record reached through different parents gets different URLs:
`monuments/1108?c=tn&l=498` is monument 1108 reached through Tunisia,
location 498. So the counts below are of distinct record ids.

## What legacy serves, and where it is on staging

| Legacy | Live count | Staging | Status |
|---|---|---|---|
| Themes (`thematiccycle`) | 6: ids 1, 2, 3, 8, 10, 11 | 11 collections of type `theme` under `explore-themes-root` | **Gap G1**: ids 4–7 are empty, and 9 ("Great Patrons of the Art", 3 members) is shown by staging but hidden by legacy. No status is imported to tell them apart. |
| Countries | 23 | 23 collections under `explore-countries-root` | Same set |
| Territories (`regions`) | 18 | 18 collections of type `region` | Same set |
| Locations | 649 | 649 collections of type `location` | Same set |
| Monuments | 1,693, as listed by the locations | 1,971 monument items linked to the location collections; 106 of them native (`mwnf3_explore:monument:{id}`), the rest resolved onto existing mwnf3, Sharing History and Travels records | **Gap G3**: a resolved monument keeps no trace of its Explore id, so it can't be matched to legacy. The larger staging count is expected: one Explore monument that references several source records resolves to all of them (`explore-filter-importer.ts`). |
| Filters | per country (`availableFilters`) | 30 tags, category `filter`, linked to the items | Imported |
| Itineraries | 12 top-level, 114 sub-itineraries, across 11 countries | 20 `itinerary` and 109 `exhibition trail` collections (`mwnf3_explore:itinerary:{id}`) | **Gap G2**: all 12 live itineraries exist. But 5 live sub-itineraries (113, 114, 115, 124, 126) are imported as top-level itineraries, and 3 itineraries legacy doesn't show (141, 142, 143) are imported. |
| Location texts | name, description, how to reach, info, contact, prepared by; a historical background on 138 locations | `collection_translations` title and description, plus `extra` `how_to_reach`, `info`, `prepared_by`, `showOnMonument`, `additional_regions`; the collection's `extra.historical_background` | Imported (G5, #2131). See [Historical background](#historical-background). |
| Monument content | one `monumentDetails` entry per monument, from its source database | the resolved record's own translations | Imported through resolution. Where it comes from, over 1,386 crawled monuments: 993 Travels "Exhibition Trails" (project IAM), 333 "Virtual Museum" (BAR, GPA, ISL, AWE), 60 native to Explore. |
| Related content | 452 monuments: "Special Features" and "Virtual Museum" links to records in other databases, plus Travels and Sharing History ones | not examined | To specify in E.2 |
| Related itineraries | 1,003 monuments | derivable from itinerary membership | Derivable |
| Glossary | per monument, per language (1,255 monuments) | the glossary entities | Derivable, the way the other main sites highlight terms |
| Travel information | on every level; see the next section | none | **Gap G4**: not imported; D1 carries it all |
| Home banners | 1 per request, drawn at random from the 15 active ones | the Explore root's `extra.explore_home.banners` | Imported (G6b, #2133); see [Site records](#site-records) |
| Featured partnerships | 5, each on the home page and/or the pages it is scoped to | the Explore root's `extra.explore_home.featured_partnerships` | Imported (G6b, #2133); see [Site records](#site-records) |
| Text pages | 6 (`texts/*`): the home page's five `Home-*` words in `mwnf3_explore.translation`, the other five pages in `explore_pages_langs`; English only | not the inventory's: `site-i18n`'s `extract:explore` writes them to the site's locales | Extracted (G6a, #2132); the output matches the live API's text |

## The travel layer

Every level of Explore (country, territory, location, monument,
sub-itinerary) carries MWNF's travel offer next to the heritage content.

Number of records carrying each block, of those crawled:

| Block | Country (23) | Territory (18) | Location (649) | Monument (1,386) | Sub-itinerary (114) | What it is |
|---|---|---|---|---|---|---|
| `mwnfTravelBook` | 12 | 12 | 460 | — | 109 | An MWNF Travel Book, linking to books.museumwnf.org |
| `mwnfTour` | 9 | 7 | 398 | — | 104 | An MWNF Tour run by a travel agency, linking to travels.museumwnf.org |
| `accommodations` | 4 | 7 | 110 | 44 | — | Hotels and travel agencies with their addresses |
| `guidedVisits` | 2 | 7 | 3 | 11 | — | Guided-visit contacts |
| `usefulWebsites` | 14 | 8 | 492 | 1,169 | — | Tourism and institution websites |

The legacy tables behind it are `explorecountry*` and `explorelocation*`
(books, travels, hotels, don't-miss), `accommodation*`, `eating*`,
`excursions*`, `guided_visits*`, `hotels`, `otherbooks`, `othertravels`,
`featured_books*`, `featured_tours*` and `useful_websites`. The importer
reads none of them.

Books and Travels as products were ruled out of the migration on 2026-09-14
("Travels, LAS, Books, Virtual Office OUT"). The travel layer is their
presence inside Explore. That is why it needed a decision (D1) rather than
an importer story by default.

## Site records

The home banners, the featured partnerships and the travel layer are
records of the site, not of a page: legacy keeps each once and scopes it to
the pages it shows on. Several tables share that shape (`featured_partnerships`,
`featured_books_explore`, `featured_tours_explore`, `accommodation_hotels`,
`guided_visits_contacts`, `useful_websites`): one comma-separated list of ids
per level, in `cycle`/`cycleId`, `country`, `regionId`, `locationId`,
`monumentId` and `itineraryId`.

**Where they live** (Pascal, 2026-09-28): on a collection for the whole site,
`mwnf3_explore:root`, purpose `explore-root`, the parent of the three section
roots. Its `extra` holds every record once, with its scope:

- `explore_home.banners`: the 15 active banners (`status = 'Y'`). Each has a
  name, the country, location and monument it shows, where it leads (`link`:
  a monument page, or a page outside Explore, with legacy's `url`) and its
  image path.
- `explore_home.featured_partnerships`: the 5 sponsors. Each has its logo path,
  whether the home page shows it (`home`), its `scope`, and per language a
  title, a name and a link.
- `explore_travel` (G4, #2130): the travel layer's records, the same way.

**A scope** keeps legacy's ids, one list per level: `themes`, `countries`,
`territories`, `locations`, `monuments`, `itineraries`. Each names the
Explore collection `mwnf3_explore:{thematiccycle|country|region|location|itinerary}:{id}`.
A monument id is the one location memberships keep in `explore_monument_ids`
(G3): a monument resolved onto another database's record has no Explore key.

**Which page shows a record**, read from the live API over every crawled
page:

- a country, territory, location or monument page shows the records whose
  list for its level holds its id. This matches the live API on every crawled
  page, for every block;
- except that monument pages show no Travel Book and no Tour, whatever their
  scope;
- a sub-itinerary shows the Travel Books and Tours scoped to its locations,
  and no other block (227 of the 228 crawled cases; sub-itinerary 3 leaves out
  book 31, which has no theme and no country, and goes to E.6).

Images stay paths on legacy's media server, like a gallery's chrome. Texts are
keyed by the inventory's language id.

## Historical background

A location's historical background (`locationHistoricalBackground`) is up
to two texts, in this order:

1. **Explore's own**, when `locationtranslated.description` is set, signed by
   its `prepared_by`. Five translations on four locations carry one.
2. **A Travels location's introduction**: `tr_locations.description` in every
   language that has one, signed by its `author`. Legacy's API picks the
   Travels location this way:
   - the ones the Explore office picked in `locations.et_loc_introduction`
     (`project;country;itinerary;number;lang;trail#order`), those that have a
     text, in their order. An order of `-` doesn't hide one.
   - with none picked, the Travels location of the same country whose title
     is the location's name in the country's language (`mwnf3.countries.lang_id`),
     or its English name when it has none in that language. Case, accents and
     trailing spaces don't count. The office proposes candidates the same way.
   - `introd_type` plays no part: the live site shows Explore's own text even
     where it says `Other#-`.

On staging:

- Explore's own text is the location translation's description, with
  `extra.prepared_by`.
- The Travels texts are the Travels location translations: `description`, and
  `author`, `about` and `prepared_by` in `extra`.
- Each Explore location lists the Travels locations it shows, in order, in its
  `extra.historical_background`, by their keys
  (`mwnf3_travels:location:{project}:{country}:{trail}:{itinerary}:{number}`).

Checked against the live API: the same Travels locations on the same 136
locations, in the same order, and Explore's own text on its four. Together
they are the 138 locations with a background.

## Decisions

Pascal took all three on 2026-09-28:
- **D1: carry the whole travel layer.**
- **D2: the text pages go to the site's i18n**, through `site-i18n` reading
  `explore_pages`. **The home banner and the featured partnerships go in the
  package**, through the importer.
- **D3: yes**, the package ships the records Explore's monuments resolve to,
  whatever database they came from.

The questions as they were put:

- **D1, the travel layer:** carry it, part of it, or none of it?
  - `usefulWebsites` is the most used block and the one least tied to the
    dropped products.
  - `mwnfTravelBook` and `mwnfTour` promote products the migration dropped.
  - `accommodations` and `guidedVisits` are commercial contact lists.
- **D2, site copy:** where the text pages, the home banner and the featured
  partnerships go.
  - Following the 2026-09-14 rule, pages are site copy that belongs in the
    site's i18n tables. But `site-i18n` can't read them: they live in
    `mwnf3_explore.explore_pages`. So either `site-i18n` learns that source,
    or the copy is extracted once by hand into the site's texts PR.
  - The banner and the featured partnerships are data with images and links,
    closer to the package than to i18n.
- **D3, a confirmation:** Explore ships the records its monuments resolve to,
  whatever database they came from. Most are Travels "Exhibition Trails"
  records, already imported by phase 7. This builds no Travels site and adds
  no Travels importer work, so it stays within the 2026-09-14 scope. It is
  recorded here because Travels was named as out of scope.

## Importer gaps

Each gap is one story in milestone M11, sub-issues of epic #1745, and each
blocks the exporter (story E.2):

- **G1** (#2127): import `thematiccycle.status`, so the exporter can leave out the
  cycles legacy hides.
- **G2** (#2128): the itinerary parent and visibility: file sub-itineraries 113, 114,
  115, 124 and 126 under their legacy parent, and carry the status that hides
  141–143.
- **G3** (#2129): keep the Explore monument id on a resolved monument, on the
  location membership row (`collection_item.extra`) or next to it. Without it
  the package can't be compared with legacy, and legacy's monument ids can't
  be honoured.
- **G4** (#2130): the whole travel layer (D1): Travel Books, Tours, accommodations,
  guided visits and useful websites, on every level that carries them.
- **G5** (#2131), done: the location texts, historical background included; see
  [Historical background](#historical-background).
- **G6a** (#2132): `site-i18n` reads `explore_pages`, so the six text pages reach the
  site's texts PR (D2).
- **G6b** (#2133): import the home banner and the featured partnerships, for the
  package (D2).
