---
layout: default
title: Development Setup
parent: Deployment Guide
nav_order: 2
---

# Development Setup

{: .no_toc }

Complete guide for setting up a local development environment for the Inventory Management API.

## Table of Contents

{: .no_toc .text-delta }

1. TOC
   {:toc}

---

## Prerequisites

### System Requirements

| Component   | Minimum                                 | Recommended     |
| ----------- | --------------------------------------- | --------------- |
| **OS**      | Windows 10/11, macOS 12+, Ubuntu 20.04+ | Latest versions |
| **RAM**     | 8 GB                                    | 16 GB+          |
| **Storage** | 10 GB free space                        | 20 GB+ SSD      |

### Required Software

**Docker Desktop** (or Docker Engine + Compose v2). Nothing else — no PHP, no
Composer, no Node, no database on the host. Every tool the project needs lives
in `.docker/Dockerfile`, built and versioned once, so every contributor and CI
run the same toolchain. Installing PHP, Composer, or Node.js directly on your
workstation is not part of the supported workflow — see the root
[`README.md`](https://github.com/metanull/inventory-app/blob/main/README.md#getting-started)
for the canonical setup instructions this page mirrors.

Also useful, though not required to run the stack:

- **Git**
- **VS Code** (recommended, with the Dev Containers extension if you want the
  editor attached inside the `app` container — see
  [`.devcontainer/devcontainer.json`](https://github.com/metanull/inventory-app/blob/main/.devcontainer/devcontainer.json))

## Step 1: Install Docker

Install Docker Desktop (Windows/macOS) or Docker Engine + the Compose v2 plugin
(Linux), then verify:

```bash
docker --version
docker compose version
```

That's the entire prerequisite. `.docker/Dockerfile`'s `dev` target already
bundles PHP, the required extensions, Composer, and Node — nothing here is
installed or version-pinned on your machine, so nothing here can drift from
what CI and production run.

## Step 2: Project Setup

### 2.1 Clone Repository

```bash
git clone https://github.com/metanull/inventory-app.git
cd inventory-app
```

### 2.2 Start the Stack

```bash
docker compose up -d
```

This builds the image, starts MySQL, Valkey, and Mailpit, waits for them to be
healthy, installs Composer dependencies into a named volume, runs the
migrations, and brings up php-fpm, nginx, and a queue worker. Environment
configuration for the dev stack (database, cache, queue, mail) is supplied by
`compose.yml` itself, not by a `.env` file you need to create or edit.

**Access the application:**

| | |
|---|---|
| Admin panel (the active UI) | http://localhost:8010/admin |
| API docs | http://localhost:8010/docs/api |
| Mailpit (captures all outbound mail) | http://localhost:8026 |
| MySQL | `127.0.0.1:3337`, database/user `inventory`, password `secret` |

See the root [`README.md`](https://github.com/metanull/inventory-app/blob/main/README.md)
for the full list of profiles (`staging`, `docs`, `tools`, `jobs`, `import`),
ports, and volumes.

## Step 3: Development Servers

`docker compose up -d` (Step 2.2) already starts everything — there is no
separate "start the server" step. To watch the logs or restart a single
service:

```bash
docker compose logs -f app
docker compose restart app
```

Front-end asset work (Vite) runs through the `tools` profile, so the dev image
stays free of a running Vite process:

```bash
docker compose run --rm tools npm ci
docker compose run --rm --service-ports tools npm run dev   # vite on :5173
```

## Step 4: IDE Configuration

### 4.1 VS Code Setup

Install recommended extensions:

```json
{
  "recommendations": [
    "bmewburn.vscode-intelephense-client",
    "Vue.volar",
    "bradlc.vscode-tailwindcss",
    "ryannaddy.laravel-artisan",
    "onecentlin.laravel-blade",
    "mikestead.dotenv"
  ]
}
```

### 4.2 VS Code Settings

Intelephense needs *a* PHP binary to introspect, but not the one that runs
your code — it never has to be the same version as `.docker/Dockerfile`. If
you don't have PHP on your machine at all, omit `php.validate.executablePath`
and let Intelephense fall back to its bundled stubs.

```json
{
  "intelephense.files.maxSize": 3000000,
  "vetur.validation.template": false,
  "vetur.validation.script": false,
  "vetur.validation.style": false
}
```

### 4.3 Debug Configuration

Step debugging (Xdebug) is compiled into the `dev` image but off by default.
Set `XDEBUG_MODE=debug` on the `app` container (or uncomment the line in
`.devcontainer/devcontainer.json`) to arm it against port 9003, then create
`.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Chrome",
      "request": "launch",
      "type": "pwa-chrome",
      "url": "http://localhost:8010",
      "webRoot": "${workspaceFolder}/resources/js"
    },
    {
      "name": "Listen for Xdebug",
      "type": "php",
      "request": "launch",
      "port": 9003,
      "pathMappings": {
        "/var/www/app": "${workspaceFolder}"
      }
    }
  ]
}
```

## Step 5: Development Workflow

### 5.1 Daily Development

```bash
# Start the stack (if not already running)
docker compose up -d

# Access applications:
# - Admin panel: http://localhost:8010/admin
# - API docs: http://localhost:8010/docs/api
# - Vite dev server: http://localhost:5173 (docker compose run --rm --service-ports tools npm run dev)
```

### 5.2 Code Quality

Everything runs inside the containers — see
[`scripts/Invoke-Check.ps1`](https://github.com/metanull/inventory-app/blob/main/scripts/Invoke-Check.ps1)
and
[`scripts/Invoke-Fix.ps1`](https://github.com/metanull/inventory-app/blob/main/scripts/Invoke-Fix.ps1)
for the full set of checks. Directly:

```bash
docker compose exec app composer check      # pint --test, phpstan, pest
docker compose exec app composer pint       # fix code style
docker compose exec app composer stan       # phpstan
docker compose run --rm tools npx prettier --check --ignore-unknown ./resources/**
```

### 5.3 Database Management

```bash
# Snapshot auth before a destructive reset
docker compose exec app php artisan auth:snapshot auth-snapshots/pre-reset.json.enc --force

# Reset database and run migrations
docker compose exec app php artisan db:wipe --force
docker compose exec app php artisan migrate --force
docker compose exec app php artisan db:seed --class=MinimalDatabaseSeeder --force
docker compose exec app php artisan permissions:sync

# Restore users, MFA setup, role assignments, direct permissions, and API tokens
docker compose exec app php artisan auth:restore auth-snapshots/pre-reset.json.enc --force

# Create new migration
docker compose exec app php artisan make:migration create_example_table

# Create new model with factory and seeder
docker compose exec app php artisan make:model Example -mfs

# Run specific seeder
docker compose exec app php artisan db:seed --class=ExampleSeeder
```

On Windows, `scripts/Reset-Database.ps1` wraps the snapshot/wipe/migrate/seed/
restore sequence above in one command, already routed through
`docker compose run --rm app`.

### 5.4 Frontend Development

```bash
# Install new frontend dependency
docker compose run --rm tools npm install package-name

# Run frontend tests
docker compose run --rm tools npm run test

# Build for production
docker compose run --rm tools npm run build
```

## Step 6: Testing Environment

### 6.1 Backend Testing

The suite runs against SQLite `:memory:` — `phpunit.xml` forces that
regardless of the container's own `DB_CONNECTION`, so tests never touch the
dev database:

```bash
docker compose exec app composer test                            # everything
docker compose exec app php artisan test --testsuite=Api         # one suite
docker compose exec app php artisan test --filter ExampleTest    # one test
```

### 6.2 Frontend Testing

```bash
docker compose run --rm tools npm run test
docker compose run --rm tools npm run test:watch
```

### 6.3 API Testing

```bash
curl -X GET http://localhost:8010/api/projects \
     -H "Accept: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN"
```

**Windows (PowerShell)**, where the trailing `\` line continuation is bash
syntax — use a backtick, and call `curl.exe` directly so it isn't resolved to
the `Invoke-WebRequest` alias:

```powershell
curl.exe -X GET http://localhost:8010/api/projects `
     -H "Accept: application/json" `
     -H "Authorization: Bearer YOUR_TOKEN"
```

## Step 7: Common Development Tasks

### 7.1 Creating New Features

```bash
# 1. Create migration
docker compose exec app php artisan make:migration create_feature_table

# 2. Create model with factory and seeder
docker compose exec app php artisan make:model Feature -mfs

# 3. Create controller
docker compose exec app php artisan make:controller FeatureController --api

# 4. Create resource
docker compose exec app php artisan make:resource FeatureResource

# 5. Add routes to routes/api.php
# 6. Create tests
docker compose exec app php artisan make:test FeatureTest
```

### 7.2 Database Seeding

```bash
# Create seeder
docker compose exec app php artisan make:seeder FeatureSeeder

# Add to DatabaseSeeder.php
# Run seeder
docker compose exec app php artisan db:seed --class=FeatureSeeder
```

### 7.3 Frontend Components

```bash
# Create new Vue component in resources/js/components/
# Add to router in resources/js/router/index.ts
# Create tests in resources/js/components/__tests__/
```

## Step 8: Troubleshooting

### 8.1 Common Issues

#### Port Already in Use

The dev stack binds to `8010` (see the port table in the root `README.md`).
Find and stop whatever already owns it:

**Linux/macOS:**

```bash
lsof -ti:8010 | xargs kill -9
```

**Windows (PowerShell)**, where `lsof`/`xargs` do not exist:

```powershell
Get-NetTCPConnection -LocalPort 8010 -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Stop-Process -Id $_ -Force }
```

Or change the published port for the `web` service in `compose.yml`.

#### Composer Issues

```bash
docker compose exec app composer clear-cache
docker compose run --rm --no-deps app composer update
docker compose exec app composer dump-autoload
```

#### NPM Issues

```bash
docker compose run --rm tools npm cache clean --force
docker compose run --rm tools sh -c "rm -rf node_modules package-lock.json && npm install"
```

### 8.2 Performance Issues

#### Slow Artisan Commands

```bash
# Clear all caches
docker compose exec app php artisan optimize:clear

# Disable Xdebug when not debugging — unset XDEBUG_MODE (or leave it unset,
# it is off by default) rather than editing php.ini inside the container.
```

#### Slow Frontend Compilation

```bash
docker compose run --rm --service-ports tools npm run dev -- --host
```

To raise Node's memory limit for the `tools` container, set `NODE_OPTIONS` as
an environment override on the `run` command rather than inside the
container:

```bash
docker compose run --rm -e NODE_OPTIONS=--max-old-space-size=4096 tools npm run build
```

## Step 9: Development Scripts

### 9.1 Composer Scripts

Available composer scripts for development, run inside the container:

```bash
# Quality checks
docker compose exec app composer ci-lint
docker compose exec app composer ci-test
docker compose exec app composer ci-before:pull-request
```

See [Scripts]({{ '/development/scripts' | relative_url }}) for the
Docker-wrapped PowerShell helpers (`scripts/Invoke-Check.ps1`,
`scripts/Invoke-Fix.ps1`, `scripts/Invoke-Pest.local.ps1`,
`scripts/Invoke-Phpstan.local.ps1`) that call these same commands.

## Step 10: Git Workflow

### 10.1 Branch Management

```bash
# Create feature branch
git checkout -b feature/new-feature

# Commit changes
git add .
git commit -m "feat: add new feature"

# Push branch
git push origin feature/new-feature
```

### 10.2 Pre-commit Checks

```bash
docker compose exec app composer ci-before:pull-request
```

This runs:

- Code formatting (Pint)
- Tests (PHPUnit)
- Security audit
- OpenAPI documentation generation

---

## Next Steps

- [Configuration](configuration) - Advanced configuration options
- [Testing Guide]({{ '/development/testing' | relative_url }}) - Comprehensive testing strategies
- [API Documentation]({{ '/api/' | relative_url }}) - API endpoint documentation
