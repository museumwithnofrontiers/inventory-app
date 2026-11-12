# Publications Exporter

Reads the inventory database (read-only) and writes the static JSON files of
the Publications website, which replaces books.museumwnf.org: no API server,
no auth, no database at runtime. The output is published as the npm package
`@museumwnf/publications-data` in
[data-packages](https://github.com/museumwithnofrontiers/data-packages).

The package is specified in
[`../docs/publications-data-package.md`](../docs/publications-data-package.md);
the site's note is [`../instances/publications.md`](../instances/publications.md).

## What is particular to Publications

- **No project and no tree.** The scope is every publication, the exhibition
  trails they accompany and the items they cite (`src/core/scope.ts`).
- **References, never sheets.** The items a publication catalogues and its
  trail's entries ship as references (`references.json`): id, name, first
  picture and the sites that show the item, from the shared rule in
  [`../shared/sites.mjs`](../shared/sites.mjs). The item's own site keeps its
  sheet.
- **Documents.** The sample and credits PDFs ship at their public `/doc`
  URL (ADR 004); the covers and sample pages as `/pub` renditions, like every
  picture.
- **Hidden editions.** A version legacy hides (`visible` false) ships
  nowhere, nor do its cover, pages and PDFs. The editions' shop links are
  never exported (D-P8).

It started as a copy of the `explore` exporter's skeleton (database, logger,
publishing); its exporters are its own (see *Why forked per dataset* in
[`../README.md`](../README.md)).

## Run (TL;DR)

```powershell
docker compose --profile jobs run --rm exporter publications --force
```

```powershell
docker compose --profile jobs run --rm exporter publications --force --publish --base-url https://inventory.metanull.eu
```

The dataset scope is hardcoded: the exporter takes no scope arguments and
always writes `output/publications/` as `@museumwnf/publications-data`.
Image and document URLs are built from `BASE_URL` (or `--base-url`).
`--publish` stages the export, with the next version, into the data-packages
checkout, and merging the pull request that carries it publishes the
version; see [`NPM_PUBLISH.md`](NPM_PUBLISH.md).

## Tests

```powershell
docker compose --profile jobs run --rm --no-deps --entrypoint sh exporter -c "cd /var/www/app/scripts/exporters/publications && npm test"
```

The tests of the shared modules (`../shared/`) run here too.
