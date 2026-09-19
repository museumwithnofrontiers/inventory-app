# Carpets Viewer

A Vue 3 + Vite single-page application that reproduces the legacy
<https://carpets.museumwnf.org> gallery website while reading a **static data
package** instead of calling an API.

This is the viewer half of the second DXA gallery pilot
([epic #1539](https://github.com/museumwithnofrontiers/inventory-app/issues/1539),
[story #1545](https://github.com/museumwithnofrontiers/inventory-app/issues/1545)). Its
data comes from the matching exporter,
[`../../exporters/carpets`](../../exporters/carpets/README.md); its UI strings
come from [`../../site-i18n`](../../site-i18n/README.md); the legacy behaviour
it reproduces is analysed in
[`../../exporters/docs/dxa-legacy-analysis.md`](../../exporters/docs/dxa-legacy-analysis.md).

It is **forked from [`../amulets`](../amulets/README.md)**
([#1543](https://github.com/museumwithnofrontiers/inventory-app/issues/1543)) — the two
galleries share one legacy codebase, so they share routes, page structure and
facet behaviour. Viewers are forked per dataset by design and are expected to
diverge; the sections below are the places where this one already does.

Like amulets — and unlike the first three viewers, which are verification tools
for their packages — this is a **faithful rebuild of a public website**: the
legacy routes, page structure, field order, facet behaviour and palette are
reproduced rather than reinterpreted.

## Where the data comes from

`@museumwnf/carpets-data` is published to npmjs and declared in
`package.json`, so `npm install` is all a normal build needs — no registry
auth required.

`vite.config.js` resolves the `@inventory-data` alias in this order:

1. `DATA_PACKAGE` — an npm package name **or** a directory path (explicit wins).
2. `@museumwnf/carpets-data`, if installed. **This is the normal path** — CI, the
   deploy workflow and a plain `npm install` all land here.
3. `../../exporters/carpets/output/carpets` — a local exporter run, for working
   against data that has not been published yet.

For (3), produce the export from the repository root:

```bash
docker compose --profile jobs run --rm exporter carpets --force \
    --base-url https://inventory.metanull.eu
```

`--base-url` matters: without it the exporter writes relative
`./images/pub/<uuid>.jpg` paths, and the item photographs will not load. The
compose `exporter` service is pinned to the **staging** database; `.env` files
under `scripts/exporters/` point at production and must not be used casually.

Because (2) is checked before (3), an installed package shadows a local export.
Point `DATA_PACKAGE` at the export directory to override it.

Publishing a new version is the exporter's job, not the viewer's — see
[`../../exporters/carpets/NPM_PUBLISH.md`](../../exporters/carpets/NPM_PUBLISH.md).
The deploy workflow always installs `@latest` regardless of the lockfile, so a
publish reaches production on the next deploy without a code change here.

## Development

```bash
npm install
npm run dev          # Claude Code: launch.json entry "carpets-viewer", port 4180
npm run build        # production build into dist/
npm run sync-i18n    # re-vendor the UI catalogue from scripts/site-i18n/output
```

After re-running the exporter, **restart the dev server** — Vite's dependency
pre-bundle cache serves the previous contents otherwise.

## Structure

```
src/
  App.vue                      header / nav / banner / footer, the palette
  router/index.js              the legacy routes, one for one
  composables/
    useGalleryData.js          the data-package access layer
    useUiStrings.js            UI strings + RTL, from the vendored catalogue
    useCollection.js           facets, year buckets, full-text search, paging
    useTimeline.js             the global country chronology
    useGlossary.js             in-description term linking + the glossary tool
  components/                  banner, sub-banner, results grid, paging, map…
  views/                       one component per route
  i18n/{ar,en,es,fr}.json      vendored UI catalogue (generated, committed)
```

### UI strings are not data

About / Credits / How-to-search / every label come from
`scripts/site-i18n/output`, never from the data package (decision G3). That
output is gitignored and regenerating it needs a tunnel to the legacy
database, so the *merged* catalogue is vendored into `src/i18n/` and
committed. `npm run sync-i18n` regenerates it: the shared MWNF Galleries layer
(group 59) with the Carpets site's own keys overlaid — `galleryAbout` and
`galleryCredits` in English, `goToFullSearch` in each of ar/es/fr.

The catalogues are deliberately **not padded with English**: most of the
chrome falls back to English exactly as it did in legacy. Text that has fallen
back is pinned `dir="ltr"` even when the page is right-to-left, because English
set RTL reads wrongly.

The site slug is `carpets`, which is also the folder name — the one gallery
where the two coincide. That is a coincidence: `tools/sync-i18n.mjs` spells the
slug out rather than deriving it from the directory, as does `gallery.json`.

### Languages and RTL

Two language axes meet here, as they did in legacy:

- **Chrome** — the gallery's four UI languages (`ar`, `en`, `es`, `fr`, from
  `thg_gallery_lang`), switchable in the header. Arabic flips the document to
  `dir="rtl"`. Legacy pinned its chrome to English (`loadLocaleMessages("en")`
  in its `App.vue`); the switcher is this viewer's one addition.
- **Records** — each item sheet and partner profile offers the languages *that
  record* carries, which may include `cs`, `de`, `el`, `it`, `pt`, `tr` that
  the site UI never offers, and may lack ones it does.

### Never a fabricated URL (decision Q3)

Legacy resolved its cross-site links from a hand-maintained table with no
counterpart in the new model. The package therefore carries each outbound link
as identity plus whatever metadata the import held, and this viewer renders
what is resolvable and degrades visibly for the rest:

| Reference | Rendered as |
|---|---|
| Sibling galleries | A link when `legacy_host` came across, an inert tile otherwise |
| Related item, `in_package: true` | A local link to its sheet |
| Related item, `in_package: false` | Its project key and dbUid, marked "not in this gallery" |
| "On display in" gallery/exhibition | A link to that site's **home page** only — never a constructed deep item path |
| Source database | The project name and the dbUid, no link |

## Dataset specifics

Carpets is the **hybrid** gallery, and that is what it exercises. Amulets owns
nothing (45 borrowed items, one project); carpets has 486 members of which 398
are native DCA records, drawn from **seven** source projects.

- **Seven projects on one site.** `project_key` is per item, so a native DCA
  carpet, a borrowed EPM object and a Sharing History record each name their
  own source database and resolve their own translation context. Two of the
  seven — `EXTHE` ("The Table Is Set") and `GALLERIES` ("MWNF Galleries") —
  never appear on amulets, so this fork adds them to the `PROJECT_NAMES` map
  in `ItemSheet.vue` and `ObjectGrid.vue` and gives `EXTHE` the exhibition
  colour chip legacy used for exhibition-sourced entries.
- **Item URLs keep the legacy dbUid.** `/database-item/mwnf3/objects/DCA/uk/Mus31/19/en`
  is `backward_compatibility` with `:` swapped for `/` — paste a legacy URL
  after the `#` and it lands on the same sheet.
- **`short_description` is the EPM-context text**, for native and borrowed
  items alike. All 59 EPM-native members carry a short description and none
  carries a long one; the sheet then relabels the short one plain
  "Description:", exactly as legacy did.
- **Five facets, one superset.** The dropdowns are built from `tags.json` with
  its categories intact: type (82), dynasty (22), subject (30), material (103)
  — and *artist* (11), which the legacy client never offered a dropdown for.
  Any facet with no values in the current result set is hidden. Per-language
  `keywords` and `materials` on item translations are free-text sheet lines and
  are **not** mixed in.
- **50 of the 486 members carry no facet tag at all**, so no combination of
  dropdowns reaches them. Legacy behaves the same way — the tag totals match
  exactly — and the free-text search is the only route to those records.
- **Facets are dependent.** Legacy re-queried `/items/tags`, `/items/countries`
  and `/items/years` with the current filters applied; here every vocabulary is
  recomputed from the surviving subset. The year buckets are a verbatim port of
  the legacy client's own algorithm (500 → 250 → 100 → 50 steps, an explicit
  "Before 1000 B.C." bucket, an "After …" label on a short final step) because
  the option values end up in shareable URLs. Carpets' range is −10200 to 2045.
- **Free-text search** implements the boolean full-text grammar the
  How-to-search page documents (`+`, `-`, `*`, `""`, `~`, `<`, `>`)
  client-side, since a static site has no MySQL.
- **`featured` means what it says.** The package ships `thg_gallery.featured =
  'A'` as `true`; the live API reports `false` because of a defect in dxa-api.
  Carpets is the mirror image of the amulets case (which stores `'H'` and reads
  back `true`), which is why the defect is certain. This is the one place a
  live-API comparison is expected to disagree.
- **Gallery chrome images are legacy-hosted.** `image_path` /
  `banner_image_path` (`thematic_gallery/thg_galleries/9/{1,banner}.jpg`) were
  never imported, so the package ships the path and the viewer supplies the
  host (`VITE_LEGACY_IMAGES_URL`, default `https://images.museumwnf.org`) — the
  one exception to the absolute-image-URL convention.
- **Palette** ported verbatim from
  `.legacy-code/dxa-client/src/sites/dca/_variables.scss` (the legacy env key
  for Carpets is `dca`, not `carpets`): `#504819` banner and footer, `#6b612b`
  / `#91864d` alternating menu rows, `#7e743e` accents, `#fffff0` page. Olive,
  where amulets is terracotta — nothing is shared. Centralised in the `:root`
  variables in `App.vue`, including `--theme-dark-rgb` for the two translucent
  overlays (sub-banner bar, results-grid hover card) that the amulets fork had
  hardcoded.

## Partners that hold no object

Carpets is the first gallery where legacy's **MWNF-384** partner branch fires,
and it changes what the partners page has to render.

Legacy's partner query is a three-branch UNION; the third branch selects every
museum *created under the gallery's own project*, whether or not it holds a
member item. On carpets that is `jo/Mus31` (Greater Amman Municipality) and
`pt/Mus31` (Centro de História d'Aquém e d'Além-Mar), both created under DCA,
both returned by the live `/partners` with `hasObjects: 0`, and both the
difference between 70 and legacy's **72**. The package ships them with
`item_count: 0` after
[#1589](https://github.com/museumwithnofrontiers/inventory-app/issues/1589) carried
`museums.project_id` through the importer.

**Decision: they are listed, in full.** Legacy lists them, so hiding them would
be a regression against the site this viewer reproduces. Concretely:

| Element | Zero-item partner |
|---|---|
| Entry on `/partners` | Present — name, city, logo, country grouping, all as usual |
| "Read more" → profile | Shown |
| "View objects" | **Withheld**, which is exactly what legacy does (`v-if="partner.hasObjects"`) |
| Object-count line | "Project Partner — no objects in this Gallery" |
| Partner profile page | Renders normally; the "View Objects" button is withheld |
| Featured-partners carousel | Its "View objects" link is withheld if one is ever drawn |

The count line is the one element with no legacy counterpart — legacy prints no
count on the partners page at all; it is an amulets-fork addition. Left alone
it would have read "0 objects in this Gallery", which reads as a data fault
rather than as a fact about the partner, so a zero-count partner gets a line
naming the reason it is on the list instead.

Legacy's "Partner / Affiliate" badge is still omitted, as on amulets: it
describes a partner's relation to a *project*, and `partners.project_id` in the
inventory model is the museum's **creating** project, which is a different
thing. Rendering it from that column would state something legacy did not.

## Verified against the package — 2026-08-28

Served from a local export taken after a full legacy re-import of the staging
database. Every figure below is what the running viewer showed, and every one
matches the exporter's
[`VALIDATION-2026-08-27.md`](../../exporters/carpets/tools/VALIDATION-2026-08-27.md).

| Page | Checked | Result |
|---|---|---|
| Collection | facet vocabularies | country 26, type 82, dynasty 22, subject 30, material 103, artist 11 |
| Collection | year buckets | 20 steps, `Before 1000 B.C.` … `After 2000 A.D.` (range −10200 – 2045) |
| Collection results | `country=at` | "33 result(s) out of 486 objects", 9/page; facets narrow to 23/36/17/16/60 and the empty artist dropdown disappears |
| Search | `+silk +prayer` | 10 of 486 |
| Item sheet | `DCA/uk/Mus31/19` (banner object) | every legacy field, 4 photos with credits, "Glasgow, Scotland" |
| Item sheet | `EPM/us/Mus23/6` in `ar` | full RTL, record languages ar/en only, EIAC notice, short description relabelled "Description:" |
| Item sheet | `EXTHE`, `GALLERIES` members | named "The Table Is Set" / "MWNF Galleries", not the bare key |
| Item sheet | "Search related database" | present on ISL/EPM/AWE/BAR, absent on DCA/EXTHE/GALLERIES |
| Partners | list | 72 partners over 26 countries, 2 of them zero-item |
| Partner profile | `jo/Mus31` | renders in 9 record languages, no "View Objects" button |
| Timeline | country picker | 26 countries + "All", no duplicates, no numeric codes, `ua`→UAE, `sb`→Serbia, `cz`→Czech Republic, no North Macedonia |
| Timeline results | per country | Türkiye 98 (60+38, year-interleaved), Morocco 78, Egypt 68, Algeria 60, Austria 22 |

Two fields were empty or unresolvable in that export because the re-import had
not finished its own later steps, **not** because of anything in this viewer or
the exporter:

- `glossary.json` is empty (`item_translation_spelling` had no rows yet), so
  no in-description term is linked and the glossary tool has nothing to find.
- Most item and partner photographs 404: `image-sync` failed for 18,910 images
  (the legacy image tree was not fully available), leaving `item_images.path`
  as a legacy path rather than an inventory UUID, so the absolute URLs point at
  files the media host does not have. 160 of the 486 members did get synced
  images, and those load.

## Known differences from the live legacy site

The differences below are inherited from the amulets fork, whose page-by-page
comparison against the live legacy site was made on 2026-08-27, plus the
carpets-specific items the exporter's
[`VALIDATION-2026-08-27.md`](../../exporters/carpets/tools/VALIDATION-2026-08-27.md)
records.

**Legacy defects not reproduced**

- `/events` ignores its `ya`/`yo` parameters, so the live timeline returns a
  country's whole chronology whatever period you pick. This viewer filters.
- The in-description glossary linker emits one empty `<a class="glossary-link">`
  per sheet, because it rewrites the text once per term and later terms match
  inside anchors earlier ones inserted. This viewer makes a single pass.
- Legacy's "On display in → MWNF Galleries" lists the gallery you are already
  on; the package omits the exporting gallery from `gallery_references`.

**Package gaps surfaced by the viewer** (exporter-side, not viewer-side)

- `materials` reaches the sheet as a tag-derived list, so its order and casing
  differ from the legacy free-text line.
- The legacy sheet's `dynastyDescription` free text is not in the package; the
  sheet shows the linked dynasty names.
- `notice` and `notice_c` are not imported, so those two legacy sheet rows
  never appear. Neither is a loss: `notice` holds one typo'd `&nbps;` on every
  row that has it, and `notice_c` was never rendered by any legacy client.
  `scriber`, `binding` and `workshop` **were** listed here as missing and are
  not — they were always in the package, and the sheet has rendered them since
  [#1640](https://github.com/museumwithnofrontiers/inventory-app/pull/1640); `notice_b` is
  the rights line, imported as `copyright` since
  [#1629](https://github.com/museumwithnofrontiers/inventory-app/issues/1629).
- EPM `author` / `copy_editor` are filed on the Arabic row only. The sheet
  falls back to the record's other languages for those two fields — proper
  names are language-independent — which restores the legacy attribution line.
- Item↔glossary links are re-derived from the text rather than read from
  legacy's curated `glossary_index`, so a sheet can show slightly fewer terms
  than legacy did (the banner object: 2 against legacy's 3, because "Dar" is
  in the curated index but is not a word in the description).
- `location` is *richer* than legacy's: the importer merges `location` +
  `province`, so the banner object reads "Glasgow, Scotland" where the live API
  says "Glasgow". Do not "correct" this.
- The sheet's legacy "See also → Related MWNF Travel Book" link has no
  counterpart in the package (nothing in the exporter carries a travel-book
  reference), so the section never renders. The catalogue keys `seeAlso` and
  `travelBook` are vendored and unused for that reason. Inherited from the
  amulets fork; not carpets-specific.

**Deliberately not reproduced**

- Free-text search covers a wider field set than legacy's FTS index (it also
  reads materials, keywords, holder and country), so a query can return a
  superset.
- Legacy suppressed every "On display in" exhibition link whose host was
  `exhibitions.museumwnf.org`. Decision Q3 says outbound links must not be
  dropped, so they are rendered.
- The "Partner / Affiliate" badge — see above.
- Routing is hash-based (`#/collection`), as in the other four viewers, so
  the site needs no server rewrite rules. The path after the `#` is the legacy
  path unchanged.
- The partner route drops legacy's project-id segment
  (`/partner/jo/Mus31/en`, not `/partner/DCA/jo/Mus31/en`).

## Open decision — Q5, the partner-profile map

Legacy embedded **Google Maps** with a per-deployment API key. CLAUDE.md
forbids hardcoded secrets, and a key baked into a static bundle is a published
secret however it is injected, so this viewer keeps the keyless alternative the
amulets fork implemented: an **OpenStreetMap embed** centred on the partner's
own coordinates at the record's zoom level, plus a link out to the full map.

Everything provider-specific lives in `src/components/PartnerMap.vue` and
nothing outside it knows which provider is in use. **This is a decision for the
owner to confirm, not one this story settled.**

## Deployment

`.github/workflows/deploy-viewer-carpets-ovh.yml` builds with
`--base=/carpets/` and deploys `dist/` to `/opt/carpets/` on the OVH VPS;
Nginx serves it at https://inventory.metanull.eu/carpets/ via an alias block.
See [`../README.md`](../README.md) for the shared deployment mechanics.
