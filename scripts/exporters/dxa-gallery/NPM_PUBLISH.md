# NPM Package Publishing Guide

How `--publish` releases a gallery's `@museumwnf/<site>-data` package on npmjs. What the package contains is in
[`README.md`](README.md). The mechanics are the same for every exporter and are in
[`../docs/publishing.md`](../docs/publishing.md): the export is staged into
a checkout of
[data-packages](https://github.com/museumwithnofrontiers/data-packages), and
merging the pull request that carries it publishes the version.

## Quick start

With data-packages cloned next to inventory-app, on a branch of its own:

```bash
docker compose --profile jobs run --rm exporter dxa-gallery --instance <slug> --force --publish --base-url https://inventory.metanull.eu
```

Then commit `packages/` in data-packages and open a pull request there.

Every command needs `--instance <slug>`: this exporter has no default site.
The package name is the instance file's `package_name`, and the package
folder in data-packages is that name without the `@museumwnf/` scope.
`exporter all --force --publish` stages every `gallery` instance at once,
together with the other exporters' instances.

## Consumer usage

```bash
npm install @museumwnf/<slug>-data
```

```javascript
import manifest from '@museumwnf/<slug>-data/manifest.json' assert { type: 'json' }
import gallery from '@museumwnf/<slug>-data/gallery.json' assert { type: 'json' }
import items from '@museumwnf/<slug>-data/items.json' assert { type: 'json' }

// Lazy-load translations for a language
const { default: t } = await import(`@museumwnf/<slug>-data/translations/items.${lang}.json`)
```

All data files sit at the package root (there is no `data/` directory);
per-language translation files live under `translations/`.
