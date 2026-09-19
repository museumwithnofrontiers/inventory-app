# Dataset Viewers

One viewer per public website ("dataset"): a lightweight, standalone Vue 3 +
Vite single-page application that consumes its dataset's static JSON
data-package (`@museumwnf/<dataset>-data`, produced by the matching exporter —
see [`../exporters/`](../exporters/README.md)) at **build time**. The
deployed site is pure static files: no database, no Laravel API, no server
runtime.

```
@museumwnf/<dataset>-data ──(npm install + vite build)──▶ dist/ ──(GitHub Actions)──▶ https://inventory.metanull.eu/<dataset>/
```

## Datasets

| Directory | Package consumed | Live URL | Deploy workflow |
|---|---|---|---|
| [`islamicart/`](islamicart/README.md) | `@museumwnf/islamicart-data` | https://inventory.metanull.eu/islamicart/ | `.github/workflows/deploy-viewer-islamicart-ovh.yml` |
| [`baroqueart/`](baroqueart/README.md) | `@museumwnf/baroqueart-data` | https://inventory.metanull.eu/baroqueart/ | `.github/workflows/deploy-viewer-baroqueart-ovh.yml` |
| [`sharinghistory/`](sharinghistory/README.md) | `@museumwnf/sharinghistory-data` | https://inventory.metanull.eu/sharinghistory/ | `.github/workflows/deploy-viewer-sharinghistory-ovh.yml` |
| [`amulets/`](amulets/README.md) | `@museumwnf/amulets-data` | https://inventory.metanull.eu/amulets/ | `.github/workflows/deploy-viewer-amulets-ovh.yml` |
| [`carpets/`](carpets/README.md) | `@museumwnf/carpets-data` | https://inventory.metanull.eu/carpets/ | `.github/workflows/deploy-viewer-carpets-ovh.yml` |
| [`the-use-of-colours-in-art/`](the-use-of-colours-in-art/README.md) | `@museumwnf/the-use-of-colours-in-art-data` | https://inventory.metanull.eu/the-use-of-colours-in-art/ | `.github/workflows/deploy-viewer-the-use-of-colours-in-art-ovh.yml` |
| [`water-in-islam/`](water-in-islam/README.md) | `@museumwnf/water-in-islam-data` | https://inventory.metanull.eu/water-in-islam/ | `.github/workflows/deploy-viewer-water-in-islam-ovh.yml` |

