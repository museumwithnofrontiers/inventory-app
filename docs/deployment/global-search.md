---
layout: default
title: Global Search
parent: Deployment Guide
nav_order: 12
---

# Global Search

One search over every item a site shows, in every language, served by the search site at `museumwithnofrontiers.github.io/search` (milestone M15). The decisions are in [ADR 005](../adr/005-global-search).

## The pieces

| Piece | Where | What it does |
|---|---|---|
| Search exporter | `scripts/exporters/search/` | In the export batch, reads the database read-only and writes `@museumwnf/search-data` (`mwnf.search/1`). |
| Package | data-packages, npmjs | Released with provenance like every data package. CI checks the schema and refuses a drop of more than 5% of the documents without the label `search-shrink-ok`. |
| Pin and loader | `scripts/search/` | The pinned version, the index settings, the probes and the loader. |
| Deploy | `.github/workflows/deploy-search-ovh.yml` | Merging a pin bump checks the package's integrity and provenance, uploads it and loads it. |
| Meilisearch | OVH, `127.0.0.1:7700`; compose profile `search` | Installed by `scripts/search/provision-search.sh` (root), pinned by version and SHA-256. |
| Edge | `search.metanull.eu` | nginx: only `POST /indexes/items/search` and `GET /health`, with the search key added at the edge, 10 requests/s per address (burst 20), and CORS for `museumwithnofrontiers.github.io` only. |
| Search site | `museumwithnofrontiers/search` | A site like the others, on GitHub Pages. It takes site slugs from `sites.json`, never addresses. |
| Search box | viewer-core `globalSearch`, viewer-layout | Off by default. The parity check turns it on for the sites that need it. |

## Operating it

- **A new version:** the reimport runbook's steps 7 and 8. The batch publishes, then propagate opens the pin pull request, and merging it loads the version.
- **Rollback:** revert the pin pull request. For an immediate switch, run `node loader.mjs --rollback` as `deploy` in `/opt/search/current/scripts/search`.
- **A Meilisearch upgrade:**
  1. Change `scripts/search/meilisearch.version` and `meilisearch.sha256`, and the image tag in `compose.yml` (a test checks they match).
  2. Re-run `provision-search.sh`.
  3. Re-run the deploy workflow.

  The index is rebuilt from the package, so no dump has to be migrated.
- **Health:** `curl https://search.metanull.eu/health`. Any other path answers 404.

The full procedures are in [`scripts/search/README.md`](https://github.com/museumwithnofrontiers/inventory-app/blob/main/scripts/search/README.md).
