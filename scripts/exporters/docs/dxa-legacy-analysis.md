# DXA Galleries & Exhibitions — legacy client analysis (exporter/viewer view)

Date: 2026-08-27 · Epic: DXA exporters & viewers (4 pilot sites)
Companion to `temp_ANALYSIS_dxa_galleries_2026-08-25.md` (repo root), which
analyzed the legacy **data** and drove the #1517 importer fixes. This document
analyzes the legacy **clients**: what each page renders, what it requests from
the API, and what a static data package must therefore contain. It is the
requirements source for `dxa-gallery-data-package.md` and
`dxa-exhibition-data-package.md`.

Sources: `.legacy-code/dxa-api` (routes, `app/MWNF/SQL/**`),
`.legacy-code/dxa-client`, `.legacy-code/exhibitions-client`,
`.legacy-database/{ddl,data}`, live sites, and the post-#1523 OVH inventory DB
state (verified 2026-08-26).

---

## 1. The two products, one API

`dxa-api` is one Laravel codebase deployed once per site; **all scoping is
server-side** from `.env` constants (`DXA_CONSTRAINT_GALLERY_ID`,
`DXA_CONSTRAINT_PROJECT_ID`, `DXA_IS_EXHIBITION`,
`DXA_CONSTRAINT_LANGUAGE_ID`, …). Routes accept the literal `self`, substituted
server-side. Consequently **an exported data package plays the role of a fully
"pre-scoped" API instance**: everything in it is already filtered to one site.

Two clients consume it:

| | dxa-client (Galleries) | exhibitions-client (Exhibitions) |
|---|---|---|
| Deployment | one build per gallery, all languages in one instance | one build **per exhibition per language** |
| Theming | `src/sites/<key>/_variables.scss` palette + `world.png` | `VUE_APP_VO_*` env colors |
| Curated layer | none (no themes) | theme tree of selected **pictures** with per-exhibition texts |
| Navigation style | fixed endpoint URLs | HATEOAS: follows `links[].rel` from `/thg/galleries/self` |
| Timeline | global country timeline (`mwnf3.hcr` via `/v2/events`) | THG-local per-exhibition timeline (`/v2/thg/timeline`) where present |
| Partner pages | partners (museums) only | partners + **institutions** (monument owners) |

Both clients share verbatim-identical components for: collection search +
results, database item sheet, free-text search, how-to-search, partners list,
partner profile, partner objects, timeline results/gallery, credits, error.

## 2. Gallery client (dxa-client) — page-by-page contract

Routes and the API calls each one makes (all list endpoints are pre-scoped to
the gallery's membership union — see §4.1):

### 2.1 Home `/`
- **Banner** — the gallery's `bannerItem`/`homepageItem` (a composite item key
  in `thg_gallery`) + banner image; fetched via `/thg/galleries/self` then the
  item's own endpoint for caption/link.
- **Featured partners** — `/partners/featured` (partners of member items with
  `showOnPortal`, random subset, size from config).
- **Logos** — `/thg/galleries/self` logos (legacy table `thg_gallery_logos`
  has 1 row total across all sites — effectively dead; keep the slot, expect
  empty).
- **Featured galleries** — `/thg/galleries/featured`: 4 sibling galleries
  (name, image, public URL) + link to galleries.museumwnf.org. Cross-site
  promotion — see open question Q3.

### 2.2 Collection search `/collection` + results `/collection-results`
- Facet dropdowns: **country, type, dynasty, subject, material** + year range.
  Vocabularies from `/items/countries`, `/items/tags` (facet inferred from
  `tag_id` substring: `material_*`, `dynasty_*`, …), `/items/years`
  (min/max → the client builds era buckets itself).