The first three viewers are **verification tools** for their packages. The
other four are DXA rebuilds
([epic #1539](https://github.com/museumwithnofrontiers/inventory-app/issues/1539)):
faithful reproductions of public legacy websites
(<https://amulets.museumwnf.org>, <https://carpets.museumwnf.org>,
<https://exhibitions.museumwnf.org/the_use_of_colours_in_art/en>,
<https://exhibitions.museumwnf.org/water_in_islam/en>), reproducing
their routes, page structure, facet behaviour and palette rather than
reinterpreting them. Their UI strings come from
[`../site-i18n`](../site-i18n/README.md), never from the data package.

`amulets` and `carpets` are **galleries**; `the-use-of-colours-in-art` and
`water-in-islam` are **exhibitions**, which is a gallery plus a curated theme
layer — the themes tour, its theme galleries, the related-content reading list
and separate institution pages. See their READMEs for what that adds, and
`water-in-islam`'s for the three rules only a second exhibition could exercise:
hidden museums, a site with no chronology, and a member whose text is in
another language.

Each directory is a self-contained Node project. Viewers are **forked per
dataset by design** (same decision as the exporters): each website has its
own feature set (Islamic Art has dynasties and artistic introductions;
Baroque Art doesn't), its own branding and color scheme (Islamic Art golds,
Baroque Art blues — palettes taken from the legacy sites' CSS in
`.legacy-code/`), and is expected to diverge. Cross-cutting fixes must be
ported between forks explicitly.

## How a viewer finds its data

- All data is imported from `@inventory-data/…` (a Vite alias for the
  installed data-package). Entity files are imported statically; per-language
  translation files are loaded lazily.
- English translation files are loaded through `import.meta.glob` rather than
  literal imports: which `translations/<entity>.en.json` files exist varies
  by dataset/export, and a literal import of an absent file fails the build.
- Section anchors are resolved from `collections.json` via the `purpose`
  field (#1505): exhibitions are the children of the collection with
  `purpose: "exhibitions-root"`, the Islamic Art artistic introduction hangs
  off `purpose: "artistic-introduction-root"`, Sharing History additionally
  uses `historical-background-root` / `topics-root` /
  `historical-profiles-root` / `national-context`. Themes are an
  exhibition's children, pages a theme's children. The
  `backward_compatibility` keys in the data are informational only — no
  viewer parses them.
- **The gallery viewers are the exception on that last point.** DXA gallery
  sites keep the legacy dbUid *in the public URL*
  (`/database-item/mwnf3/objects/DCA/uk/Mus31/19/en`), so `amulets` and
  `carpets` do read `backward_compatibility` — it is the item's public
  identity there, not an implementation detail. They also anchor their site
  metadata on `gallery.json` rather than a `purpose` marker, since a gallery
  package has no `collections.json`.

## Development

```bash
cd scripts/viewers/<dataset>
npm install
npm run dev       # Vite dev server (Claude Code: .claude/launch.json has
                  #   per-viewer entries, e.g. baroqueart-viewer on port 4174)
npm run build     # production build into dist/
```

To pick up a new data-package version locally:

```bash
npm install @museumwnf/<dataset>-data@latest
```

then **restart the dev server** — Vite's dependency pre-bundle cache serves
the old package contents otherwise. `@museumwnf/<dataset>-data` is public on
npmjs, so no registry auth is needed to install it.

The three DXA viewers also accept a **local exporter run** as a fallback, for
working against data that has not been published yet: with no installed package
they resolve `scripts/exporters/<dataset>/output/<dataset>`, and `DATA_PACKAGE`
overrides an installed package with an export directory. See their READMEs.

## Deployment

Each viewer has a GitHub Actions workflow that builds and ships it to the
OVH VPS. It triggers on **any push to `main` touching
`scripts/viewers/<dataset>/**`**, and on **manual dispatch**
(`gh workflow run deploy-viewer-<dataset>-ovh.yml`, or the Actions UI). The
workflow runs `npm ci`, then **always installs
`@museumwnf/<dataset>-data@latest`** — deliberately overriding whatever the
lockfile pins, so a deploy always reflects the newest published data —
builds with `--base=/<dataset>/`, and copies `dist/` to `/opt/<dataset>/`
over SSH. Nginx serves it from an alias block in
`/etc/nginx/sites-available/inventory`:

```nginx
location /<dataset> {
    alias /opt/<dataset>;
    index index.html;
    try_files $uri $uri/ /<dataset>/index.html;
}
```

`@museumwnf/<dataset>-data` is public on npmjs, so the workflow needs no
registry credential to install it — see the publishing gotchas in
[`../exporters/README.md`](../exporters/README.md).

### Shipping a content (data-only) update

1. Re-export and publish the data-package — one `npm run export -- --force
   --publish` command per dataset; see
   [`../exporters/README.md`](../exporters/README.md#build--publish-a-data-package-update-end-to-end).
2. Dispatch the viewer's deploy workflow:
   `gh workflow run deploy-viewer-<dataset>-ovh.yml`. Nothing needs to be
   committed — the workflow installs `@latest` regardless of the lockfile.
3. Verify the live URL (hard-refresh: the built JS bundle hash changes).

The viewers' `package.json` pins (`^x.y.z`) only govern **local
development**; keep them bumped to the latest published version so a fresh
`npm install` + `npm run dev` matches what production shows.

## Adding a new dataset

1. Copy the closest existing viewer to `scripts/viewers/<name>`; swap the
   data-package dependency and the exhibitions marker key.
2. Prune views/routes the dataset doesn't have; rebrand (title, nav, color
   scheme — extract the palette from the legacy site's CSS under
   `.legacy-code/<dataset>/`, and keep it centralized in the `:root` CSS
   variables in `App.vue`).
3. Add a dev-server entry to `.claude/launch.json` (unique port).
4. Copy and adapt the deploy workflow; add the Nginx alias block on the
   server; dispatch and verify the live URL.
5. Nothing to add to [`.github/dependabot.yml`](../../.github/dependabot.yml):
   its dataset-viewers entry globs `directories: ["/scripts/viewers/*"]`, so
   placing the new viewer under `scripts/viewers/` is enough to pick it up on
   the next run — there is no per-viewer entry to forget. That entry carries
   no `registries:` key, since `@museumwnf/<dataset>-data` is public on
   npmjs, like every other npm project in this repository.
