---
layout: default
title: Coding Guidelines
nav_order: 1
parent: Backend Guidelines
---

# Coding Guidelines

This page covers conventions specific to this project. For general Laravel or PHP knowledge, refer to the [official Laravel documentation](https://laravel.com/docs) and [PSR-12](https://www.php-fig.org/psr/psr-12/).

## General Principles

- Follow **PSR-12** coding standards — enforced by Laravel Pint.
- Use **type hints** on all method parameters and return types.
- Keep functions and classes small and focused on a single responsibility.
- Use PHPDoc to document complex business logic — not to restate what the code already says.

## Naming Conventions

- **Models**: singular PascalCase (`Item`, `CollectionTranslation`)
- **Controllers**: `{Model}Controller` (e.g., `ItemController`)
- **Form Requests**: `Store{Model}Request`, `Update{Model}Request`
- **Resources**: `{Model}Resource`
- **Factories**: `{Model}Factory`
- **Database tables**: plural snake_case (`items`, `collection_translations`)
- **Database columns**: snake_case (`internal_name`, `partner_id`)
- **API routes**: singular nouns (`/api/item`, `/api/context`)
- **Admin panel routes**: Filament derives them from each resource (`/admin/items`, `/admin/contexts`)

## Model Conventions

- All models use **UUID primary keys** via the `HasUuids` trait, except:
  - `Language` — uses ISO 639-1 code (e.g., `en`)
  - `Country` — uses ISO 3166-1 alpha-3 code (e.g., `EGY`)
  - `User` — uses Laravel default integer keys
- Every model has an `internal_name` field for use in the management interface (not the public-facing name — that lives in translations).
- Relationships use standard Eloquent methods (`belongsTo`, `hasMany`, `belongsToMany`).

## Entity Structure Pattern

Each entity follows a consistent file layout:

```
app/Http/Controllers/{Entity}Controller.php
app/Http/Requests/Store{Entity}Request.php
app/Http/Requests/Update{Entity}Request.php
app/Http/Resources/{Entity}Resource.php
app/Models/{Entity}.php
database/factories/{Entity}Factory.php
database/migrations/create_{entities}_table.php
database/seeders/{Entity}Seeder.php
tests/Feature/Api/{Entity}/AnonymousTest.php
tests/Feature/Api/{Entity}/IndexTest.php
tests/Feature/Api/{Entity}/ShowTest.php
tests/Feature/Api/{Entity}/StoreTest.php
tests/Feature/Api/{Entity}/UpdateTest.php
tests/Feature/Api/{Entity}/DestroyTest.php
```

When adding a new entity, replicate this structure and follow the patterns in an existing entity (e.g., `Context`).

## Quality Controls

Run these before submitting code:

```bash
# Lint PHP (auto-fix)
composer ci-lint

# Lint check only (non-modifying)
composer ci-lint:test

# Run all tests
composer ci-test

# Build frontend assets
composer ci-build

# Full pre-PR validation
composer ci-before:pull-request
```

## Import Order

Organise `use` statements in this order:

1. Laravel/Framework imports
2. Third-party imports
3. Application Models
4. Application Resources
5. Application Requests
6. Application Services

## Common Pitfalls

- **Not running Pint** before committing — always run `composer ci-lint`.
- **Missing type hints** — every parameter and return value must be typed.
- **Ignoring mass assignment** — define `$fillable` on every model.
- **Not testing** — every new feature or fix needs tests.
- **Editing migrations** — never alter an existing migration; create a new one.
