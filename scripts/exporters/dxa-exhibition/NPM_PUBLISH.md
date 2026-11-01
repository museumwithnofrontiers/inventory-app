# NPM Package Publishing Guide

How `--publish` releases an exhibition's `@museumwnf/<site>-data` package on npmjs. What the package contains is in
[`README.md`](README.md#package-contents). The mechanics are the same for every exporter and are in
[`../docs/publishing.md`](../docs/publishing.md): the export is staged into
a checkout of
[data-packages](https://github.com/museumwithnofrontiers/data-packages), and
merging the pull request that carries it publishes the version.

## Quick start

With data-packages cloned next to inventory-app, on a branch of its own:

```bash
docker compose --profile jobs run --rm exporter dxa-exhibition --instance <slug> --force --publish --base-url https://inventory.metanull.eu
```

Then commit `packages/` in data-packages and open a pull request there.

Every command needs `--instance <slug>`: this exporter has no default site.
The package name is the instance file's `package_name`, and the package
folder in data-packages is that name without the `@museumwnf/` scope.
`exporter all --force --publish` stages every `exhibition` instance at once,
together with the other exporters' instances.

## Consumer usage

```bash
npm install @museumwnf/<site>-data
```

```javascript
import manifest from '@museumwnf/<site>-data/manifest.json' assert { type: 'json' }
import exhibition from '@museumwnf/<site>-data/exhibition.json' assert { type: 'json' }
import items from '@museumwnf/<site>-data/items.json' assert { type: 'json' }

// Lazy-load translations for a language
const { default: t } = await import(`@museumwnf/<site>-data/translations/items.${lang}.json`)
```

All data files sit at the package root (there is no `data/` directory);
per-language translation files live under `translations/`.

## Troubleshooting

See [`../docs/publishing.md`](../docs/publishing.md#troubleshooting) for staging.

**Wrong `--instance`** — a `gallery`-kind instance file is refused with a
pointer to `../dxa-gallery`; a missing instance file names the path it looked
for (bare names resolve against `../instances/<name>.json`).
