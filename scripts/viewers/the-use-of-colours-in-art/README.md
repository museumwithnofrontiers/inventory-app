# The Use of Colours in Art — Viewer

A Vue 3 + Vite single-page application that reproduces the legacy
<https://exhibitions.museumwnf.org/the_use_of_colours_in_art/en> exhibition
website while reading a **static data package** instead of calling an API.

This is the first DXA **exhibition** viewer
([epic #1539](https://github.com/metanull/inventory-app/issues/1539),
[story #1547](https://github.com/metanull/inventory-app/issues/1547)), forked
from [`../carpets`](../carpets/README.md). Its data comes from the matching
exporter,
[`../../exporters/the-use-of-colours-in-art`](../../exporters/the-use-of-colours-in-art/README.md);
its UI strings come from [`../../site-i18n`](../../site-i18n/README.md); the
legacy behaviour it reproduces is analysed in
[`../../exporters/docs/dxa-legacy-analysis.md`](../../exporters/docs/dxa-legacy-analysis.md).

Like the amulets and carpets viewers, this is a **faithful rebuild of a public
website**: the legacy routes, page structure, field order and palette are
reproduced rather than reinterpreted.

## An exhibition is a gallery plus a curated layer

The database half of the site — collection search and results, item sheets,
partners, free-text search — is the gallery client's, and is inherited from the
carpets fork unchanged. What is new is everything the legacy
`exhibitions-client` has and `dxa-client` does not:

| Route | Page |
|---|---|
| `/about` | The About theme, rendered as a theme page under the exhibition's own title |
| `/themes` | The accordion of top-level themes |
| `/theme/:id/:subtheme?/:image?` | The theme tour: thumbnail strip, selected picture, curated text, related works |
| `/theme-gallery/:id/:subtheme?` | Every record a theme touches, as a results grid |
| `/related` | The categorised reading list |
| `/institution/…`, `/institution-monuments/…` | Monument-owning institutions |

Plus three pieces of chrome: the bottom banner (ABOUT / THEMES), the sponsor
logo strip, and the dismissible pop-up notice.

### The About page is a theme, not a field

`exhibition.json` carries an `abouts` map and it is **empty** — which is
correct, because the live API's `exhibitionAbout` is `null` too. Legacy's
`/about` route mounts `ThemeComponent` with theme 0 and substitutes the
exhibition's title and sub-title for the theme's; the introduction a visitor
reads is theme 0's presentation and its seven curated pictures. This viewer does
the same, through a `Theme.vue` with `about-mode` set.

That also explains the theme numbering. `/themes` starts at display order 2 and
labels it "Theme I", because display order 1 is the About theme; and
`/theme/:id` carries `display_order - 1`, exactly as legacy did, so a legacy
theme URL pasted after the `#` lands on the same page.

## Where the data comes from

`@museumwnf/the-use-of-colours-in-art-data` is published to npmjs and
declared in `package.json`, so `npm install` is all a normal build needs —
no registry auth required.

`vite.config.js` resolves the `@inventory-data` alias in this order:

1. `DATA_PACKAGE` — an npm package name **or** a directory path (explicit wins).
2. `@museumwnf/the-use-of-colours-in-art-data`, if installed. **This is the
   normal path** — CI, the deploy workflow and a plain `npm install` all land here.
3. `../../exporters/the-use-of-colours-in-art/output/the-use-of-colours-in-art`
   — a local exporter run, for working against data that has not been published
   yet.

For (3), produce the export from the repository root:

```bash
docker compose --profile jobs run --rm exporter the-use-of-colours-in-art --force \
    --base-url https://inventory.metanull.eu
```

`--base-url` matters: without it the exporter writes relative
`./images/pub/<uuid>.jpg` paths and the photographs will not load. The compose
`exporter` service is pinned to the **staging** database; `.env` files under
`scripts/exporters/` point at production and must not be used casually.

Because (2) is checked before (3), an installed package shadows a local export.
Point `DATA_PACKAGE` at the export directory to override it.

Publishing a new version is the exporter's job — see
[`NPM_PUBLISH.md`](../../exporters/the-use-of-colours-in-art/NPM_PUBLISH.md).
The deploy workflow always installs `@latest` regardless of the lockfile, so a
publish reaches production on the next deploy without a code change here.

## Development

```bash
npm install
npm run dev          # Claude Code: launch.json entry
                     # "the-use-of-colours-in-art-viewer", port 4181
npm run build        # production build into dist/
npm run sync-i18n    # re-vendor the UI catalogue from scripts/site-i18n/output
```

After re-running the exporter, **restart the dev server** — Vite's dependency
pre-bundle cache serves the previous contents otherwise.

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
    useTimeline.js             which chronology this site's Timeline shows
    useGlossary.js             in-description term linking + the glossary tool
  components/                  banner, sub-banner, bottom banner, logos, popup, grid, paging, map
  views/                       one component per route
  i18n/en.json                 vendored UI catalogue (generated, committed)
```

### One language, on purpose

`thg_gallery_lang` lists de and en, but `exhibition_i18n.enabled` is `'N'` for
German and the live German instance is a shell (`exhibitionTitle: null`,
`items/count: 5`). Per decision Q2 an exhibition ships **one build per enabled
language**, and `languages_enabled` holds English alone — so there is no
language switcher in the header, and `sync-i18n` vendors `en.json` only. The
package still carries the German curated texts, so a `de` build becomes possible
the day someone flips the flag.

Record pages are unaffected: an item sheet or partner profile still offers the
languages *that record* carries, which here run to ten.

### UI strings are not data

About / Credits / every label come from `scripts/site-i18n/output`, never from
the data package (decision G3). That output is gitignored and regenerating it
needs a tunnel to the legacy database, so the *merged* catalogue is vendored
into `src/i18n/` and committed. `npm run sync-i18n` regenerates it: the shared
MWNF Exhibitions layer (group 59) with this exhibition's own nine keys
(group 65) overlaid.

Three of those nine — `txtCollection`, `txtPartners`, `txtTimeline` — are page
introductions the curator wrote, and they link back into the exhibition by
**absolute legacy URL**. Left alone those would send a visitor to the site this
one replaces, so `localiseLinks()` rewrites the ones that point at this
exhibition's own sections into in-app routes and leaves every other link alone.
The gallery client hardcoded equivalent copy in English instead; the exhibitions
client reads the catalogue, and so does this.

## Dataset specifics

- **The Timeline is the exhibition's own chronology, not the worldwide one.**
  `has_country_timeline` is false and `has_timeline` is true, so legacy's
  TimelinePage renders no country picker and TimelineResults reads
  `/thg/timeline` — 45 curated events captioned by their own period names
  ("ca. 50.000-30.000 BCE"), filtered by year alone. The package ships **both**
  chronologies and `useTimeline.js` selects between them on the same flag; the
  worldwide 1,390-event merge is still there, unused by this site.
- **Item URLs keep the legacy dbUid.**
  `/database-item/mwnf3/objects/EXHCOLOUR/uk/Mus52/1/en` is
  `backward_compatibility` with `:` swapped for `/`.
- **The curated texts live on the theme pivot.** `translations/themes.en.json`
  is keyed both by theme id (title, quote, presentation) and by
  `<theme id>/<picture item id>` (the contextual description and image caption).
  The same picture in two themes carries two different descriptions, which is
  why the page reads the pivot rather than the picture.
- **Theme pictures are not member items.** A selection points at a `picture`
  child, which is not in `items.json`; every label and the "See Database entry"
  link come from its **parent**, and `parent_in_package` says whether that
  parent resolves. One picture in this exhibition has a parent that is not a
  member, and the sheet says so instead of linking nowhere.
- **"Add Related Works" is a filter, not a fetch.** A picture that is the
  *target* of a `theme_item_related` row is hidden from the thumbnail strip
  until the toggle is on — which is what keeps the strip to the curator's
  primary selection, exactly as legacy did.
- **Sponsor logos are grouped, captioned and linked**, as in legacy: category 0
  is "Header" and renders beside the MWNF mark under `header_logo_section_1`,
  categories 1–4 render in the footer strip under `footer_logo_section_<n>`, a
  logo with `visible: false` is dropped, and an emptied category loses its
  heading too. All of that arrived with
  [#1592](https://github.com/metanull/inventory-app/issues/1592), which put
  `link`, `category_id`, `visible` and the per-language `labels` into
  `collection_images.extra` — before it, the package carried the image and the
  display order and nothing else.
- **Institutions and museums share one list.** `partners.json` is the union of
  legacy's `/partners` and `/institutions`, and the viewer routes by partner
  `type`. The package's split is 71 museums / 14 institutions where legacy's two
  endpoints report 75 / 11 with two rows on both — so three partners reach an
  institution page here that legacy shows on the partner list. The pages differ
  only in three labels.
- **Palette** read off the live instance's own compiled stylesheet, because the
  exhibitions client takes its six colours from per-deployment `VUE_APP_VO_*`
  variables rather than a checked-in SCSS file: `#000000` main, `#ffffff`
  secondary, `#64bfd9` contrast. Colours happens to run the platform defaults; a
  sibling exhibition will not, which is why every rule reads a variable.

## Known differences from the live legacy site

**Package gaps surfaced by the viewer** (exporter- or importer-side)

- **Related-content category names are not in the package.** Legacy reads them
  from `related_content_category`, which the importer does not carry, so
  `related_content.json` ships `category_id` alone. The four English names are a
  ported legacy constant in `RelatedContent.vue`, in the same class as the
  timeline's year-bucket algorithm.
- **Theme audio and video are not shipped.** The specification puts
  `theme_audio` / `theme_video` on the `themes.json` entries' `media` arrays;
  the export carries none, so the "Related audio/videos" block legacy renders
  under a theme has no counterpart here.

**Deliberately not reproduced**

- Routing is hash-based (`#/themes`), as in the other viewers, so the site needs
  no server rewrite rules. The path after the `#` is the legacy path unchanged.
- The partner and institution routes drop legacy's project-id segment
  (`/partner/dz/Mus01/en`, not `/partner/ISL/dz/Mus01/en`): `partners.project_id`
  is null for every imported museum, so there is nothing to put there.
- Legacy's glossary linker emits one empty `<a class="glossary-link">` per page,
  because it rewrites the text once per term and later terms match inside
  anchors earlier ones inserted. This viewer makes a single pass.
- The theme gallery defaults to the theme's own selections **plus** its
  sub-themes'. Legacy looped over sub-themes only, which produced the literal
  string `"undefined"` in its query and an empty grid for a theme with none.

## Open decision — the partner-profile map

Inherited from the amulets fork and unchanged: legacy embedded **Google Maps**
with a per-deployment API key, a key baked into a static bundle is a published
secret, so this viewer implements the keyless **OpenStreetMap** alternative the
epic recommended. Everything provider-specific lives in
`src/components/PartnerMap.vue`. **This is a decision for the owner to confirm.**

## Deployment

`.github/workflows/deploy-viewer-the-use-of-colours-in-art-ovh.yml` builds with
`--base=/the-use-of-colours-in-art/` and deploys `dist/` to
`/opt/the-use-of-colours-in-art/` on the OVH VPS. See
[`../README.md`](../README.md) for the shared deployment mechanics. The Nginx
alias block still has to be added on the server:

```nginx
location /the-use-of-colours-in-art {
    alias /opt/the-use-of-colours-in-art;
    index index.html;
    try_files $uri $uri/ /the-use-of-colours-in-art/index.html;
}
```
