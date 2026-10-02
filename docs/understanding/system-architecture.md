---
layout: default
title: System Architecture
parent: Understanding the Inventory
nav_order: 6
---

# System Architecture

MWNF Inventory is the content layer that replaces direct dependency on legacy databases. Applications should use Inventory interfaces instead of reading the legacy databases directly.

## Main parts

| Part | Role |
|---|---|
| Laravel application | Owns the Inventory model, authentication, authorization, Filament back-office, management API, queues, and generated API documentation. |
| Filament `/admin` | The application's only user interface: the back-office for authenticated content and account management. `/` redirects to it. |
| Management API | Authenticated read/write API for programmatic management access. |
| Importer | Node.js tool that reads legacy databases, transforms content, and writes Inventory records. |
| Documentation site | Jekyll site that explains the model, import, collaborator orientation, generated OpenAPI reference, and generated model reference. |
| Future read-only API | Planned API optimized for public and lightweight front-end clients. |

## Data flow

Legacy databases feed the importer. The importer writes normalized content into Inventory. Content managers work through Filament. Programmatic management tools use the management API. Public clients should later use the read-only API, which is designed around delivery needs rather than raw database structure.

```text
Legacy databases and files
        |
        v
Importer transformation
        |
        v
Inventory database and Laravel model
        |
        +--> Filament /admin back-office
        +--> Management API
        +--> Future read-only API
        +--> Documentation and validation references
```

## Why a read-only API is separate

The management API reflects the management model and supports authenticated create, update, and delete workflows. The planned read-only API has a different purpose. It should shape content for fast public consumption, reduce client-side joins, and return data in forms that lightweight applications can use directly.

This keeps the Inventory model clean while still allowing public clients to receive practical responses.
