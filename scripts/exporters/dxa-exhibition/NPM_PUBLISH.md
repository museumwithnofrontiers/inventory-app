# NPM Package Publishing Guide

How `--publish` turns an export into a released version of an exhibition's
`@museumwnf/<site>-data` package on npmjs. What a package *contains* is
documented in [`README.md`](README.md#package-contents); this guide covers the
publishing mechanics only. Every command below needs `--instance <slug>` —
this exporter has no default site.

## Quick start

```bash
docker compose --profile jobs run --rm exporter dxa-exhibition --instance the-use-of-colours-in-art --force --publish
```

That single run does everything:

1. Exports the exhibition named by the instance file to
   `output/<slug>/` (`<slug>` is the instance's own `slug` field)
2. Bumps the patch version persisted in `output/.version-<slug>`
   (1.0.0 → 1.0.1, …) — one counter per instance
3. Generates `package.json` and a consumer `README.md` inside `output/<slug>/`
4. Runs `npm publish` from that directory against npmjs, under the package
   name the instance file declares (`package_name`)

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

The version counter lives in `output/.version-<slug>` — deliberately *outside*
the package directory, so `--force` (which deletes and recreates
`output/<slug>/`) does not reset it, and per instance, so two sites publishing
from this same exporter never share a counter.

- Each `--publish` run computes the next patch component by asking the
  registry first (`PublishManager.getNextVersion`) and comparing against the
  local counter, taking the higher of the two. That means **the first
  `--publish` run from this directory for an already-published site takes the
  registry's current version + 1**, not `1.0.0 → 1.0.1` from a fresh local
  counter — the counter file only exists once this exporter has published that
  slug itself.
- `--package-version <semver>` sets an explicit version instead.
- Either way, the version is persisted to the counter file only once
  `npm publish` has actually succeeded. A failed publish — a collision, a
  network error, a dead session — leaves the file untouched, so it never
  burns a number. That also means a plain rerun after a failure retries the
  very same version and fails the same way; fix the underlying cause, or
  pass `--package-version` explicitly, rather than expecting a rerun to
  auto-increment past it.

⚠ The whole `output/` directory is **gitignored**, version file included. If
it is lost (fresh clone, deleted output directory), the next `--publish` would
fall back to the registry version + 1 anyway (see above), so a lost counter is
not by itself a reason to pass `--package-version` — only a genuine version
collision is.

## Package structure

The published package is the output directory itself:

```
output/<slug>/
├── package.json          ← generated on every --publish run
├── README.md             ← generated consumer usage guide
├── LICENSE.md            ← copy of docs/LICENSE.md.template (the MWNF legal notice)
├── manifest.json
├── exhibition.json, themes.json, items.json, tags.json, partners.json, …   (see README.md)
└── translations/
    └── <entity>.<lang>.json
```

The `files` allow-list in the generated `package.json` restricts the publish to
`*.json`, `translations/*.json` and `README.md` — the `.json.gz` companions
written by the export stay local and are never published.

npm includes `LICENSE.md` in the tarball automatically — it is not, and does
not need to be, in the `files` allow-list.

## Package metadata

The generated `package.json` carries:

- **name** — the instance file's `package_name`
- **version** — from the version file (see above)
- **description** — names the instance's `slug`
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
docker compose --profile jobs run --rm exporter dxa-exhibition --instance water-in-islam --force --publish
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
npm install @museumwnf/<site>-data
```

```javascript
import manifest from '@museumwnf/<site>-data/manifest.json' assert { type: 'json' }
import exhibition from '@museumwnf/<site>-data/exhibition.json' assert { type: 'json' }
import items from '@museumwnf/<site>-data/items.json' assert { type: 'json' }

// Lazy-load translations for a language
const { default: t } = await import(`@museumwnf/<site>-data/translations/items.${lang}.json`)
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

**"cannot publish over previously published version"** — that version already
exists on the registry (e.g. the version file was reset, or an earlier run
actually succeeded despite reporting a failure — check npmjs). The counter
file is NOT bumped by a failed publish, so a plain rerun retries the very
same number and fails the same way; pass `--package-version` with the next
free version instead.

**Version file lost** — this is not the problem it is on a single-site fork:
the next `--publish` asks the registry first and takes its version + 1 (see
Version management above). Pass `--package-version` explicitly only on an
actual collision.

**Wrong `--instance`** — a `gallery`-kind instance file is refused with a
pointer to `../dxa-gallery`; a missing instance file names the path it looked
for (bare names resolve against `../instances/<name>.json`).
