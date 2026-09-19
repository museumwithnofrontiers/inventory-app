# Inventory Management System

[![github](https://img.shields.io/badge/Source-github-151013.svg?logo=github&logoColor=white&labelColor=555555)](https://github.com/museumwithnofrontiers/inventory-app)
[![github](https://img.shields.io/badge/Documentation-github-878787.svg?logo=github&logoColor=white&labelColor=8a8a9a)](https://museumwithnofrontiers.github.io/inventory-app/)
[![PHP 8.2+](https://img.shields.io/badge/php-8.2+-777bb3.svg?logo=php&logoColor=white&labelColor=555555)](https://php.net)
[![Laravel 12](https://img.shields.io/badge/laravel-12-f05340.svg?logo=laravel&logoColor=ffffff&labelColor=6c6c6c)](https://laravel.com)
[![LICENSE](https://img.shields.io/badge/license-MIT-428f7e.svg?logo=open%20source%20initiative&logoColor=white&labelColor=555555)](https://github.com/metanull/inventory-app/blob/main/LICENSE)

The Inventory Management System is the digital backbone of **Museum With No Frontiers (MWNF)**. It stores and serves the inventory of museum artifacts, monuments, and related cultural heritage content managed by partner institutions around the world.

## Quick Links

- 📚 **[Full Documentation](https://museumwithnofrontiers.github.io/inventory-app/)** — Complete guides and references
- 📖 **[Core Concepts](https://museumwithnofrontiers.github.io/inventory-app/concepts)** — Understand what the system does (start here)
- 🔌 **[API Documentation](http://localhost:8000/docs/api)** — Interactive Swagger UI (when running locally)

## What the System Does

- **Manages cultural heritage inventory** — items (artifacts, monuments), partners (museums, institutions), collections (exhibitions, galleries, thematic trails), and projects.
- **Supports multi-language, multi-audience content** — every item can have translations in multiple languages, each tailored to a specific audience (general public, academic, educational, etc.).
- **Handles images** — upload, process, and attach photographs to items, collections, and partners.
- **Controls access** — role-based permissions determine who can view, create, edit, or delete records.

For a detailed explanation of every entity and business rule, see the **[Core Concepts](https://museumwithnofrontiers.github.io/inventory-app/concepts)** page.

## What's Inside This Repository

This **monorepo** contains:

| Component | Description |
| --------- | ----------- |
| **Web Interface** | The main production UI — server-rendered pages for managing all inventory data (Blade/Livewire) |
| **REST API** | Authenticated endpoints for programmatic access, with OpenAPI documentation |
| **Documentation Site** | Jekyll-based docs deployed to GitHub Pages |

### Pipelines Status

[![Continuous Integration](https://github.com/museumwithnofrontiers/inventory-app/actions/workflows/continuous-integration.yml/badge.svg)](https://github.com/museumwithnofrontiers/inventory-app/actions/workflows/continuous-integration.yml)
[![CodeQL](https://github.com/museumwithnofrontiers/inventory-app/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/museumwithnofrontiers/inventory-app/actions/workflows/github-code-scanning/codeql)
[![Build](https://github.com/museumwithnofrontiers/inventory-app/actions/workflows/build.yml/badge.svg)](https://github.com/museumwithnofrontiers/inventory-app/actions/workflows/build.yml)
[![GitHub Pages](https://github.com/museumwithnofrontiers/inventory-app/actions/workflows/continuous-deployment_github-pages.yml/badge.svg)](https://github.com/museumwithnofrontiers/inventory-app/actions/workflows/continuous-deployment_github-pages.yml)
[![Dependabot](https://github.com/museumwithnofrontiers/inventory-app/actions/workflows/dependabot/dependabot-updates/badge.svg)](https://github.com/museumwithnofrontiers/inventory-app/actions/workflows/dependabot/dependabot-updates)

## Getting Started

### Prerequisites

**Docker Desktop** (or Docker Engine + Compose v2). Nothing else — no PHP, no
Composer, no Node, no database on the host. Every tool the project needs lives
in `.docker/Dockerfile`.

### Installation

```bash
git clone https://github.com/museumwithnofrontiers/inventory-app.git
cd inventory-app
docker compose up -d
```

That builds the image, starts MySQL, Valkey, and Mailpit, waits for them to be
healthy, installs Composer dependencies into a named volume, runs the
migrations, and brings up php-fpm, nginx, and a queue worker.

**Access the application:**

| | |
|---|---|
| Admin panel (the active UI) | http://localhost:8010/admin |
| API docs | http://localhost:8010/docs/api |
| Mailpit (captures all outbound mail) | http://localhost:8026 |
| MySQL | `127.0.0.1:3337`, database/user `inventory`, password `secret` |

### Everyday commands

Everything runs inside the `app` container:

```bash
docker compose exec app php artisan migrate
docker compose exec app php artisan tinker
docker compose exec app composer check      # pint --test, phpstan, pest
```

Individual quality gates, should you want them one at a time:

```bash
docker compose exec app composer pint       # fix code style
docker compose exec app composer pint:test  # check style, change nothing
docker compose exec app composer stan       # phpstan
docker compose exec app composer test       # pest, sqlite :memory:
```

Front-end and other Node work uses the `tools` profile, so the dev image stays
free of a running Vite process:

```bash
docker compose run --rm tools npm ci
docker compose run --rm --service-ports tools npm run dev   # vite on :5173
```

The documentation site is its own profile:

```bash
docker compose --profile docs up -d          # Jekyll on http://localhost:4000
```

Step debugging is compiled in but off by default; set `XDEBUG_MODE=debug` on
the container (or uncomment the line in `.devcontainer/devcontainer.json`) to
arm it against port 9003.

### Running the real dataset locally (staging)

The `staging` profile serves the actual imported collection — every record and
every image — from your own machine, with no network dependency once it is
populated:

```bash
docker compose --profile staging up -d
docker compose run --rm staging-seed-auth              # once
```

Then http://localhost:8020/admin, as `admin@example.com` / `password`.

This is not the dev stack with different data. `staging-app` runs the `prod`
target of `.docker/Dockerfile` with the code **baked in**, so what you click
through is what would ship — rebuild it after changing code:

```bash
docker compose --profile staging build staging-app
```

| | Development | Staging |
|---|---|---|
| URL | http://localhost:8010 | http://localhost:8020 |
| Image | `dev` target, code bind-mounted | `prod` target, code baked in |
| Database | `mysql` (:3337), seeded fixtures | `staging-mysql` (:3316), the real import |
| Images | none | the staged image volume |
| `APP_ENV` | `local`, debug on | `staging`, debug off |
| Redis DBs | 2 / 3 | 4 / 5 |

The two are deliberately separate: a `migrate:fresh` while you are developing
must never cost you a re-import. Populating staging is the importer's job — see
[scripts/import-tool/README.md](scripts/import-tool/README.md). The import runs
in two phases that cannot overlap: `stage` builds this local copy from the
legacy source, and `ship` sends that copy — and only that copy — to the
deployed server.

Accounts created by `staging-seed-auth` are local-only and cannot escape: the
importer's `ship` step excludes `users`, `roles`, `permissions` and tokens from
its dump outright, and rebuilds the remote auth layer from its own encrypted
snapshot.

### Exporting a dataset

The exporters read the staging database and write static JSON for the public
websites. They run in the same profile, so there is nothing extra to start:

```bash
docker compose run --rm exporter islamicart --force
docker compose run --rm exporter baroqueart --force
docker compose run --rm exporter sharinghistory --force
```

Output lands in `scripts/exporters/<dataset>/output` on the host. Arguments
after the dataset name are passed straight through, so `--output-dir`,
`--base-url` and `--publish` all work as documented in
[scripts/exporters/README.md](scripts/exporters/README.md).

The exporters emit image *URLs*, not image files. `BASE_URL` in each
`scripts/exporters/<dataset>/.env` still applies (only `DB_*` is forced to the
staging database), so exports point at the deployed site by default. To produce
a package a local viewer can consume, point it at the staging app instead:

```bash
docker compose run --rm exporter islamicart --force \
  --base-url http://localhost:8020
```

The staging app answers `/pub/<uuid>.jpg` — the same public, unauthenticated,
rate-limited route the deployed site uses for exported data — so the resulting
package works offline against your local images.

Node dependencies install into named volumes on first run rather than the host
`node_modules`, because `tsx` pulls in esbuild and its binary is
platform-specific.

### Testing

The suite runs against SQLite `:memory:` — `phpunit.xml` forces that regardless
of the container's own `DB_CONNECTION`, so tests never touch the dev database:

```bash
docker compose exec app composer test                            # everything
docker compose exec app php artisan test --testsuite=Api         # one suite
```

### Ports and volumes

Everything binds to `127.0.0.1` only — nothing on this stack is reachable from
outside the machine.

| Port | Service | Profile |
|---|---|---|
| 8010 | development app (nginx) | default |
| 8020 | staging app | `staging` |
| 3337 | development MySQL | default |
| 3316 | staging MySQL | `staging`, `import` |
| 8026 | Mailpit web UI | default |
| 1026 | Mailpit SMTP | default |
| 4000 | documentation site | `docs` |
| 5173 | Vite dev server (`run --service-ports tools`) | `tools` |
| 9003 | Xdebug, when `XDEBUG_MODE=debug` | default |

Volumes fall into two groups, and the separator in the name tells you which:

| Volume | Contents | `down -v` |
|---|---|---|
| `inventory_dev-mysql-data` | development database | destroys it — migrations rebuild |
| `inventory_dev-valkey-data` | development cache/queue | destroys it |
| `inventory_dev-vendor` | Composer dependencies | destroys it — `migrate` reinstalls |
| `inventory_docs-bundle` | Jekyll gems | destroys it |
| `inventory_exporter-<dataset>-modules` | exporter `node_modules` | destroys it |
| `inventory-staging-mysql-data` | **the staged database** | **cannot touch it** |
| `inventory-staging-images` | **the staged images (~7.5 GB)** | **cannot touch it** |

The two staging volumes are declared `external:`, so Compose neither creates
nor removes them, and their names use a hyphen rather than the underscore
Compose gives its own. Create them once before the first import, and see
[scripts/import-tool/README.md](scripts/import-tool/README.md) for backup and
restore.

## Contributing

- ✅ All tests must pass
- ✅ All linters must pass (Laravel Pint, ESLint)
- ✅ No TypeScript errors (strict typing)
- ✅ Branch-based workflow (no direct `main` commits)

> **For complete contribution guidelines**, see the [Full Documentation](https://museumwithnofrontiers.github.io/inventory-app/).

