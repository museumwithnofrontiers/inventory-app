# NPM Package Publishing Guide

How `--publish` releases `@museumwnf/galleries-data` on npmjs. What the package contains is in
[`README.md`](README.md) and [`../docs/galleries-hub-data-package.md`](../docs/galleries-hub-data-package.md). The mechanics are the same for every exporter and are in
[`../docs/publishing.md`](../docs/publishing.md): the export is staged into
a checkout of
[data-packages](https://github.com/museumwithnofrontiers/data-packages), and
merging the pull request that carries it publishes the version.

## Quick start

With data-packages cloned next to inventory-app, on a branch of its own:

```bash
docker compose --profile jobs run --rm exporter galleries --force --publish --base-url https://inventory.metanull.eu
```

Then commit `packages/` in data-packages and open a pull request there.
