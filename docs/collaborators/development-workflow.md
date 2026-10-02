---
layout: default
title: Development Workflow
parent: Collaborator Guide
nav_order: 5
---

# Development Workflow

Use the Dev Container for PHP and Node tooling on Windows. It provides the PHP extensions and Node.js version expected by the project.

## Common backend validation

Use VS Code tasks when available. The main backend checks are:

```powershell
vendor/bin/pint --no-ansi
php artisan test --testsuite=Filament --no-coverage --parallel --no-ansi --stop-on-failure
php artisan test --testsuite=Api --no-coverage --parallel --no-ansi --stop-on-failure
php artisan test --testsuite=Unit --no-coverage --parallel --no-ansi --stop-on-failure
```

For full readiness, run the complete configured backend test matrix.

## Documentation validation

Build the Jekyll site from `docs/` before shipping documentation changes:

```bash
bundle exec jekyll build
```

On Windows, use WSL or Docker if Ruby is not available on the host.

## Test placement

- Put new Filament tests in `tests/Filament/`.
- Put management API tests in `tests/Api/`.
- Put pure PHP business logic tests in `tests/Unit/`.

## Safe change habits

- Create new migrations instead of editing existing migrations.
- Keep generated files out of manual edits.
- Keep importer transformation logic close to transformer files.
- Use existing model methods for image attach and detach workflows.
- Build authentication pages as Filament pages; Fortify serves no route.
