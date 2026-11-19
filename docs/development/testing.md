---
layout: default
title: Testing
nav_order: 1
parent: Development
has_children: true
---

# Testing Guide

Every change to the codebase must include tests. This page explains how to run existing tests and how to write new ones following established patterns.

## Running Tests

```bash
# Run all backend tests (parallel for speed)
composer ci-test

# Run a specific test suite
php artisan test tests/Unit
php artisan test tests/Feature
php artisan test tests/Integration

# Run a single test file
php artisan test tests/Feature/Api/Item/IndexTest.php
```

### On Windows with Docker Desktop: run from a volume

Docker Desktop reads a bind-mounted Windows folder through the WSL2 VM's file share, and that share is slow for the many small PHP files a test run loads. Measured on 4 CPUs, the whole suite takes about 55 minutes from the bind mount and 7.5 minutes from a volume; 10 Filament tests take 152 s and 13 s. `scripts/Invoke-VolumeCheck.ps1` copies the checkout into a Docker volume first (about 10 to 20 s) and runs one check there:

```powershell
.\scripts\Invoke-VolumeCheck.ps1 -Check pint
.\scripts\Invoke-VolumeCheck.ps1 -Check phpstan
.\scripts\Invoke-VolumeCheck.ps1 -Check tests
.\scripts\Invoke-VolumeCheck.ps1 -Check tests -Tests tests/Filament/RelationManagers
.\scripts\Invoke-VolumeCheck.ps1 -Check tests -Path C:\worktrees\my-branch
```

Each check uses its own volume, so the three can run at the same time. PHPStan keeps its result cache between runs. The copy is one-way: Pint only reports (`--test`), so fix style on the checkout itself.

## Test Organisation

```
tests/
├── Feature/
│   └── Api/
│       └── [Entity]/
│           ├── AnonymousTest.php     # Unauthenticated access
│           ├── IndexTest.php         # GET /api/[entity]
│           ├── ShowTest.php          # GET /api/[entity]/{id}
│           ├── StoreTest.php         # POST /api/[entity]
│           ├── UpdateTest.php        # PUT/PATCH /api/[entity]/{id}
│           └── DestroyTest.php       # DELETE /api/[entity]/{id}
├── Integration/                      # Cross-cutting workflow tests
└── Unit/
    └── [Entity]/
        └── FactoryTest.php           # Model factory and constraint tests
```

## Key Principles

- **Write tests for all new functionality** — no untested code enters `main`.
- **Follow existing patterns** — look at a similar entity's tests and replicate the structure.
- **Use `RefreshDatabase`** — every test starts with a clean database.
- **Use factories** — `.create()` for records that need to be in the database, `.make()->toArray()` for request payloads.
- **Authenticate** — use `$this->actingAs(User::factory()->create())` for authenticated endpoints.
- **Test behaviour, not framework internals** — focus on your business logic, not on whether Laravel works.

## What Reviewers Look For

1. **Coverage** — new features and bug fixes have corresponding tests.
2. **Isolation** — each test is independent; no test depends on another.
3. **Clarity** — descriptive test names that explain the scenario being tested.
4. **Edge cases** — validation failures, missing records, and permission denials are tested.

---

For related information, see:

- [Contributing Guide](contributing) — PR workflow and quality standards
- [Backend Guidelines]({{ '/guidelines/' | relative_url }}) — Coding conventions