- Facets are **dependent**: selecting one re-queries the others with the
  selection applied (counts shrink). A static package ships per-item facet
  values; the viewer computes vocabularies and dependent narrowing client-side
  (established pattern in the islamicart viewer's database search).
- Results grid 9/page from `/items?...` — thumbnail, name, holder line, date.

### 2.3 Item sheet `/database-item/<dbUid…>/:language`
The URL path **is** the legacy API dbUid
(`mwnf3/objects/{project}/{country}/{museum}/{number}`,
`sh/objects/{project}/{country}/{number}`, monuments and monument details
likewise) — i.e. exactly our `backward_compatibility` natural keys. The page
needs the full ~45-field object/monument sheet: names, dates (`objectDate` +
numeric start/end), holder + location, provenance, descriptions
(+ `shortDescription`), pictures with captions/copyright (zoom viewer),
`i18nLinks` (which languages this record has), authors, dynasty, **glossary**
entries with per-language spelling lists (the client regex-links them inside
descriptions, with Arabic word-boundary handling), related items,
"on display in" / other-exhibition cross-links, `remote-object` /
`remote-monument` link to the source database website, and the copyedit notice.
This is the same sheet the islamicart package already exports; deltas are
listed in the package spec.

### 2.4 Free-text search `/search`
`/items?ts=<term>` natural-language ranked search over the same membership
union, mixed objects+monuments. Static equivalent: client-side text index over
the package's translated names/descriptions (as done for the first three
viewers).

### 2.5 Partners `/partners`, profile `/partner/...`, objects `/partner-objects/...`
- List grouped by country with per-partner object counts, derived from the
  membership union (a partner appears because a member item is held there).
- Profile: description, address/contacts, pictures, logo, **Google Map**
  (lat/long/zoom) — see Q5.
- Partner objects: the member items held by that partner, paginated.

### 2.6 Timeline `/timeline`, `/timeline-results`, `/timeline-gallery/...`
Backed by the **global country timeline** `mwnf3.hcr` (country-scoped,
project-independent — every gallery shows the same worldwide chronology):
`/events/countries`, `/events/years`, `/events?ic[]=…&ya=…&yo=…`. The
timeline-gallery page then lists member items within the chosen
country/period from `/items`. The importer holds these as the 18 per-country
timelines (BC family `mwnf3:hcr:*`, 1,075 events) already exported for
islamicart.

### 2.7 About `/about`, Credits `/credits`, How-to-search `/how-to-search`
Pure editorial HTML from the site's i18n group (`galleryAbout`,
`galleryCredits`, `galleryPartners`, `searchHowTo`). **Not in the data
package** — delivered at scaffold time by `scripts/site-i18n` (decision G3),
already extracted as layered vue-i18n catalogues (Markdown).

## 3. Exhibition client (exhibitions-client) — the differences

Everything in §2 applies (search, item sheet, partners, credits…), plus:

### 3.1 Self + HATEOAS
The app boots from `/thg/galleries/self` (exhibition metadata: title,
subtitle, headline, about, popup logo, banner, `languageList`) and navigates
the curated layer by following `links[].rel` (`themes`, `items`, `related`).
The package equivalent is a `themes` tree file with explicit ids — no URL
chasing.

### 3.2 Themes `/themes`, `/theme/:id/:subtheme?/:image?`, `/theme-gallery/:id/:subtheme?`
The heart of the product:
- Theme list: ordered top-level themes (title, quote/presentation, cover
  picture from `theme_cover_image`).
- Theme page: the theme's ordered **selected pictures** (`theme_item` rows →
  our `picture` child items), each with its per-exhibition
  `contextual_description` and `image_caption` (`theme_item_i18n` → held in
  `collection_item.extra`), deep-linkable by `:image`; sub-themes nest one
  level (roman-numeral headings, own item lists).
- Per-picture **related pictures** (`theme_item_related` + directional
  descriptions → `item_item_links` + translations), including the 8
  cross-theme/cross-gallery rows (E5, fixed).
