# NPM Package Publishing Guide

How `--publish` turns an export into a released version of a site's
`@museumwnf/<slug>-data` package on npmjs. What a package *contains* is
documented in [`README.md`](README.md) and
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md);
this guide covers the publishing mechanics only.

## Quick start

```bash
docker compose --profile jobs run --rm exporter dxa-gallery --instance <slug> --force --publish
```

That single run does everything:

1. Exports the gallery to `output/<slug>/`
2. Bumps the patch version persisted in `output/.version-<slug>`
   (1.0.0 → 1.0.1, …)
3. Generates `package.json` and a consumer `README.md` inside `output/<slug>/`
4. Runs `npm publish` from that directory against npmjs

There is **no separate manual `npm publish` step** — running one after
`--publish` would fail as a duplicate version.

### Staging schema must be current

The `exporter` service reads `staging-mysql`, not the legacy DB or the app's
own dev database — and `stage` only migrates on a full rebuild. After
pulling a change that adds a migration, run the migration against staging
before exporting:

```bash
docker compose --profile jobs run --rm staging-migrate
```

(non-destructive — `php artisan migrate --force` from the mounted repo). A
full `stage` re-run also covers it. Skipping this can fail the export with
an `Unknown column` error for a field the new migration added. It also
leaves that column **NULL**: columns populated by the importer only get real
values on the next full `stage`, so a package exported right after a bare
migration carries nulls for those fields until then.

## Version management

The version counter lives in `output/.version-<slug>` — one counter per site,
deliberately *outside* the site's own output directory, so `--force` (which
deletes and recreates `output/<slug>/`) does not reset it.

- Each `--publish` run computes the next patch component from the registry
  and the local counter — the choice between them is unchanged.
- **The first `--publish` from this directory has no counter file for a given
  slug.** Every site published here was previously published from its own
  forked exporter (`../carpets`, `../amulets`, …) under the same package
  name, so this exporter's first publish for that slug takes the *registry*
  version + 1 rather than restarting at 1.0.0 (the registry is asked first —
  see `PublishManager.getNextVersion`). The forks' own `.version-<slug>`
  counter files are not, and need not be, carried over to this directory.
- `--package-version <semver>` sets an explicit version instead.
- Either way, the version is persisted to the counter file only once
  `npm publish` has actually succeeded. A failed publish — a collision, a
  network error, a dead session — leaves the file untouched, so it never
  burns a number. That also means a plain rerun after a failure retries the
  very same version and fails the same way; fix the underlying cause, or
  pass `--package-version` explicitly, rather than expecting a rerun to
  auto-increment past it.

⚠ The whole `output/` directory is **gitignored**, version files included. If
one is lost (fresh clone, deleted output directory), the next `--publish` for
that slug would ask the registry first (see above) rather than blindly
restarting at 1.0.0 — but if the package has never been published at all,
recover by passing `--package-version` with the intended next version.

## Package structure

The published package is the output directory itself:

```
output/<slug>/
├── package.json          ← generated on every --publish run
├── README.md             ← generated consumer usage guide
├── LICENSE.md            ← copy of docs/LICENSE.md.template (the MWNF legal notice)
├── manifest.json
├── gallery.json, items.json, tags.json, partners.json, …   (see README.md)
└── translations/
    └── <entity>.<lang>.json
```

The `files` allow-list in the generated `package.json` restricts the publish
to `*.json`, `translations/*.json` and `README.md` — the `.json.gz`
companions written by the export stay local and are never published.

npm includes `LICENSE.md` in the tarball automatically — it is not, and does
not need to be, in the `files` allow-list.

## Package metadata

The generated `package.json` carries:

- **name** — the instance file's `package_name`
- **version** — from the version file (see above)
- **description** — names the exported gallery slug
- **exports** — `manifest.json` as the entry point, plus every top-level
  `*.json` and `translations/*`
- **author / license / repository** — from `PACKAGE_AUTHOR`, `PACKAGE_LICENSE`
  and `PACKAGE_REPO_URL` in `.env`. Keep `PACKAGE_REPO_URL` set: npmjs does
  not need a `repository` field to install a version, but it is good package
  metadata and already-published versions cannot be fixed retroactively.
