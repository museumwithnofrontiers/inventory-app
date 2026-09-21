# NPM Package Publishing Guide

How `--publish` turns an export into a released version of
`@museumwnf/baroqueart-data` on npmjs. What the package *contains*
is documented in [`README.md`](README.md#what-it-exports); this guide covers
the publishing mechanics only.

## Quick start

```bash
npm run export -- --force --publish
```

That single run does everything:

1. Exports the dataset to `output/baroqueart/`
2. Bumps the patch version persisted in `output/.version-baroqueart`
   (1.0.3 → 1.0.4, …)
3. Generates `package.json` and a consumer `README.md` inside
   `output/baroqueart/`
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
leaves that column **NULL**: columns populated by the importer (e.g. the
project URL map from #1753) only get real values on the next full `stage`,
so a package exported right after a bare migration carries nulls for those
fields until then.

## Version management

The version counter lives in `output/.version-baroqueart` — deliberately
*outside* the package directory, so `--force` (which deletes and recreates
`output/baroqueart/`) does not reset it.

- Each `--publish` run computes the next patch component from the registry
  and the local counter — the choice between them is unchanged.
- `--package-version <semver>` sets an explicit version instead.
- Either way, the version is persisted to the counter file only once
  `npm publish` has actually succeeded. A failed publish — a collision, a
  network error, a dead session — leaves the file untouched, so it never
  burns a number. That also means a plain rerun after a failure retries the
  very same version and fails the same way; fix the underlying cause, or
  pass `--package-version` explicitly, rather than expecting a rerun to
  auto-increment past it.

⚠ The whole `output/` directory is **gitignored**, version file included. If
it is lost (fresh clone, deleted output directory), the next `--publish`
would restart at 1.0.0 and collide with already-published versions — recover
by passing `--package-version` with the next free version (check the
published versions on npmjs first).

## Package structure

The published package is the output directory itself:

```
output/baroqueart/
├── package.json          ← generated on every --publish run
├── README.md             ← generated consumer usage guide
├── LICENSE.md            ← copy of docs/LICENSE.md.template (the MWNF legal notice)
├── manifest.json
├── items.json, collections.json, partners.json, …   (see README.md)
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

- **name** — `@museumwnf/baroqueart-data` (hardcoded in the exporter CLI)
- **version** — from the version file (see above)
- **description** — names the exported project key
- **exports** — `manifest.json` as the entry point, plus every top-level
  `*.json` and `translations/*`
- **author / license / repository** — from `PACKAGE_AUTHOR`,
  `PACKAGE_LICENSE` and `PACKAGE_REPO_URL` in `.env`. Keep `PACKAGE_REPO_URL` set: npmjs does not need a `repository` field to install a version, but it is good package metadata and already-published versions cannot be fixed retroactively.
- **license default** — `SEE LICENSE IN LICENSE.md`, not `UNLICENSED`: the MWNF
  legal notice permits non-commercial/educational use, which `UNLICENSED`
  (all rights reserved) would contradict. `PACKAGE_LICENSE` still overrides it.

## npmjs authentication

Publishing goes to `https://registry.npmjs.org` (override with
`--npm-registry` or the `NPM_REGISTRY` env var). This is a manual, local
publish — not run from CI (the shared packages use npm trusted publishing
in CI; data packages do not, see museumwithnofrontiers/inventory-app#1720) — so it needs
your own npmjs login with 2FA, done **on the host** first:

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
docker compose --profile jobs run --rm exporter baroqueart --force --publish
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
later versions inherit it automatically.

Later: staged publishing (`npm stage publish`, a stage-only token, one 2FA
approval covering all seven datasets) needs npm >= 11.15; `node:24-alpine`
ships 11.13.0, so it stays out of scope here.

## Consumer usage

```bash
npm install @museumwnf/baroqueart-data
```

```javascript
import manifest from '@museumwnf/baroqueart-data/manifest.json' assert { type: 'json' }
import items from '@museumwnf/baroqueart-data/items.json' assert { type: 'json' }

// Lazy-load translations for a language
const { default: t } = await import(`@museumwnf/baroqueart-data/translations/items.${lang}.json`)
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

**Version file lost** — do *not* just re-run `--publish` (it would restart
at 1.0.0); see the version management section above.
