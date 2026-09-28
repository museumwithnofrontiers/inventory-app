# Galleries Hub Exporter

Reads the `inventory-app` database and writes the static JSON package behind
the galleries hub, the site that replaces <https://galleries.museumwnf.org>:
`@museumwnf/galleries-data`. It optionally publishes that output to npmjs.

The package specification is
[`../docs/galleries-hub-data-package.md`](../docs/galleries-hub-data-package.md),
from story [#2113](https://github.com/museumwithnofrontiers/inventory-app/issues/2113).
This exporter is story [#2114](https://github.com/museumwithnofrontiers/inventory-app/issues/2114),
epic [#1744](https://github.com/museumwithnofrontiers/inventory-app/issues/1744).

## What it exports

The hub lists galleries and a partner directory, and nothing else: no items,
no item sheets and no timeline (Pascal, 2026-09-28).

| File | Content |
|---|---|
| `manifest.json` | The hub's name and UI languages, from its own collection (legacy gallery 45), and `projects` naming the partners' project |
| `galleries.json` | Every visible gallery under the galleries root, by English name |
| `partners.json`, `translations/partners.<lang>.json` | The museums of the `GALLERIES` project, legacy's hub partner list, in the shared partner shape with `item_count: 0` |
| `countries.json`, `translations/countries.<lang>.json` | The partners' countries |
| `languages.json` | The languages any shipped text uses |

## Why a standalone exporter

Like [`../islamicart`](../islamicart/README.md), it exports exactly one
package. So its scope is a set of constants in `src/cli/export.ts`, not an
instance file's `collection_id`:
- the hub's own collection, `mwnf3_thematic_gallery:thg_gallery:45`;
- the partners' project, `mwnf3:projects:GALLERIES`.

The galleries themselves are found by the root's `purpose`
(`galleries-root`), never by a legacy id.

[`../instances/galleries.json`](../instances/galleries.json) (`kind:
"standalone"`) exists only so the batch (`exporter all`) runs this exporter
with the others. [`../instances/galleries.md`](../instances/galleries.md) is
the site note.

## Run

The exporter runs inside Docker, against the staging database:

```bash
docker compose --profile jobs run --rm exporter galleries --force --base-url https://inventory.metanull.eu
```

The output lands in `output/galleries/`. Publishing is covered in
[`NPM_PUBLISH.md`](NPM_PUBLISH.md).

## Develop

```bash
npm ci
npm run type-check
npm run lint:check
npm test
```

The tests use a fake database that answers each query from its SQL shape
(`tests/unit/support.ts`), so they need no MySQL.
