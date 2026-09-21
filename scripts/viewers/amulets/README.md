# Amulets and Talismans Viewer

A Vue 3 + Vite single-page application that reproduces the legacy
<https://amulets.museumwnf.org> gallery website while reading a **static data
package** instead of calling an API.

This is the viewer half of the first DXA gallery pilot
([epic #1539](https://github.com/museumwithnofrontiers/inventory-app/issues/1539),
[story #1543](https://github.com/museumwithnofrontiers/inventory-app/issues/1543)). Its
data comes from the matching exporter,
[`../../exporters/dxa-gallery`](../../exporters/dxa-gallery/README.md) (site note: [`../../exporters/instances/amulets.md`](../../exporters/instances/amulets.md)); its UI strings
come from [`../../site-i18n`](../../site-i18n/README.md); the legacy behaviour
it reproduces is analysed in
[`../../exporters/docs/dxa-legacy-analysis.md`](../../exporters/docs/dxa-legacy-analysis.md).

Unlike the first three viewers — which are verification tools for their
packages — this one is a **faithful rebuild of a public website**: the legacy
routes, page structure, field order, facet behaviour and palette are
reproduced rather than reinterpreted.

## Where the data comes from

`@museumwnf/amulets-data` is published to npmjs and declared in
`package.json`, so `npm install` is all a normal build needs — no registry
auth required.

`vite.config.js` resolves the `@inventory-data` alias in this order:

1. `DATA_PACKAGE` — an npm package name **or** a directory path (explicit wins).
2. `@museumwnf/amulets-data`, if installed. **This is the normal path** — CI, the
   deploy workflow and a plain `npm install` all land here.
3. `../../exporters/dxa-gallery/output/amulets` — a local exporter run, for working
   against data that has not been published yet.

For (3), produce the export from the repository root:

```bash
docker compose --profile jobs run --rm exporter dxa-gallery --instance amulets --force \
    --base-url https://inventory.metanull.eu
```

`--base-url` matters: without it the exporter writes relative
`./images/pub/<uuid>.jpg` paths, and the item photographs will not load. The
compose `exporter` service is pinned to the **staging** database; `.env` files
under `scripts/exporters/` point at production and must not be used casually.

Because (2) is checked before (3), an installed package shadows a local export.
Point `DATA_PACKAGE` at the export directory to override it.

Publishing a new version is the exporter's job, not the viewer's — see
[`../../exporters/dxa-gallery/NPM_PUBLISH.md`](../../exporters/dxa-gallery/NPM_PUBLISH.md).
The deploy workflow always installs `@latest` regardless of the lockfile, so a
publish reaches production on the next deploy without a code change here.

## Development

```bash
npm install
npm run dev          # Claude Code: launch.json entry "amulets-viewer", port 4179
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
(group 59) with the Amulets site's own two keys — `galleryAbout` and
`galleryCredits` — overlaid.

The catalogues are deliberately **not padded with English**: `ar`, `es` and
`fr` carry one site-owned key each, so most of the chrome falls back to
English exactly as it did in legacy. Text that has fallen back is pinned
`dir="ltr"` even when the page is right-to-left, because English set RTL reads
wrongly.

### Languages and RTL

Two language axes meet here, as they did in legacy:

- **Chrome** — the gallery's four UI languages (`ar`, `en`, `es`, `fr`, from
  `thg_gallery_lang`), switchable in the header. Arabic flips the document to
  `dir="rtl"`. Legacy pinned its chrome to English (`loadLocaleMessages("en")`
  in its `App.vue`); the switcher is this viewer's one addition.
- **Records** — each item sheet and partner profile offers the languages *that
  record* carries, which may include `de`, `el`, `tr`, `it`, `pt` that the site
  UI never offers, and may lack ones it does.

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

- **Item URLs keep the legacy dbUid.** `/database-item/mwnf3/objects/EPM/uk/Mus21/41/en`
  is `backward_compatibility` with `:` swapped for `/` — paste a legacy URL
  after the `#` and it lands on the same sheet.
- **`short_description` is the EPM-context text**, for borrowed and native
  items alike. An EPM-native record legitimately has an empty long
  description, and the sheet then relabels the short one plain "Description:",
  exactly as legacy did.
- **Five facets, one superset.** The dropdowns are built from `tags.json` with
  its categories intact: type, dynasty, subject, material — and *artist*,
  which the legacy client never offered a dropdown for. Any facet with no
  values in the current result set is hidden. Per-language `keywords` and
  `materials` on item translations are free-text sheet lines and are **not**
  mixed in; doing so would add 441 keyword and 188 unfaceted material values
  to amulets' dropdowns alone.
- **Facets are dependent.** Legacy re-queried `/items/tags`, `/items/countries`
  and `/items/years` with the current filters applied; here every vocabulary is
  recomputed from the surviving subset. The year buckets are a verbatim port of
  the legacy client's own algorithm (500 → 250 → 100 → 50 steps, an explicit
  "Before 1000 B.C." bucket, an "After …" label on a short final step) because
  the option values end up in shareable URLs.
- **Free-text search** implements the boolean full-text grammar the
  How-to-search page documents (`+`, `-`, `*`, `""`, `~`, `<`, `>`)
  client-side, since a static site has no MySQL.
- **`featured` means what it says.** The package ships `thg_gallery.featured =
  'A'`; the live API reports it inverted because of a defect in dxa-api. This
  is the one place a live-API comparison is expected to disagree.
- **Gallery chrome images are legacy-hosted.** `image_path` /
  `banner_image_path` were never imported, so the package ships the path and
  the viewer supplies the host (`VITE_LEGACY_IMAGES_URL`, default
  `https://images.museumwnf.org`) — the one exception to the
  absolute-image-URL convention.
- **Palette** ported verbatim from
  `.legacy-code/dxa-client/src/sites/amu/_variables.scss`: `#8e2e15` banner and
  footer, `#b53615` / `#eb9681` alternating menu rows, `#d46e59` accents,
  `#ffe7e0` page. Centralised in the `:root` variables in `App.vue`.

## Known differences from the live legacy site

Verified page by page against <https://amulets.museumwnf.org> on 2026-08-27.
Everything not listed matched.

**Legacy defects not reproduced**

- `/events` ignores its `ya`/`yo` parameters, so the live timeline returns a
  country's whole chronology whatever period you pick. This viewer filters
  (and matches the live API exactly when the API is asked with the parameters
  its own client actually sends, `na`/`nz`).
- The in-description glossary linker emits one empty `<a class="glossary-link">`
  per sheet, because it rewrites the text once per term and later terms match
  inside anchors earlier ones inserted. This viewer makes a single pass.
- Legacy's "On display in → MWNF Galleries" lists the gallery you are already
  on; the package omits the exporting gallery from `gallery_references`.

**Package gaps surfaced by the viewer** (exporter-side, not viewer-side)

- ~~`timelines.json` ships 18 country chronologies where the live
  `/events/countries` lists 26.~~ **Fixed** — the exporter matched only
  `mwnf3:hcr:country:%` and so dropped the Sharing History "Political Context"
  half of legacy's merge. It now ships 37 rows over 26 countries and 1,390
  events, each row tagged with its `source`, and the viewer's country picker
  is per country rather than per row.
- ~~`countries.json` is scoped to member-item and holder countries, so ten of
  the timeline countries have no row in it and their names come from
  `Intl.DisplayNames` ("Czechia" where legacy's database says "Czech
  Republic").~~ **Fixed** — `countries.json` now unions the timeline's
  countries too (19 → 31 rows), so every timeline country's name and legacy
  code are read from the package. The `Intl.DisplayNames` fallback in
  `useTimeline.js` is retained as defensive code but is no longer reached.
- `materials` reaches the sheet as a tag-derived list, so its order and casing
  differ from the legacy free-text line ("old repairs in green-dyed cotton;
  black and red ink; …" vs "Black and red ink, coloured pigments … ; old
  repairs …").
- The legacy sheet's `dynastyDescription` free text ("India, Deccan; Mughal")
  is not in the package; the sheet shows the linked dynasty names ("Mughal").
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

**Deliberately not reproduced**

- Free-text search covers a wider field set than legacy's FTS index (it also
  reads materials, keywords, holder and country), so a query can return a
  superset: `+silver +amulet` gives 9 against legacy's 8.
- Legacy suppressed every "On display in" exhibition link whose host was
  `exhibitions.museumwnf.org` (`DatabaseItem.vue` skips them outright).
  Decision Q3 says outbound links must not be dropped, so they are rendered —
  which is why the `mwnf3:objects:ISL:uk:Mus04:42` sheet shows *The Hijaz
  Railway* and the live one does not.
- The "Partner / Affiliate" badge on the partners list describes a partner's
  relation to a *project*. Amulets owns no content, so every one of its 26
  museums would read "Affiliate"; the badge carries no information and is
  omitted.
- Routing is hash-based (`#/collection`), as in the other three viewers, so
  the site needs no server rewrite rules. The path after the `#` is the legacy
  path unchanged.
- The partner route drops legacy's project-id segment
  (`/partner/dz/Mus01/en`, not `/partner/ISL/dz/Mus01/en`): `partners
  .project_id` is null for every imported museum, so there is nothing to put
  there.

## Open decision — Q5, the partner-profile map

Legacy embedded **Google Maps** with a per-deployment API key. CLAUDE.md
forbids hardcoded secrets, and a key baked into a static bundle is a published
secret however it is injected, so this viewer implements the keyless
alternative the epic recommended: an **OpenStreetMap embed** centred on the
partner's own coordinates at the record's zoom level, plus a link out to the
full map.

Everything provider-specific lives in `src/components/PartnerMap.vue` and
nothing outside it knows which provider is in use, so switching back to Google
Maps — if Pascal decides a key belongs in a build secret after all — is a
change to one `src` computed property. **This is a decision for the owner to
confirm, not one this story settled.**

## Deployment

`.github/workflows/deploy-viewer-amulets-ovh.yml` builds with
`--base=/amulets/` and deploys `dist/` to `/opt/amulets/` on the OVH VPS;
Nginx serves it at https://inventory.metanull.eu/amulets/ via an alias block.
See [`../README.md`](../README.md) for the shared deployment mechanics.