- **license default** — `SEE LICENSE IN LICENSE.md`, not `UNLICENSED`: the MWNF
  legal notice permits non-commercial/educational use, which `UNLICENSED`
  (all rights reserved) would contradict. `PACKAGE_LICENSE` still overrides it.

## npmjs authentication

Publishing goes to `https://registry.npmjs.org` (override with
`--npm-registry` or the `NPM_REGISTRY` env var). This is a manual, local
publish — not run from CI (the shared packages use npm trusted publishing in
CI; data packages do not, see
museumwithnofrontiers/inventory-app#1720) — so it needs your own npmjs login
with 2FA, done **on the host** first:

```bash
npm login
```

That writes a session token to your **host** `~/.npmrc`. The `exporter`
service mounts that file read-only into the container
(`${HOME}/.npmrc:/root/.npmrc:ro` in `compose.yml`, since `--publish` runs
`npm publish` as root inside the container): the container never runs
`npm login` itself and no token is ever written to a tracked file.

Before touching the database, `--publish` runs `npm whoami` against that
mounted session and exits immediately — with an `npm login` hint — if it is
dead. Without this preflight a dead session only surfaced as a registry 404
after the whole export had already run.

```bash
docker compose --profile jobs run --rm exporter dxa-gallery --instance <slug> --force --publish
```

The container has no browser (`NPM_CONFIG_BROWSER=false` in `compose.yml`),
so if npmjs still wants a 2FA one-time code for this publish, or a web-login
confirmation for a brand-new package name, npm prints the
`https://www.npmjs.com/auth/cli/...` URL to this terminal instead of trying
to launch one. Open that URL in your own browser, tick "stay authenticated
for publish for the next 5 minutes", and npm's poll picks up the completed
login and the run continues.

**Windows** — PowerShell does not export `$HOME` to child processes, so
`${HOME}` in `compose.yml` resolves to nothing unless you set it first, in
every new shell:

```powershell
$env:HOME = $env:USERPROFILE
```

If `~/.npmrc` does not exist yet, run `npm login` (or `npm whoami`) once on
the host before the compose command — Docker turns a missing bind-mount
source file into an empty directory, which breaks npm inside the container.

The first `--publish` for a package under the `@museumwnf` scope
additionally needs `--access public` (already passed by `PublishManager`)
since npm defaults a scoped package to private — after that first publish,
later versions inherit it automatically. This does not apply to the sites
already published from a fork (`carpets`, `amulets`): they are already public.

Later: staged publishing (`npm stage publish`, a stage-only token, one 2FA
approval covering all datasets) needs npm >= 11.15; `node:24-alpine` ships
11.13.0, so it stays out of scope here.

## Consumer usage

```bash
npm install @museumwnf/<slug>-data
```

```javascript
import manifest from '@museumwnf/<slug>-data/manifest.json' assert { type: 'json' }
import gallery from '@museumwnf/<slug>-data/gallery.json' assert { type: 'json' }
import items from '@museumwnf/<slug>-data/items.json' assert { type: 'json' }

// Lazy-load translations for a language
const { default: t } = await import(`@museumwnf/<slug>-data/translations/items.${lang}.json`)
```

All data files sit at the package root (there is no `data/` directory);
per-language translation files live under `translations/`.

## Troubleshooting

**`npm publish` fails with "not authorized"** — no session in the host
`~/.npmrc`, the mount picked up nothing (Windows: `$env:HOME` not set before
the compose run), or the 2FA/web-login prompt was not completed; see the
authentication section above.

**`--publish` exits immediately with "npm session is not authenticated"** —
the preflight `npm whoami` check failed before the export even started (the
export never ran). Run `npm login` on the host (Windows: set `$env:HOME`
first, see above) and retry.

**"cannot publish over previously published version"** — that version
already exists on the registry (e.g. the version file was reset, or an
earlier run actually succeeded despite reporting a failure — check npmjs).
The counter file is NOT bumped by a failed publish, so a plain rerun retries
the very same number and fails the same way; pass `--package-version` with
the next free version instead.

**Version file lost** — do *not* just re-run `--publish` assuming it would
restart at 1.0.0; see the version management section above (a site already
published under its slug takes the registry version + 1 instead).
