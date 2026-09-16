# Baroque Art Viewer

A Vue 3 single-page application rendering the Discover Baroque Art data-package
(`@museumwnf/baroqueart-data`). It serves two purposes:

1. A visual verification tool for the owner to assert that the data-package
   produced by the exporter is correct.
2. A model/blueprint for frontend developers building products on top of a
   data-package.

It is a full multi-view application (Vue Router: Home, Database
search/results, Item detail, Permanent Collection, Timeline, Partners,
Exhibitions, …), not a single-component sample.

## Dataset specifics

The viewer renders the Discover Baroque Art project (legacy project key
`BAR`):

- **Single project** — the whole dataset belongs to one project, so there is
  no project filtering anywhere in the UI.
- **No dynasties, no artistic introduction** — the Baroque Art dataset has
  neither, so the viewer has no views for them.
- **Exhibitions** are anchored at the marker collection with
  `purpose: "exhibitions-root"` in the data package (#1505);
  `backward_compatibility` is informational only and never parsed by this
  viewer.

## Structure

```
scripts/viewers/baroqueart/
├── index.html          # Shell HTML — mounts #app
├── src/
│   ├── main.js         # Creates and mounts the Vue app + router
│   ├── App.vue         # Layout shell (header, nav, footer)
│   ├── router/         # Route table (one route per view)
│   ├── views/          # One component per page
│   └── composables/    # Data loading (useInventoryData.js) and helpers
├── vite.config.js      # Resolves the data package path; sets @inventory-data alias
└── package.json        # Dependencies: vue, vue-router + the data package
```

`@museumwnf/baroqueart-data` is a public package on npmjs, so no registry
scoping or auth token is needed to install it — a plain `npm install`/`npm ci`
resolves it from `registry.npmjs.org` like any other dependency.

## How it uses `@museumwnf/baroqueart-data`

`vite.config.js` resolves the installed package's directory at build time and registers
a Vite alias `@inventory-data` pointing to it:

```js
// vite.config.js
const dataPackageDir = dirname(require.resolve(`${dataPackage}/package.json`))
// alias: '@inventory-data' → '/abs/path/to/node_modules/@museumwnf/baroqueart-data'
```

`App.vue` then imports data directly from that alias:

```js
// Static imports — bundled into the main chunk, available immediately
import manifestData from '@inventory-data/manifest.json'
import itemsData    from '@inventory-data/items.json'

// Dynamic import — code-split per language, loaded on demand
const module = await import(`@inventory-data/translations/items.${lang}.json`)
```

Vite bundles `manifest.json` and `items.json` into the main chunk. Each translation
file (`translations/items.en.json`, `translations/items.fr.json`, …) becomes a
separate lazy chunk, loaded only when the user selects that language.

The data package to use is configured by `DATA_PACKAGE` in `.env` (defaults to
`@museumwnf/baroqueart-data`). Changing it to another compatible package requires only
updating `.env` and re-running `npm install`.

## Build and run

```bash
# @museumwnf/baroqueart-data is public on npmjs — no auth needed.

npm install          # installs vue, vite, and the data package
npm run dev          # development server at http://localhost:5173
npm run build        # production build → dist/
npm run preview      # serve the production build locally
```

## Deployment (OVH)

[`.github/workflows/deploy-viewer-baroqueart-ovh.yml`](../../../.github/workflows/deploy-viewer-baroqueart-ovh.yml)
builds and deploys this viewer to `https://inventory.metanull.eu/baroqueart/`
automatically. It triggers on:

- Any push to `main` that touches `scripts/viewers/baroqueart/**`
- Manual dispatch (`workflow_dispatch`), e.g. to redeploy after a new data
  package version is published without changing any viewer code

Steps, in order:

1. Checkout, set up Node
2. `npm ci` (installs whatever's pinned in `package-lock.json`)
3. **`npm install @museumwnf/baroqueart-data@latest`** — always pulls the
   newest published data package regardless of what's pinned in the
   lockfile, since the whole point of a deploy is to reflect current content
4. `npm run build -- --base=/baroqueart/` (the `--base` matters: the site is
   served from a subpath, not the domain root)
5. Set up the deploy SSH key, verify the VPS is reachable and the key
   authenticates *before* attempting the actual deploy (fails fast with a
   clear error instead of a confusing mid-deploy failure)
6. `scp` the built `dist/` contents to `/opt/baroqueart/` on the VPS
7. Clean up the SSH key (`if: always()`, runs even if a prior step failed)

Runs with `concurrency: cancel-in-progress: false` — a second push while a
deploy is in flight queues behind it rather than cancelling the first.

**Required repository secrets:** `VPS_SSH_KEY` (private key), `VPS_HOST`,
`VPS_SSH_USER`. No `packages: read` permission or PAT is needed —
`@museumwnf/baroqueart-data` is a public npmjs package, so both `npm ci` and
the deploy-time `npm install` resolve it anonymously.

This workflow only builds and ships the *viewer* — it never runs the
exporter or touches the database. Publishing a new data package version is
a separate, manual step; the workflow just needs to be triggered (a push,
or manually) afterward to pick it up.
