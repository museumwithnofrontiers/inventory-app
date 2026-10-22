---
layout: default
title: Data Packages MCP
parent: Collaborator Guide
nav_order: 6
---

# Data Packages MCP

`scripts/data-packages-mcp/` is a read-only [MCP](https://modelcontextprotocol.io) server for assessing import quality from the outside: it reads only the **published** `@museumwnf/*-data` npm packages, the same files the public websites install. It never reads the inventory database or an exporter's local output, and never publishes.

With it, an AI assistant such as Claude Code can:

- list every published data package and its versions, discovered from the npm registry;
- select a package version and browse it: items merged with their translations, the collection tree, partners, glossary, timelines, any record;
- run JMESPath queries over any file of any package family;
- read import-quality statistics: translation coverage, empty fields, items without images, partner item counts;
- compare two published versions, from a per-file summary down to one record field by field;
- view the images a record references.

Every record is shown with its inventory `id` and its legacy `backward_compatibility` key, and every lookup accepts either, so a finding leads straight to the record in `/admin` or to its legacy source.

## Using it

The repository's `.mcp.json` registers the server as `mwnf-data-packages`. It runs in Docker through the `data-packages-mcp` compose service; open the repository in Claude Code and approve the project server when asked. Start with `list_packages`, then `select`, then `diff_versions` or the browsing tools.

The tools, the package families, how downloads are verified and how to run the tests are documented in the project's [README](https://github.com/museumwithnofrontiers/inventory-app/blob/main/scripts/data-packages-mcp/README.md).
