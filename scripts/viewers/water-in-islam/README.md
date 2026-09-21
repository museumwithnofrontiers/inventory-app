# Water in Islam — Viewer

A Vue 3 + Vite single-page application that reproduces the legacy
<https://exhibitions.museumwnf.org/water_in_islam/en> exhibition website while
reading a **static data package** instead of calling an API.

This is the second DXA **exhibition** viewer
([epic #1539](https://github.com/museumwithnofrontiers/inventory-app/issues/1539),
[story #1549](https://github.com/museumwithnofrontiers/inventory-app/issues/1549)), forked
from [`../the-use-of-colours-in-art`](../the-use-of-colours-in-art/README.md)
([#1547](https://github.com/museumwithnofrontiers/inventory-app/issues/1547)). Its data comes
from the matching exporter,
[`../../exporters/dxa-exhibition`](../../exporters/dxa-exhibition/README.md) (site note: [`../../exporters/instances/water-in-islam.md`](../../exporters/instances/water-in-islam.md));
its UI strings come from [`../../site-i18n`](../../site-i18n/README.md); the
legacy behaviour it reproduces is analysed in
[`../../exporters/docs/dxa-legacy-analysis.md`](../../exporters/docs/dxa-legacy-analysis.md).

Like the other DXA viewers, this is a **faithful rebuild of a public website**:
the legacy routes, page structure, field order and palette are reproduced rather
than reinterpreted.

## Why a second exhibition viewer

The page inventory is the Colours fork's, unchanged — `/about`, `/themes`,
`/theme/:id/:subtheme?/:image?`, `/theme-gallery`, `/related`, the institution
pages, the bottom banner, the sponsor strip and the pop-up. What is new is that
this exhibition exercises four rules the first one could not, and each was
verified against the live instance rather than assumed:

| | Colours | Water in Islam |
|---|---|---|
| Hidden museums (E6) | none | **11, six holding 51 members** |
| Chronology | its own 45 events | **none — the Timeline section is withheld** |
| Members with no English | none | **1 dropped, 6 shipped nameless in the package** |
| Source projects on the item sheet | 8 keys, one family untested | **7 families incl. `Explore`, which has no project key** |

Each of those is described in *Dataset specifics* below.

## Where the data comes from

`@museumwnf/water-in-islam-data` is published to npmjs and declared in
`package.json`, so `npm install` is all a normal build needs — no registry
auth required.

`vite.config.js` resolves the `@inventory-data` alias in this order:

1. `DATA_PACKAGE` — an npm package name **or** a directory path (explicit wins).
2. `@museumwnf/water-in-islam-data`, if installed. **This is the normal path** —
   CI, the deploy workflow and a plain `npm install` all land here.
3. `../../exporters/dxa-exhibition/output/water-in-islam` — a local exporter
   run, for working against data that has not been published yet.

For (3), produce the export from the repository root:

```bash
docker compose --profile jobs run --rm exporter dxa-exhibition --instance water-in-islam --force \
    --base-url https://inventory.metanull.eu
```

`--base-url` matters: without it the exporter writes relative
`./images/pub/<uuid>.jpg` paths and the photographs will not load. The compose
`exporter` service is pinned to the **staging** database;
`scripts/exporters/dxa-exhibition/.env` points at production and must not be
used casually.

Because (2) is checked before (3), an installed package shadows a local export.
Point `DATA_PACKAGE` at the export directory to override it.

Publishing a new version is the exporter's job — see
[`NPM_PUBLISH.md`](../../exporters/dxa-exhibition/NPM_PUBLISH.md). The deploy
workflow always installs `@latest` regardless of the lockfile, so a publish
reaches production on the next deploy without a code change here.

## Development

```bash
npm install
npm run dev          # Claude Code: launch.json entry
                     # "water-in-islam-viewer", port 4182
npm run build        # production build into dist/
npm run sync-i18n    # re-vendor the UI catalogue from scripts/site-i18n/output
```

After re-running the exporter, **restart the dev server** — Vite's dependency
pre-bundle cache serves the previous contents otherwise. On a Docker bind mount
the file watcher misses host edits too, so restart it after changing a source
file rather than waiting for HMR.

## Structure

```
src/
  App.vue                      header / nav / footer / popup / logo strip, the palette
  router/index.js              the legacy routes, one for one
  composables/
    useExhibitionData.js       the data-package access layer
    useThemePresentation.js    picture → parent record, captions, covers
    useUiStrings.js            UI strings, from the vendored catalogue
    useCollection.js           facets, year buckets, full-text search, paging
    useTimeline.js             whether this site has a Timeline at all, and which
    useGlossary.js             in-description term linking + the glossary tool
  components/                  banner, sub-banner, bottom banner, logos, popup, grid, paging, map
  views/                       one component per route
  i18n/en.json                 vendored UI catalogue (generated, committed)
```

### One language, and both fields agree

`thg_gallery_lang` and `exhibition_i18n.enabled` both say English alone, so
`languages` and `languages_enabled` are the same list, there is one build, and
the header carries no language switcher. They differ on Colours — German has
full theme translations and is never published — which is why the package
carries both fields rather than deriving one from the other, and why
`languages_enabled` is the field this build reads.

Record pages are unaffected: an item sheet or partner profile still offers the
languages *that record* carries, which here run to nine.

### UI strings are not data

About / Credits / every label come from `scripts/site-i18n/output`, never from
the data package (decision G3). That output is gitignored and regenerating it
needs a tunnel to the legacy database, so the *merged* catalogue is vendored
into `src/i18n/` and committed. `npm run sync-i18n` regenerates it: the shared
MWNF Exhibitions layer (group 59) with this exhibition's own six keys
(group 75) overlaid.

Two of those six — `txtCollection` and `txtPartners` — are page introductions
the curator wrote, and they link back into the exhibition by **absolute legacy
URL**, so `localiseLinks()` rewrites the ones pointing at this exhibition's own
sections into in-app routes and leaves every other link alone. There is no
`txtTimeline` here, because there is no Timeline; the shared layer supplies the
copy that the live instance still shows on that page.

**The overlay is case-insensitive, and this exhibition is why.** Its own layer
carries `Footer_logo_section_1` where the shared layer carries
`footer_logo_section_1`; the legacy strings live in MySQL under a `_ci`
collation, so nothing ever forced the two spellings to agree. A plain object
merge keeps both keys and the components read the lowercase one — which would
render the shared layer's placeholder, the literal string `LEFT MOST FOOTER
SECTION FOR LOGOS`, instead of the curator's "Under the patronage of". The live
instance renders "Under the patronage of". `sync-i18n.mjs` therefore matches
keys case-insensitively and keeps the *shared* spelling with the *site's* value.

## Dataset specifics

- **Eleven hidden museums, and it is the museum that hides, not the object.**
  `exhibition.json.hidden_partner_ids` is legacy's E6 rule. Six of the eleven
  hold 51 members between them — `us/Mus82`, the Metropolitan, holds 26 — so
  dropping the partner records instead of flagging them would leave those items
  pointing at nothing. Three surfaces enforce it and they are all the surfaces
  there are: the `/partners` list (`visiblePartners`), the profile and objects
  routes (`partnerFromKey` returns nothing for a hidden id, so a URL typed or
  bookmarked from the live site lands on the not-found page), and the item
  sheet, which keeps the museum's **name** and drops the link. Legacy links no
  holder from an item sheet at all, so that last one is also the closer copy.

  This is what makes the partner count add up. Legacy answers `/partners` with
  98 and `/institutions` with 21, two rows appear on both, and the package ships
  128: `128 − 11 = 117 = 98 ∪ 21`. Comparing raw counts looks like an
  11-partner overcount.

- **`has_timeline: false` does not mean "no timeline data", and it hides more
  than the nav entry.** Both chronology flags are false, and `timelines.json`
  still ships 37 timelines and 1,390 events — every DXA site gets the worldwide
  26-country merge whatever its flags say. The flags gate navigation. On the
  live instance the word "timeline" appears nowhere: not in the nav, not as
  "Timeline for this item" on the item sheet, not as "Timeline for this Search"
  on collection results. All three read the same `hasTimeline` in
  `useTimeline.js`. The **routes** stay reachable, because legacy's do — typing
  `/timeline` on the live instance still renders the page and its introduction.

- **A member whose text is in another language is not listed.** The package
  ships all 495 members with their `languages` arrays intact and leaves the
  decision to the build, which is right: it is a per-language question. One
  record — `mwnf3:objects:GalEx6:es:Mus81:4`, "Brocal de pozo" — has Spanish and
  no English, and legacy agrees, serving it from `/es` and 404ing on `/en`. It
  is dropped here, so the site lists 494. An **empty** `languages` array is a
  different case and is deliberately not swept in with it — see *Known
  differences*.

- **Source projects are coloured by family, not by key.** Legacy's
  `#info-citation-link` takes one class per project family, so ISL and EPM share
  a swatch and every exhibition shares another. The mapping and the per-key
  names live in `useExhibitionData.js` — one table, where the Colours fork had
  two copies, in `ObjectGrid` and `ItemSheet`. Both were read off the live
  instance: the classes and colours from its compiled stylesheet, the names and
  the key → family assignment by loading one member of each family and reading
  `#info-project-name`. Two things only this dataset could show: `DGA` is
  `#0059bf` "Discover Glass Art" and not the `#006950` the Colours fork gave it
  (that green belongs to `Explore`, and Colours has no DGA member to reveal the
  swap); and one member, `mwnf3_explore:monument:1813`, has **no project key at
  all**. It comes from the Explore monuments database rather than a project.
  Legacy still colours it — the `Explore` class — and still prints an empty
  project name, so its citation reads `"…" in , Museum With No Frontiers, 2026.`
  with a hole in it. The colour is reproduced from the keyspace; the empty name
  is not, because "for" with nothing after it reads as a rendering fault.

- **The About page is a theme, not a field**, as on Colours: `abouts` is empty
  and so is the live API's `exhibitionAbout`. `/about` mounts the theme page
  with theme 0 and substitutes the exhibition's title and sub-title. That is
  also why `/themes` starts at display order 2 and labels it "Theme I", and why
  `/theme/:id` carries `display_order - 1` — a legacy theme URL pasted after the
  `#` lands on the same page. Five themes are listed here, Theme I to Theme V,
  with 22 sub-themes and 432 curated pictures.

- **Item URLs keep the legacy dbUid**, `backward_compatibility` with `:` swapped
  for `/`.

- **The curated texts live on the theme pivot**, keyed both by theme id and by
  `<theme id>/<picture item id>`, so the same picture in two themes carries two
  different descriptions.

- **Palette** read off the live instance's own compiled stylesheet, because the
  exhibitions client takes its six colours from per-deployment `VUE_APP_VO_*`
  variables rather than a checked-in SCSS file: `#000000` main, `#ffffff`
  secondary, `#a3d6d9` contrast. Only the contrast tone moves between these two
  exhibitions — Colours runs `#64bfd9` — which is why every rule reads a
  variable.

- **The nav sizes itself.** With no TIMELINE entry there are seven items, not
  eight, so the bar is one column per entry rather than a fixed eight; the
  inherited `repeat(8, 1fr)` left an empty cell at the end.

## Known differences from the live legacy site

**Package gaps surfaced by the viewer** (exporter- or importer-side)

Two gaps this viewer surfaced at build time were fixed in the importer on
2026-08-29 and are no longer present: `related_content.json` shipped 0 entries
where legacy renders five bibliographies, and six members shipped with
`languages: []` and no row in any `translations/items.*.json`. The first is now
`kind: "text"` entries read off the exhibition collection's
`extra.further_readings`; the second was `planTranslations` dropping a whole
language row whenever its description was empty, which cost 51 records across
the corpus their names and technical fields — 23 of them in Colours. Both fixes
require a reimport to appear in a package.

- **Related-content category names are not in the package** (inherited): legacy
  reads them from `related_content_category`, which the importer does not carry,
  so the four English names are a ported constant in `RelatedContent.vue`.

- **Theme audio and video are not shipped** (inherited): the specification puts
  them on `themes.json`, the export carries none.

**Deliberately not reproduced**

- **The fixed backdrop photograph.** Legacy paints
  `homepage_image_path` across the viewport behind the page container at 50%
  opacity under a 40% black wash (`#app:before` / `#app:after`), with the page
  container itself transparent. This viewer keeps the opaque page container it
  inherited from the gallery forks, so the backdrop does not show. The package
  carries the path; reproducing it means making every section paint its own
  background, and doing it here alone would make the two exhibition viewers
  diverge in more than their contrast colour. Both live exhibitions have it.
- Routing is hash-based (`#/themes`), as in the other viewers, so the site needs
  no server rewrite rules. The path after the `#` is the legacy path unchanged.
- The partner and institution routes drop legacy's project-id segment:
  `partners.project_id` is null for every imported museum.
- Legacy's glossary linker emits one empty `<a class="glossary-link">` per page;
  this viewer makes a single pass.
- The theme gallery defaults to the theme's own selections **plus** its
  sub-themes'. Legacy looped over sub-themes only, which produced the literal
  string `"undefined"` in its query for a theme with none.

## Open decision — the partner-profile map

Inherited and unchanged: legacy embedded **Google Maps** with a per-deployment
API key, a key baked into a static bundle is a published secret, so this viewer
implements the keyless **OpenStreetMap** alternative the epic recommended.
Everything provider-specific lives in `src/components/PartnerMap.vue`. **This is
a decision for the owner to confirm.**

## Deployment

`.github/workflows/deploy-viewer-water-in-islam-ovh.yml` builds with
`--base=/water-in-islam/` and deploys `dist/` to `/opt/water-in-islam/` on the
OVH VPS. See [`../README.md`](../README.md) for the shared deployment mechanics.
Neither the directory nor the Nginx block is created by the workflow — both are
manual, once per viewer:

```bash
sudo install -d -o deploy -g deploy -m 755 /opt/water-in-islam
```

```nginx
location /water-in-islam {
    alias /opt/water-in-islam;
    index index.html;
    try_files $uri $uri/ /water-in-islam/index.html;
}
```

`index index.html` is not optional — without it the server-level `index
index.php` is inherited and a directory request answers 403.
