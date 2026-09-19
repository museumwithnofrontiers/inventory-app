---
layout: default
title: Home
nav_order: 1
---

[![github](https://img.shields.io/badge/Source-github-151013.svg?logo=github&logoColor=white&labelColor=555555)](https://github.com/museumwithnofrontiers/inventory-app)
[![LICENSE](https://img.shields.io/badge/license-MIT-428f7e.svg?logo=open%20source%20initiative&logoColor=white&labelColor=555555)](https://github.com/metanull/inventory-app/blob/main/LICENSE)
[![Continuous Integration](https://github.com/museumwithnofrontiers/inventory-app/actions/workflows/continuous-integration.yml/badge.svg)](https://github.com/museumwithnofrontiers/inventory-app/actions/workflows/continuous-integration.yml)
[![Build](https://github.com/museumwithnofrontiers/inventory-app/actions/workflows/build.yml/badge.svg)](https://github.com/museumwithnofrontiers/inventory-app/actions/workflows/build.yml)
[![Documentation](https://github.com/museumwithnofrontiers/inventory-app/actions/workflows/continuous-deployment_github-pages.yml/badge.svg)](https://museumwithnofrontiers.github.io/inventory-app)

# MWNF Inventory Documentation

MWNF Inventory replaces a fragmented legacy data landscape with one content-focused Inventory. The system stores museum content, organizes it through a rationalized model, and exposes it through an integrated Filament back-office and programmatic APIs.

The documentation starts with the business model and the import process because validation is the current priority. Technical references remain available, but they support the main explanation instead of driving it.

## Start here

| Audience | Start with | Purpose |
|---|---|---|
| Customers, content owners, and validators | [Understanding the Inventory](understanding/) | Learn what the new model means and how legacy content lands in it. |
| Collaborators and developers | [Collaborator Guide](collaborators/) | Learn where the code lives and how the main systems fit together. |
| API consumers | [Management API Reference](api/) | Inspect the authenticated management API and generated TypeScript client. |
| Data model reviewers | [Database Models](models/) | Open generated model, field, and relationship reference pages. |

## What this system does

- It stores reusable MWNF content only: objects, monuments, partners, collections, images, translations, glossary entries, timelines, links, tags, contributors, and related media.
- It keeps application-specific configuration outside the Inventory model.
- It uses `/admin` as the main back-office through Filament.
- It keeps the management API as a maintained programmatic interface.
- It prepares the ground for a dedicated read-only API optimized for lightweight public clients.

## Validation focus

The project is at the import and validation stage. Use the documentation in this order:

1. Read [Inventory Principles](understanding/inventory-principles) to understand what belongs in the Inventory.
2. Read [Core Model](understanding/core-model) to map legacy ideas to new concepts.
3. Read [Legacy Import](understanding/legacy-import) to understand the source-to-target flow.
4. Use [Validation Guide](understanding/validation-guide) when comparing legacy records with imported results.

## Technical orientation

Collaborators should start with [Codebase Map](collaborators/codebase-map), then follow the page that matches the task:

- [Filament Back-Office](collaborators/filament-admin) for `/admin` UI work.
- [Importer Orientation](collaborators/importer) for legacy data import work.
- [APIs and Documentation](collaborators/apis-and-docs) for API, OpenAPI, client, and Jekyll documentation work.
- [Development Workflow](collaborators/development-workflow) for setup, testing, and validation commands.

## Reference material

- [Generated Database Models](models/) gives field-level model reference.
- [Management API Reference](api/) gives Swagger UI, OpenAPI, and TypeScript client links.
- [Deployment Guide](deployment/) keeps operational setup notes.
- [Technical Archive](development/) keeps older developer notes that still help maintainers, but the current project narrative lives in the new `understanding/` and `collaborators/` sections.

_Last updated: {{ site.time | date: "%B %d, %Y" }}_
