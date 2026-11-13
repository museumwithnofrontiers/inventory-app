# The global search service

Meilisearch behind a public edge, loaded only from a pinned
`@museumwnf/search-data`. Milestone M15; the decisions are in
[ADR 005](../../docs/adr/005-global-search.md).

```
search exporter (export batch) → data-packages → npm @museumwnf/search-data@x.y.z
   propagate bumps the pin here → merge → deploy-search-ovh.yml → loader → Meilisearch
   search site (GitHub Pages) → https://search.metanull.eu (edge) → Meilisearch
```

| File | What it is |
|---|---|
| `package.json`, `package-lock.json` | The **pin**: the exact `@museumwnf/search-data` version the server holds. |
| `loader.mjs` | Loads the pinned package (or `--from-dir` a local export) into a new index, checks it, and swaps it in. `--rollback` swaps the previous version back. |
| `settings.json` | The index settings; every `texts.*.` field is expanded to the package's languages. |
| `probes.json` | The searches every new index must pass before it goes live (Arabic, accents, typos, reference numbers). |
| `keys.mjs` | Creates the loader key and the search-only key from the master key. |
| `edge/` | nginx: `http.conf.template`, `server.conf.template` (rendered with `envsubst`), and `local.conf` for Docker. |
| `provision-search.sh` | Root, once per server: the pinned binary (`meilisearch.version`, `meilisearch.sha256`), systemd, keys, vhost and certificate. |
| `docker-loader.sh` | The loader's entry point in the compose `search-loader` service. |

## Release flow

1. **Export:** the batch runs the search exporter with the others (`exporter all --publish`) and stages `packages/search-data` in data-packages. That repository's CI checks the payload against `mwnf.search/1` and refuses a drop of more than 5% of the documents without the label `search-shrink-ok`.
2. **Publish:** merging the data-packages pull request releases the new version with provenance.
3. **Propagate:** `node tools/propagate.mjs --expect search-data@x.y.z` (viewer-workflows) opens two pull requests: one bumping the pin here, and one in the search site, which reads `sites.json`.
4. **Load:** merging the inventory-app pull request runs `deploy-search-ovh.yml`.
   1. `npm ci` checks the tarball against the lockfile.
   2. `npm audit signatures` checks its signature and provenance.
   3. The workflow uploads the bundle and runs `loader.mjs` on the server.
   4. A failed load leaves the live index as it was.
5. **Roll back:** revert the pin pull request, and the workflow loads the previous version. Or run `node loader.mjs --rollback` on the server, which swaps to `items_previous` at once.

## Local Docker

```bash
docker compose --profile search up -d
```

```bash
docker compose run --rm search-loader --from-dir ../exporters/search/output/search
```

```bash
curl -s -X POST localhost:8091/indexes/items/search -H 'Content-Type: application/json' -d '{"q":"mihrab","matchingStrategy":"all"}'
```

`--from-dir` loads an export that has not been published, so an exporter change can be tried first. Without it, the loader installs the pin and checks its signatures. The edge on `127.0.0.1:8091` is the server's configuration, with localhost added to its CORS list.

## On the server

```bash
sudo bash provision-search.sh
```

Run it from an unpacked bundle: `scripts/search` next to `scripts/exporters/search/schema`. It is idempotent, and it never stops nginx.

- Meilisearch runs as `meilisearch` on `127.0.0.1:7700`. Its data is in `/var/lib/meilisearch`, and its master key in `/etc/meilisearch/master.key` (root, 600).
- The loader key is in `/home/deploy/.search-loader-key` (deploy, 600). The search key is in `/etc/nginx/search/search-key.conf` (root:www-data, 640).
- Releases are unpacked under `/opt/search/releases/<sha>`, and `/opt/search/current` points to the last one.

A lost data directory needs a re-run of `provision-search.sh`, for the keys, then a re-run of the deploy workflow.

## Tests

```bash
npm test
```

The loader against an in-memory Meilisearch. CI also renders the edge and runs `nginx -t` on it.
