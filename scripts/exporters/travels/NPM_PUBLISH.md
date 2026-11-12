# NPM Package Publishing Guide

How `--publish` releases `@museumwnf/travels-data` on npmjs. What the package contains is in
[`README.md`](README.md) and [`../docs/travels-data-package.md`](../docs/travels-data-package.md). The mechanics are the same for every exporter and are in
[`../docs/publishing.md`](../docs/publishing.md): the export is staged into
a checkout of
[data-packages](https://github.com/museumwithnofrontiers/data-packages), and
merging the pull request that carries it publishes the version.

## Quick start

With data-packages cloned next to inventory-app, on a branch of its own:

```bash
docker compose --profile jobs run --rm exporter travels --force --publish --base-url https://inventory.metanull.eu
```

Then commit `packages/` in data-packages and open a pull request there.

## Consumer usage

```bash
npm install @museumwnf/travels-data
```

```javascript
import manifest from '@museumwnf/travels-data/manifest.json' assert { type: 'json' }
import items from '@museumwnf/travels-data/items.json' assert { type: 'json' }

// Lazy-load translations for a language
const { default: t } = await import(`@museumwnf/travels-data/translations/items.${lang}.json`)
```

All data files sit at the package root (there is no `data/` directory);
per-language translation files live under `translations/`.