- Theme-level glossary (`/themes/{id}/glossary` — glossary terms matched in
  the theme's presentation text).
- Theme gallery: grid of all pictures of the theme (+subthemes).
- Each picture links to its parent item's full sheet (`/database-item/...`).

### 3.3 Institutions `/institution/...`, `/institution-monuments/...`
Monument-holding institutions get profile + monument-list pages (galleries
only have museum partners). Same partner data family; the split is
object-holder (museum → partner pages) vs monument-owner (institution pages).
**Hidden museums** (`exhibition_hidden_mwnf3_museums`, galleries 54/56 → E6,
imported into `collections.extra.thg_gallery.hidden_partners`) must be
excluded from all partner/institution lists — Water in Islam is affected.

### 3.4 Related content `/related`
`exhibition_related_content` (32 rows, categorized external links) — imported
as collection media/extra. Rendered as a categorized link list.

### 3.5 Timeline
Exhibition timelines are **THG-local** (`mwnf3_thematic_gallery.hcr`, BC
`mwnf3_thematic_gallery:timeline:{gallery}`): Colours has 45 events; Water in
Islam has none (nav entry hidden — `hasTimeline` flag). Not the global
country timeline.

### 3.6 Bottom banner + logos
`exhibition_partner` (partner strip) and `exhibition_logo` (sponsor logos,
categorized) render on every page. Imported as collection_partner /
collection_images.

### 3.7 Per-language deployment
Legacy builds a separate site per language (`/{slug}/{lang}/`), each API
instance pinned to one language (`DXA_CONSTRAINT_LANGUAGE_ID`), with
`exhibition_i18n.enabled` gating which languages are public. Colours: de+en.
Water in Islam: en. → Open question Q2 (single site with switcher vs per-language builds).

## 4. Contract details that shape the package

### 4.1 Membership (the item universe)
Visible items = `project_id = <site's mwnf3 project>` **OR** membership row in
the six `thg_gallery_*` link tables. Post-#1517 this union is materialized as
the site's gallery/exhibition **collection** in the inventory DB (G1 fix
verified: AMU 45, DCA 486-item universe, 47/50/52/54/55/56 exact). The package
item list = the site collection's members, full stop. Facet lists, partner
lists, search index, timeline-gallery are all derived from it.

### 4.2 Identity
Public item URLs must keep the dbUid path = our `backward_compatibility`
(case-insensitive match, stored mostly lowercase for SH). The packages carry
`backward_compatibility` on every item (established convention), so viewers
can reproduce identical URLs.

**Deduplicated Explore monuments resolve through the pivot, not the item.**
An Explore monument the importer recognised as an already-imported physical
monument does **not** exist as an item under its own Explore identity. Monument
1419 is the worked example: it is the same building as
`mwnf3:monuments:BAR:it:Mon13:14` (Palazzo Chigi, Ariccia), so the importer kept
the BAR identity and re-parented the Explore pictures onto it. Legacy lists that
monument twice, under two identities; our model lists it once. Membership counts
still agree, because both sides count one member.

The dual identity is not lost — it lives on the membership pivot rather than on
the item. The canonical resolution from a legacy Explore monument id to an
inventory item is:

```
collection_item.backward_compatibility
    LIKE 'mwnf3_explore:monument:<id>:collection_link:%'   →   item_id
```

Do **not** expect the Explore identity in `items.backward_compatibility`: the
item keeps only the identity of the record it was merged into — here, the BAR
one. Explore's own translations *are* present on the reused item, written in the
Explore context, so nothing curated by Explore is missing; only the second
identity string is.

No item-level metadata key records the deduplication, and that is deliberate
(decision Q6). `items` has no JSON column, so the only place to put a second
identity would be `items.backward_compatibility` itself, as a semicolon-
delimited list — and every exporter looks BC values up by exact match, so a
second value there would silently break resolution across all of them. The pivot
already carries the fact; a second store of it would be a second thing to keep
correct.

### 4.3 Facets
THG tags (`thg:tags:{tag_id}`, `category` ∈ artist/dynasty/material/subject/
type, English-only labels — G5 accepted) + country + partner + year range.
Items in the package need their tag links with category preserved (the
existing islamicart export flattens tags to bare labels and loses category —
gallery packages must not).

### 4.4 Languages
- Galleries: record-level i18n; AMU/DCA UI languages ar/en/es/fr, item sheets
  offer whatever languages each record has (`i18nLinks`).
- Exhibitions: curated texts exist only in the exhibition's languages
  (Colours de+en, Water en); member-item sheets may have more languages than
  the exhibition UI.
- UI chrome for both: `scripts/site-i18n` catalogues (ar/en/es/fr for gallery
  groups; exhibitions mostly en, Colours' group is en-only even though the
  site shipped in de — the de UI strings came from common group 59).

