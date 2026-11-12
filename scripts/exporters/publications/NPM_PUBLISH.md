# NPM Package Publishing Guide

How `--publish` releases `@museumwnf/publications-data` on npmjs. What the package contains is in
[`README.md`](README.md) and [`../docs/publications-data-package.md`](../docs/publications-data-package.md). The mechanics are the same for every exporter and are in
[`../docs/publishing.md`](../docs/publishing.md): the export is staged into
a checkout of
[data-packages](https://github.com/museumwithnofrontiers/data-packages), and
merging the pull request that carries it publishes the version.

## Quick start

With data-packages cloned next to inventory-app, on a branch of its own:

```bash
docker compose --profile jobs run --rm exporter publications --force --publish --base-url https://inventory.metanull.eu
```

Then commit `packages/` in data-packages and open a pull request there.

## Consumer usage

```bash
npm install @museumwnf/publications-data
```

```javascript
import manifest from '@museumwnf/publications-data/manifest.json' assert { type: 'json' }
import publications from '@museumwnf/publications-data/publications.json' assert { type: 'json' }

// Lazy-load translations for a language
const { default: t } = await import(`@museumwnf/publications-data/translations/publications.${lang}.json`)
```

All data files sit at the package root (there is no `data/` directory);
per-language translation files live under `translations/`.
