---
layout: default
title: Release and Propagation
parent: Deployment Guide
nav_order: 9
---

# Release and Propagation

{: .no_toc }

How a change travels from this repository to a public website, through every
layer of the platform. This page explains the principle of each stage and gives
the exact commands. It does not list every repository: where a command applies
to a whole family of repositories, it says so once.

The authoritative details for each stage live next to the code (see
[Where the details live](#where-the-details-live)). This page is the map.

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

## The chain

Two independent chains meet in the websites: the **data chain** (content) and
the **platform chain** (code). A website is rebuilt whenever either one changes.

```
DATA CHAIN                                   PLATFORM CHAIN

legacy databases                              viewer-workflows (reusable CI/CD)
      │  import-tool: stage                        │  tag vX.Y.Z
      ▼                                            ▼
staging database (local Docker)               viewer-core, viewer-layout, viewer-i18n
      │  import-tool: ship                         │  GitHub Release vX.Y.Z → npm package
      ▼                                            │
inventory-app on the VPS (OVH) ◄── Build + deploy-ovh on push to main
      │  exporter --publish                        │  propagate (one PR per website)
      ▼                                            ▼
@<scope>/<site>-data (npm package) ─────────► website repositories (from website-template)
      │                                            │  merge to main → Deploy
      │  deploy-viewer-<site>-ovh                  ▼
      ▼                                       GitHub Pages
demo viewers on the VPS (OVH)
```

Two hosting targets exist on purpose and both stay:

- **OVH (the VPS)** hosts inventory-app itself, the image serving, and the
  demo viewers embedded in this repository under `scripts/viewers/`.
- **GitHub Pages** hosts the public websites, one repository each, created from
  `website-template`.

## Which command, when

One row per step. "Command" points at the section that has the exact,
runnable form; several steps have prerequisites (an authenticated `npm`
session, a fresh checkout) that are not worth repeating here.

| Step | Trigger | Command | Verify | Details |
|---|---|---|---|---|
| App deploy | Merge to `main`, or a `v*.*.*` tag | None — automatic ([§1](#1-application-inventory-app)) | `gh run list -R museumwithnofrontiers/inventory-app --workflow=deploy-ovh.yml --limit 1` is `completed success` | [Production Deployment](production-deployment) |
| Content re-import + ship | New legacy content is ready to land | `stage`, then `ship` ([§2](#2-content-import-tool)) | Staged DB reviewed locally before `ship`; `ship`'s own console output | `scripts/import-tool/README.md` |
| Data package republish | Shipped content should reach a website | `exporter all --force --publish` ([§3](#3-data-packages-exporters)) | `npm view @museumwnf/<site>-data version` and `time.modified`, for each of the seven | `scripts/exporters/<site>/NPM_PUBLISH.md` |
| Shared package release | A viewer-core / viewer-layout / viewer-i18n PR merges | `gh release create` ([§5.1](#51-release)) | `gh run list --workflow=release.yml` is `completed success`, then `npm view @museumwnf/<package> version` | `MAINTENANCE.md` in museumwithnofrontiers/viewer-workflows |
| Propagate | A data or shared package release should reach sites | `tools/propagate.mjs --expect ...` ([§5.2](#52-propagate)) | Each site's propagation PR reaches MERGED, then its `deploy.yml` run is `completed success` | `MAINTENANCE.md` in museumwithnofrontiers/viewer-workflows |
| Scaffold | A new website is created | Copy `website-template` by hand, then its "Admin" steps | Pages enabled once by hand on the new repository | `README.md` in museumwithnofrontiers/website-template |
| Websites | A propagation PR merges, or a local change to the site merges | None — automatic ([§7](#7-websites)) | `gh run list -R museumwithnofrontiers/<site> --workflow=deploy.yml --limit 1` is `completed success` | [§7](#7-websites) above |

## Families of repositories

| Family | Repositories | What a "release" is | Who triggers it |
|---|---|---|---|
| Application | inventory-app | push to `main` (or a `v*.*.*` tag) | merge of a PR |
| Content | the staged database | `ship` to the VPS | operator, by hand |
| Data packages | `scripts/exporters/<site>` (one per website) | `--publish` from the operator's machine | operator, by hand |
| Reusable workflows | viewer-workflows | git tag `vX.Y.Z` | operator, by hand |
| Shared packages | viewer-core, viewer-layout, viewer-i18n | GitHub Release `vX.Y.Z` | operator, by hand |
| Scaffold | website-template | none, it is copied when a site is created | n/a |
| Websites | one repository per site | merge to `main` | merge of a PR (propagation or local change) |

## 1. Application (inventory-app)

Every merge to `main` deploys the application to the VPS. The docs site
follows its own path.

- `Build` runs on push to `main` and on tags `v*.*.*`, then `deploy-ovh` runs
  when `Build` completes and copies the artefact to the VPS over SSH. Both can
  be started by hand from the Actions tab (`workflow_dispatch`).
- `continuous-deployment_github-pages` publishes `docs/` on every push to `main`.

There is no command to run. The server side (directories, symlinks, rollback)
is described in [Production Deployment](production-deployment).

## 2. Content (import-tool)

Nothing goes from the legacy databases straight to production. The import is
two structurally separate steps, run from `scripts/import-tool/`:

1. `stage` builds a local copy of the data from legacy into the `staging-mysql`
   Docker volume. It has no SSH key and cannot reach the server.
2. `ship` sends that local copy to the VPS as one bulk handoff. It has no legacy
   credentials and cannot read the legacy source.

`ship` rebuilds the deployed database from the staged copy every time. It
requires `CONFIRM_WIPE=yes-really-wipe-production` on the command line, never
in `.env`.

```bash
docker compose --env-file scripts/import-tool/.env --profile import run --build --rm stage
docker compose run --rm staging-glossary-sync
```

```bash
CONFIRM_WIPE=yes-really-wipe-production docker compose --env-file scripts/import-tool/.env --profile import run --build --rm ship
```

`ship` updates the application only. The websites see the new content when
their data packages are published and propagated (stages 3 and 5 below).
The full walkthrough, including the four steps a short version leaves out, is
in `scripts/import-tool/README.md`.

## 3. Data packages (exporters)

One exporter per website, under `scripts/exporters/<site>/`. Publishing is a
manual step on the operator's machine. No workflow publishes data packages.

Docker bind-mounts this checkout, so the export runs whatever is currently
checked out here — not necessarily the merge you intend to publish. Before a
republish:

```powershell
git pull --ff-only origin main
git log -1 --format=%h
```

Confirm the hash is the commit you mean to publish. A tree one commit behind
can republish a field that was just removed.

Authenticate on the host immediately before the batch below, not once at the
start of the day:

```powershell
npm login
npm whoami
```

`npm whoami` must print your login. A session from the previous morning is
commonly already dead by the next morning. `all --publish` runs this same
check itself, once, before any export starts (#1865, batched by #1922) — so a
dead session fails in seconds, with an `npm login` hint, and nothing exports
rather than working through all seven exports first and only then failing the
publish step with
`E404 Not Found - PUT https://registry.npmjs.org/@museumwnf%2f<x>-data`
("could not be found or you do not have permission" — not a 401; do not read
that error as a permissions problem if you ever do see it past the
preflight).

One command re-exports and republishes all seven
([#1922](https://github.com/museumwithnofrontiers/inventory-app/issues/1922)):
it iterates every `scripts/exporters/instances/*.json` — the three
still-forked exporters via a `kind: "standalone"` file, plus the two
parameterised DXA exporters once per instance slug they carry — running each
one's exporter in turn. See the plan first, then run for real — PowerShell:

```powershell
$env:HOME = $env:USERPROFILE
docker compose --profile jobs run --rm --no-deps exporter all --dry-run
docker compose --profile jobs run --rm --no-deps exporter all --force --publish
```

One instance failing does not stop the others — the batch runs every planned
instance, then prints a summary table (instance, exporter, result, published
version) and a non-zero exit if any instance failed. On success it prints a
ready-to-paste block for every package it actually published:

```
node tools/propagate.mjs --expect <pkg>@<version> --expect <pkg>@<version> …
```

paste that straight into [§5.2](#52-propagate) once you are ready to
propagate. See [`scripts/exporters/README.md`](../../scripts/exporters/README.md#batch-re-export-every-instance-in-one-run)
for `--only <slug>[,<slug>…]` (redo a subset) and the failure-naming behaviour
for a malformed instance file.

To redo a single site instead of the whole batch, the per-instance command is
still there — one example per exporter shape:

```powershell
docker compose --profile jobs run --rm --no-deps exporter islamicart --force --publish
docker compose --profile jobs run --rm --no-deps exporter dxa-gallery --instance carpets --force --publish
docker compose --profile jobs run --rm --no-deps exporter dxa-exhibition --instance water-in-islam --force --publish
```

Either way, that single run per site/instance exports, bumps the patch
version, generates `package.json`, `README.md` and `LICENSE.md`, and runs
`npm publish`. Do not run `npm publish` yourself afterwards.

npmjs requires a web authentication per publish, and the container cannot open
a browser: the `exporter` service sets `NPM_CONFIG_BROWSER=false` (#1865), so
`npm publish` prints `Authenticate your account at:
https://www.npmjs.com/auth/cli/<id>` and polls the registry for the login to
complete, instead of trying to launch a browser and exiting with `npm error
Set the BROWSER environment variable`. Open that URL yourself, sign in, tick
"stay authenticated for publish for the next 5 minutes"; npm's poll then
unblocks and the run continues on its own — there is no ENTER prompt to
answer. All seven publishes complete comfortably inside that window (the
whole loop took under two minutes on 2026-09-20 and 2026-09-21).

The version counter lives in `output/.version-<site>` (in the parameterised
`dxa-gallery`/`dxa-exhibition` directories, `<site>` is the instance slug, one
counter per instance), outside the package directory and gitignored. As of
#1865 it is written only once `npm publish`
has actually succeeded, so a failed publish never burns a patch number — a
plain rerun after a failure retries the very same version rather than
skipping past it; fix the underlying cause, or pass `--package-version`
explicitly, instead of expecting a rerun to auto-increment. Gaps in the
version sequence can still occur legitimately (the registry is asked first
and wins whenever it is ahead of the local counter), just not from a failed
publish any more. If the counter file is lost entirely, the next publish
would restart at 1.0.0 and collide; recover with
`--package-version <next-free-version>` after checking the registry.

The `exporter` service reads `staging-mysql`, and `stage` only migrates that
database on a full rebuild. After pulling a change that adds a migration, run
`docker compose --profile jobs run --rm staging-migrate` (non-destructive)
before exporting, or re-run `stage` fully — otherwise the export can fail
with an `Unknown column` error, and columns the importer fills (e.g. a URL
map) stay NULL until the next full `stage`.

Each exporter's `NPM_PUBLISH.md` documents the mechanics, including the
`PACKAGE_REPO_URL` setting that must be present in the exporter's `.env` so the
generated package carries a `repository` field, and the host `~/.npmrc` mount
the `exporter` service needs for `--publish` to authenticate against npmjs.

Verify, for each of the seven: `npm view @museumwnf/<site>-data version` and
`time.modified`; the export output under
`scripts/exporters/<site>/output/<site>/` is what was published.

## 4. Reusable workflows (viewer-workflows)

Every other repository's CI and deployment is a thin caller of a reusable
workflow in `viewer-workflows`, pinned to an exact tag. A release is a tag, and
nothing else: no version file, no moving `v1` tag, no rebuild.

Push the tag from a checkout whose `origin` is
`museumwithnofrontiers/viewer-workflows` — the long-lived local checkout at
`E:/inventory/viewer-workflows` still points at the pre-move `metanull` remote
and would tag the wrong repository silently (`git push` succeeds either way).
The fresh clone kept for propagation (`E:\inventory\wsr\viewer-workflows-prop`,
see [5.2](#52-propagate)) is already correct:

```bash
git -C E:/inventory/wsr/viewer-workflows-prop checkout main
git -C E:/inventory/wsr/viewer-workflows-prop pull --ff-only origin main
git -C E:/inventory/wsr/viewer-workflows-prop tag vX.Y.Z
git -C E:/inventory/wsr/viewer-workflows-prop push origin vX.Y.Z
```

Optionally, to keep the Releases page complete:

```bash
gh release create vX.Y.Z -R museumwithnofrontiers/viewer-workflows --target main --title vX.Y.Z --generate-notes
```

Consumers adopt the new tag through Dependabot's `github-actions` ecosystem:
one PR per consumer, auto-merged when minor or patch and green. To trigger it
immediately on a repository: **Insights → Dependency graph → Dependabot → Check
for updates**. There is no `gh` command for that.

Tags are immutable. Never force-move a tag.

## 5. Shared packages (viewer-core, viewer-layout, viewer-i18n)

The same procedure for all three. The website repositories declare `^X.Y.Z`
ranges on them, so a release does not reach any site until it is propagated.

### 5.1 Release

1. Open a PR on the package repository. Its CI packs the tarball and builds
   every website against it. The version bump in `package.json` and the
   `CHANGELOG.md` entry go in that PR (no "Unreleased" section exists; every
   entry is a version).
2. Merge it.
3. Publish a GitHub Release whose tag is the new version, with notes taken
   from the `CHANGELOG.md` section the PR just added — not `--generate-notes`,
   which drafts from commits instead of the entry the PR already wrote. The
   release event, not the merge, triggers `package-release.yml`, which
   publishes the package with the version taken from the tag.

```bash
gh release create vX.Y.Z -R museumwithnofrontiers/<package> --target main --title vX.Y.Z --notes-file <changelog section file>
```

4. Confirm the publish run succeeded before propagating:

```bash
gh run list -R museumwithnofrontiers/<package> --workflow=release.yml -L 1
```

should read `completed success`. Then confirm on the registry:

```bash
npm view @museumwnf/<package> version
```

Registry lag is real: on 2026-09-21 the publish workflow finished at
06:57:42Z and a propagation started two seconds later still saw the previous
version. Poll every minute for up to ten minutes before concluding a publish
did not happen — never re-publish on the strength of one check.

When several PRs on the same package each bump the version, merge them in
order and let the last one carry the version that gets released.

### 5.2 Propagate

Propagation is the one human decision in the flow: **when** the websites move
to the new version. It is not automatic.

`tools/propagate.mjs` in `viewer-workflows` opens one PR per website, bumping
the range and the lockfile. It discovers sites from the *owner of its own git
remote*, so the checkout it runs from matters: `E:/inventory/viewer-workflows`
is a stale checkout whose `origin` still points at `metanull/...` and finds no
sites. Keep a fresh clone for this instead, and pull it before each run:

```powershell
git clone https://github.com/museumwithnofrontiers/viewer-workflows E:\inventory\wsr\viewer-workflows-prop
git -C E:\inventory\wsr\viewer-workflows-prop pull --ff-only
```

Run it in Docker, with your own `gh` login. The command as run (PowerShell;
`--expect` is mandatory and repeatable — name every version this run must
find on the registry):

```powershell
$n = git config --get user.name; $e = git config --get user.email
docker run --rm -e GH_TOKEN=$(gh auth token) -e GIT_AUTHOR_NAME="$n" -e GIT_AUTHOR_EMAIL="$e" -e GIT_COMMITTER_NAME="$n" -e GIT_COMMITTER_EMAIL="$e" -v E:\inventory\wsr\viewer-workflows-prop:/w -w /w node:lts-alpine sh -c "apk add --no-cache git github-cli >/dev/null && node tools/propagate.mjs --expect viewer-layout@2.15.1"
```

The `GIT_*` variables are optional — the tool derives an identity from the
`gh` login otherwise; pass them when the propagation commits should carry the
same identity as your other commits. `GH_TOKEN` must be passed explicitly:
`gh auth login` on the host commonly stores the token in the OS keyring (e.g.
Windows Credential Manager), which a container cannot reach, so mounting
`~/.config/gh` alone carries no usable token in that case. `gh auth token`
reads the real token regardless of where `gh` stores it. The tool itself runs
`gh auth setup-git` on every invocation, so once `gh` is authenticated this
way, `git push` inherits the same credentials.

Other flags: `--repo <site>` (restrict to one site), `--dry-run` (preview,
recommended first), `--no-merge` (open the PRs without arming auto-merge).
Run before the publish workflow has finished and `latest` still resolves to
the previous version, the tool bumps nothing while exiting successfully —
`--expect` turns that silent no-op into a refusal.

Each website PR runs that site's own CI. Green PRs can be merged (or
auto-merged) because the package's own CI already built that exact tarball
against every site. Merging a website PR triggers its deployment (stage 7).

Outcomes per site: **opened** (PR with auto-merge armed, merges on green),
**already current** (lockfile unchanged), **pending** (an earlier propagation
PR is still open on `chore/propagate-platform-packages` — merge or close it,
then rerun with `--repo`), **failed**. The exit code is non-zero only when a
site failed.

The websites are discovered, not listed: every repository created from
`website-template` is a consumer. A site created by fork or transferred in is
invisible to discovery; pass `--repo` for those.

Verify: each PR reaches MERGED —

```bash
gh pr list -R museumwithnofrontiers/<site> --head chore/propagate-platform-packages --state all -L 1
```

— then its deployment succeeded —

```bash
gh run list -R museumwithnofrontiers/<site> --workflow=deploy.yml --branch main -L 1
```

— `completed success`. For a breaking platform release, also confirm each
site's `package-lock.json` on `main` resolves the package to the new version:

```bash
gh api repos/museumwithnofrontiers/<site>/contents/package-lock.json -H "Accept: application/vnd.github.raw"
```

and read `packages["node_modules/@museumwnf/<package>"].version` from the
result.

### 5.3 Transition to npmjs (complete)

The shared packages and the data packages both moved from GitHub Packages to
npmjs under the `@museumwnf` scope. The consumer-facing part of that move
(epics #1720 and #1722) closed 2026-09-15: the release workflow publishes to
npmjs, every consumer — the websites, `website-template`, and inventory-app's
OVH deploy workflows — installs from npmjs, and all 7 data packages publish
only to npmjs (see stage 3 above). What that looked like, and what it left
behind:

- For each shared package, the first version under the new name had to be
  published by hand from a session with 2FA, because OIDC cannot create a
  package. After that, a trusted publisher was configured on npmjs.com for
  the package, naming the caller workflow `release.yml` — from then on, step
  5.1 publishes to npmjs without any stored token.
- Data packages are still published by hand from the operator's machine, with
  the operator's own npm login — there never was a CI path for them, by
  design (see `NPM_PUBLISH.md` in each exporter).
- What the cutover did **not** yet remove: `viewer-workflows`' reusable
  workflow still carries the old GitHub Packages publish path and the CI
  wiring that fed it (`NODE_AUTH_TOKEN`, `registry-url:
  https://npm.pkg.github.com`), and a few packages still have a stale
  `publishConfig.registry` pointing at it. Stripping that leftover wiring —
  and fixing any doc that still describes GitHub Packages as the current
  publish target — is tracked separately in epic #1723 ("Retire GitHub
  Packages publishing"), open as of this writing.

## 6. Scaffold (website-template)

`website-template` is never released. A new website is created from it as a
GitHub template repository; the admin steps are in the template's README. A
change to the template reaches existing websites only if it is ported by hand.
Do not treat the template as a dependency to propagate.

## 7. Websites

A website has no version and no tag. Its `main` branch is what is deployed.

- A PR runs `website-ci.yml` (install, build, test against the pinned packages)
  and `locale-validate.yml` (the translation tables).
- A merge to `main` runs `website-deploy-pages.yml`, which builds the site and
  publishes it to GitHub Pages.

Both arrive on a site either from propagation (stage 5.2, a package bump) or
from a local change to the site itself. Nothing to run by hand. To check a
deployment:

```bash
gh run list -R museumwithnofrontiers/<site> --workflow=deploy.yml --limit 1
```

GitHub Pages must have been enabled once by hand on a new repository; a green
Deploy run on a repository where Pages is not enabled publishes nothing.

## 8. Demo viewers on the VPS

The viewers embedded under `scripts/viewers/<site>/` are demos hosted on OVH,
not the public websites. Each has a workflow `deploy-viewer-<site>-ovh.yml`
that installs `<site>-data@latest`, builds, and copies the result to the VPS
over SSH. It runs on a push to `main` that touches `scripts/viewers/<site>/**`.

A newly published data package does **not** redeploy a demo viewer by itself.
Start the workflow by hand when the content should be refreshed:

```bash
gh workflow run deploy-viewer-<site>-ovh.yml -R museumwithnofrontiers/inventory-app
```

## After a full re-import: the whole sequence

This is the order, end to end, when the content changes. Each step is a
pointer to the section above.

1. `stage`, then `staging-glossary-sync`, then review locally (stage 2).
2. `ship` to the VPS (stage 2).
3. Publish the seven data packages, one `exporter all --force --publish` run
   (stage 3).
4. Propagate each data package with `--expect <site>-data@X.Y.Z` (stage 5.2),
   which opens and merges one PR per website; the merges deploy the websites.
5. Start the demo viewer workflows by hand if the demos should show the new
   content (stage 8).
6. Record the resulting site commits in this repository's `.new-architecture`
   pointers (see `scripts/import-tool/README.md`, step 9).

When the platform changes instead (a shared package), the sequence is stage
5.1 then 5.2 for that package only.

## Standing rules

- **No credential in a tracked file.** CI authenticates through
  `actions/setup-node` with the ephemeral `github.token` (or OIDC on npmjs);
  developers use their own `~/.npmrc`; containers mount it read-only.
- **Published packages are `1.x` or higher and sites declare `^` ranges**,
  never `*`.
- **Dependabot does not manage the package scope.** It is ignored in every
  site; propagation is the only way a package version moves. Dependabot still
  handles third-party npm packages and `github-actions`.
- **Tags are immutable** in every repository.
- **Propagate with `--expect`**, always.
- **A green check must have run something.** When a downstream matrix is
  derived (websites discovered from the template), an empty matrix is a
  discovery failure, not "nothing to do". Read the check names, not only the
  colours.
- **A breaking change in a shared package goes out in a fixed order.** First
  widen the dependent package's peer range — an additive, patch release — and
  propagate it so every site's lockfile already carries it. Only then release
  the breaking version. `package-ci.yml`'s Downstream job runs `npm ci` and
  then `npm install --no-save <tarball>` on every site's `main`, so the peer
  resolution it checks is against the sites' *lockfiles*, not their declared
  ranges — a site whose lockfile has not moved yet fails the downstream build
  against the breaking tarball even though its `package.json` range would
  technically admit it.

## Where the details live

| Stage | Authoritative document |
|---|---|
| Application on the VPS | [Production Deployment](production-deployment) in this site |
| Content import | `scripts/import-tool/README.md` (walkthrough and copy-paste TL;DR) |
| Data package publishing | `scripts/exporters/<site>/NPM_PUBLISH.md` |
| Reusable workflows | `README.md` and `MAINTENANCE.md` in museumwithnofrontiers/viewer-workflows |
| Shared package release and propagation | `MAINTENANCE.md` in museumwithnofrontiers/viewer-workflows ("The flow"); `tools/propagate.mjs` in the same repository |
| Creating a website | `README.md` in museumwithnofrontiers/website-template ("Admin") |
| npmjs transition | epics #1720, #1721, #1722, #1723 in this repository |
