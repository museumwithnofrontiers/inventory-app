# The search exporter: `@museumwnf/search-data`

Writes the global search's payload (M15, [ADR 005](../../../docs/adr/005-global-search.md)). It reads the inventory database read-only, like every exporter, and runs in the export batch through the instance file `instances/search.json` (kind `search`).

```bash
docker compose run --rm exporter search --force
```

```bash
docker compose run --rm exporter search --force --publish --base-url https://inventory.metanull.eu
```

## What it writes (`mwnf.search/1`)

- `documents/<0-f>.ndjson`: one document per item that a site shows, sorted by id and split by the id's first character. A detail with no page of its own opens on its monument's page. Items that no site shows are left out, and the manifest counts them.
  - **Reference numbers:** `id`, `backward_compatibility`, `mwnf_reference`, `owner_reference`.
  - **Sites:** `sites` as `{site, path}`, the home site first, by the shared rule in `../shared/sites.mjs`.
  - **The first picture**, as a `/pub` rendition.
  - **Tags of no language**, in `tags`.
  - **`texts` per language:**
    - the name the item's own site gives it, and every other name;
    - descriptions and short descriptions;
    - type, holder, dates, place, dynasty, artist, history;
    - keywords, materials and that language's tags;
    - partner and country names.

  Bibliography, credits and copyright are left out.
- `sites.json`: every instance file's slug, name, kind, parent, origin and item route. It is the only list of slugs the search site accepts and of addresses it links to.
- `manifest.json`: the counts per type and language, and every shard's SHA-256.

The schema is `schema/mwnf.search-1.schema.json`. `schema/validate.mjs` checks a package folder against it with no dependency:

```bash
node schema/validate.mjs output/search
```

The loader and data-packages' CI use the same checks; data-packages keeps a copy in `scripts/search-data.mjs`. A breaking change to the documents is `mwnf.search/2`.
