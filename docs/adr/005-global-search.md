---
layout: default
title: ADR 005 — Global search, fed by a pinned public package
parent: Architecture Decisions
nav_order: 5
---

# ADR 005 — Global search, fed by a pinned public package

- **Status:** Accepted (Pascal, 2026-11-13)
- **Date:** 2026-11-13
- **Milestone:** M15 — Global search across the inventory (design #2566, epics #2567–#2571)

## Context

Visitors want one search over the whole inventory, in every language, with Arabic weighted like the others. It has to cover the descriptions, the tags and the reference numbers, and open each result in the site or sites that show the item. The sites live on many domains and read only their own npm data package. They never reach the inventory.

The inventory should gain no public surface: no public route, no token held by a visitor-facing server, and no network path to its database. A spike on 2026-11-13 compared Pagefind with Meilisearch on the 87 published packages: 9,485 items, 12 languages, 36.7 MB of text.
- **Pagefind** costs no server, but it has no typo tolerance, searches one language at a time, and its fragments publish the indexed text in full.
- **Meilisearch** has typo tolerance, searches every language in one query, and handles Arabic (definite article, alef and hamza, ta marbuta, diacritics). It needs a small server process.

## Decision

1. **Meilisearch is the engine.**
2. **A search exporter feeds it.** `scripts/exporters/search/` runs in the export batch with the others. It reads the staging database read-only and writes `@museumwnf/search-data`.
3. **The package is public, released like every data package.** It goes through data-packages, with provenance. It is engine-neutral, schema `mwnf.search/1`:
   - `manifest.json`: counts and a SHA-256 per shard;
   - `sites.json`: the slug whitelist;
   - `documents/<0-f>.ndjson`: one item per line, sorted by id.
4. **Which items:** only those a site shows, by the shared rule (`scripts/exporters/shared/sites.mjs`). A detail with no page of its own opens on its monument's page. Items no site shows are left out.
5. **The search service lives in inventory-app, under `scripts/search/`:**
   - the Meilisearch settings;
   - the loader;
   - the **pinned** version of `@museumwnf/search-data`.
6. **Pinned, never polled.** After a publish, propagate opens a PR that bumps the pin. Merging it runs `deploy-search-ovh.yml`, which loads that exact version. The loader:
   1. checks the package's integrity and provenance;
   2. builds `items_<version>`;
   3. checks the count and the probes;
   4. swaps it with `items` and keeps the previous index.

   Rollback is reverting the PR.
7. **Hosting:** the Meilisearch binary on the OVH server, and a `search` profile in the local compose stack. Both listen on a private address only.
8. **The public edge is `search.metanull.eu`:**
   - it accepts only `POST /indexes/items/search` and `GET /health`;
   - it adds the search-only key itself;
   - it limits each address to 10 requests/s with a burst of 20;
   - it answers CORS only for `https://museumwithnofrontiers.github.io`.
9. **The search UI is a site like the others,** `museumwithnofrontiers/search` on GitHub Pages, listed alone in its own group on the org site (instance kind `search`).
10. **The link contract takes slugs, never addresses.** `?q=&lang=&site=<slug>&from=<slug>`: a slug counts only if it is in `sites.json`. Every link the site writes is `origin + path` from that file, which prevents open redirects.
11. **Sites opt in.** viewer-core has a `globalSearch` setting, off by default, and viewer-layout has the search box. M15 changes no site; the parity check turns search on where legacy had a similar feature.

## Consequences

- **The security boundary:**
  - Meilisearch never reads the database.
  - Only the loader writes to it, from a package anyone can check.
  - The edge exposes the search route only.
  - No inventory route serves search.
- **Freshness:** search changes when a batch is published and its pin merged. A result may briefly point to a site that is still redeploying, which is accepted.
- **The text is already public:** the package gathers what the 87 site packages already publish separately.
- **Hosting can change** to another server or to containers without touching the exporter or the package: only the loader's surroundings change.
- **Schema changes:** a breaking change to the documents is `mwnf.search/2`, and the loader refuses a schema it does not know.