### 4.5 Media
Package convention (unchanged): absolute image URLs
`https://inventory.metanull.eu/pub/<uuid>.jpg`, one size; audio/video as
`media` entries. Legacy served xs/xl variants for the zoom viewer — the new
sites zoom on the single full-size asset (accepted for the first three
viewers; same here).

## 5. Verified availability (inventory DB, post-#1523)

| Package need | Inventory source | State |
|---|---|---|
| Site anchor (slug, host, project, i18n groups, flags) | `collections.extra.thg_gallery` (G2) | ✔ verified |
| Item universe per site | gallery/exhibition collection members (G1) | ✔ exact for all 6 exhibitions + AMU/DCA |
| Item sheets + translations | phases 01–03, per-project contexts | ✔ (same source as first three packages) |
| THG tags + item links | `thg:tags:*` with category | ✔ |
| Theme tree + selected pictures + per-exhibition texts | theme collections, `collection_item` pivot extra (E2/E3 fixed) | ✔ |
| Theme covers | `extra.thg_theme.cover_picture` (E4) | ✔ |
| Related pictures incl. cross-theme | `item_item_links` + translations (E5) | ✔ |
| Hidden museums | `extra.thg_gallery.hidden_partners` (E6) | ✔ |
| Exhibition partners/logos/related content/media | collection_partner / collection_images / collection_media | ✔ |
| Global country timeline (galleries) | 18 timelines BC `mwnf3:hcr:*` | ✔ (exported for islamicart already) |
| THG-local timeline (Colours) | BC `mwnf3_thematic_gallery:timeline:47`, 45 events | ✔ |
| Glossary + spellings | glossary tables (as islamicart) | ✔ |
| UI strings / editorial pages | NOT in DB — `scripts/site-i18n` output | ✔ extracted (#1521/#1537) |

Residual items to verify during exporter implementation (not blockers):
- Partner `featured`/`showOnPortal` flag fidelity on imported partners
  (drives the home-page featured strip).
- Banner/homepage item composite keys in `extra.thg_gallery` resolve to
  imported items for all four sites.
- Author (photographer/copyeditor) roles on gallery member items coming from
  EPM/ISL projects render the same holder-line as legacy.

## 6. Decisions (Pascal, 2026-08-27 · Q6 2026-08-28)

- **Q1 — Viewer platform: monorepo + OVH.** Viewers are built in
  `scripts/viewers/<site>` and deployed at inventory.metanull.eu, like the
  original three datasets. The #1510 website platform is not used for these
  four (revisitable later).
- **Q2 — Exhibition language model: per-language builds** (strict legacy
  parity). Colours ships as separate de and en deployments; Water in Islam
  ships en. The data package carries all enabled languages regardless — the
  split happens at build/deploy, not in the data.
- **Q3 — Outbound links: reference objects, never constructed URLs.**
  Legacy resolved cross-site links (source-database item pages, portal links)
  from a manually-fed database table that has no counterpart in the new
  model, so an exporter cannot reliably construct those URLs. The links must
  **not** be dropped: the package carries each one as an ID plus available
  metadata (backward_compatibility, project key, kind; slug/host where the
  data has them), and resolution to a real URL is a later concern with a
  mechanism yet to be designed. Viewers render what is resolvable and degrade
  gracefully for the rest.
- **Q4 — Naming: full legacy slugs**, kebab-cased for folders and packages:
  `amulets`, `carpets`, `the-use-of-colours-in-art`, `water-in-islam`
  (`@museumwnf/<name>-data`, published to npmjs). Data values keep the
  original underscore slugs (`the_use_of_colours_in_art`) since they are
  legacy identity.
- **Q6 — Deduplicated Explore monuments: no new persistence** (2026-08-28,
  during [#1593](https://github.com/museumwithnofrontiers/inventory-app/issues/1593)). When
  the importer merges an Explore monument into an already-imported record, the
  Explore identity survives on `collection_item.backward_compatibility` and
  nowhere else; no `"deduplicated"` key is added to the item. See
  [§ 4.2](#42-identity) for the resolution query and the reasoning.

Still open (minor, decide during viewer implementation):

- **Q5 — Partner map.** Legacy embeds Google Maps (needs an API key per
  deployment). Recommendation: a keyless replacement (static OSM embed or an
  external map link) — or drop the map and show address only.
