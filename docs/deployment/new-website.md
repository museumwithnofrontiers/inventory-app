---
layout: default
title: New Website Recipe
parent: Deployment Guide
nav_order: 11
---

# New Website Recipe

{: .no_toc }

The one ordered procedure for standing up a new gallery or exhibition
website: from choosing the legacy collection to a live, deployed,
discovered site. Each step below names the command, the directory it runs
from, who runs it, and what proves it worked.

This recipe covers **`gallery`** and **`exhibition`** sites only — the
scope of epic
[#1735](https://github.com/museumwithnofrontiers/inventory-app/issues/1735),
which built the tools this recipe uses:
[#1733](https://github.com/museumwithnofrontiers/inventory-app/issues/1733)
(the lookup command, step 1 below) and
[#1734](https://github.com/museumwithnofrontiers/inventory-app/issues/1734)
(the parameterised `dxa-gallery`/`dxa-exhibition` exporters, steps 2–3
below). A `standalone` site (a whole virtual museum, like `islamicart` or
`baroqueart`) is not created by this recipe — it needs its own forked
exporter (see
[`scripts/exporters/README.md`](https://github.com/museumwithnofrontiers/inventory-app/blob/main/scripts/exporters/README.md#adding-a-new-dataset),
"A standalone site").

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

## Who runs what

| Step | Who | Why |
|---|---|---|
| 1. Look up the collection | any developer | reads the staging/app database, no special access |
| 2. Instance file and site note | any developer | an ordinary pull request |
| 3. First publish | **the operator holding the npm session** | `npm publish` needs an authenticated npmjs login with 2FA |
| 4. Create and configure the repository | **an operator with `gh` admin rights on the org** | repository administration is not a permission `GITHUB_TOKEN` can ever hold |
| 5. Texts | any developer | `scripts/site-i18n` only ever issues `SELECT`s against the legacy database |
| 6. Catalogue, sheet and theme | any developer | the site's own pull request |
| 7. Record the site in inventory-app | any developer | an ordinary pull request |
| 8. Discovery check | any developer | a read-only dry run |

## Standing warning: which database, which environment

Two different tools in this recipe read from two different places, and
neither is the staging database by default:

- `scripts/exporters/*`'s own `.env` points at **production** `DB_*`
  credentials. Steps 2–3 below only avoid that because they are run through
  the `exporter` service in the repo-root `compose.yml`, which forces
  `DB_*` to `staging-mysql` and wins over the exporter's own `.env` — see
  [`scripts/exporters/README.md`](https://github.com/museumwithnofrontiers/inventory-app/blob/main/scripts/exporters/README.md#running-an-export).
  Running an exporter directly on the host instead reads whatever its
  `.env` points at.
- `scripts/site-i18n`'s `.env` points at the **production** legacy
  database, over the VPN, and step 5 below genuinely connects to it — there
  is no staging copy of the legacy database for this tool. This is safe by
  construction: every statement `scripts/site-i18n` issues against the
  legacy database is a `SELECT`, confirmed in
  [`scripts/site-i18n/README.md`](https://github.com/museumwithnofrontiers/inventory-app/blob/main/scripts/site-i18n/README.md).

## 0. Inputs

Before starting, have on hand:

- the legacy gallery or exhibition — its legacy id, slug, or exact English
  title;
- the site slug — kebab-case, also the repository name
  (`museumwithnofrontiers/<slug>`) and the data package
  (`@museumwnf/<slug>-data`);
- the class — `gallery` or `exhibition` (`standalone` sites are not created
  by this recipe, see above);
- the namespace — one lowercase word, no hyphens (`carpets`,
  `waterInIslam`) — the four DXA sites' own choices are examples: `carpets`,
  `amulets`, `colours` (not `theUseOfColoursInArt`), `waterInIslam`;
- the display title, e.g. `"Carpets"`.

## 1. Look up the collection

Resolve the legacy selector to the inventory-app collection UUID, inside
the `app` or `staging-app` container (from the `inventory-app` checkout):

```bash
docker compose exec staging-app php artisan importer:find-collection gallery <legacy id|slug|exact English title> --json
# or: exhibition, in place of gallery
```

If the answer is "there are no commands defined in the importer namespace",
the container runs a built image (`inventory-app:staging`) that predates the
command. Either rebuild that image first or run the command with the
checkout mounted over it, which is what the first end-to-end run did:

```bash
docker compose run --rm --no-deps -T -v "${PWD}:/var/www/app" staging-app php artisan importer:find-collection gallery <legacy id|slug|exact English title> --json
```

The command's signature and output fields are in
[`app/Console/Commands/FindCollection.php`](https://github.com/museumwithnofrontiers/inventory-app/blob/main/app/Console/Commands/FindCollection.php).

**Proof:** exactly one row is returned, its `type` matches the class from
step 0, and its `id` is the `collection_id` step 2 needs.

## 2. Instance file and site note

Two new files, `scripts/exporters/instances/<slug>.json` and
`scripts/exporters/instances/<slug>.md`, in one pull request on
`inventory-app`. The field shapes (`kind`, `slug`, `name`, `collection_id`,
`package_name`) and what the site note holds are in
[`scripts/exporters/instances/README.md`](https://github.com/museumwithnofrontiers/inventory-app/blob/main/scripts/exporters/instances/README.md).
`kind` is `"gallery"` or `"exhibition"` and picks whether `dxa-gallery` or
`dxa-exhibition` reads the file.

**Proof**, from the `inventory-app` repo root, against staging:

```bash
docker compose --profile jobs run --rm exporter dxa-gallery --instance <slug> --force
# or: dxa-exhibition, in place of dxa-gallery
```

writes `scripts/exporters/dxa-gallery/output/<slug>/` (or
`scripts/exporters/dxa-exhibition/output/<slug>/`) without error. See
[`scripts/exporters/README.md`](https://github.com/museumwithnofrontiers/inventory-app/blob/main/scripts/exporters/README.md#adding-a-new-dataset)
for validating the counts before the first publish. **Windows** —
`$env:HOME = $env:USERPROFILE` is needed in every new shell before any
`exporter` command that touches npm (see step 3); it is not needed for this
export-only run.

## 3. First publish

Done by hand, by the operator who holds the authenticated npm session (see
[`scripts/exporters/dxa-gallery/NPM_PUBLISH.md`](https://github.com/museumwithnofrontiers/inventory-app/blob/main/scripts/exporters/dxa-gallery/NPM_PUBLISH.md)
for the full mechanics — npm login, 2FA, version management). The same
command as step 2, with `--publish` added:

```powershell
$env:HOME = $env:USERPROFILE
docker compose --profile jobs run --rm exporter dxa-gallery --instance <slug> --force --publish
# or: dxa-exhibition, in place of dxa-gallery
```

This is the site's data package's **first ever** publish, so it needs
`--access public`, already passed automatically by `PublishManager` for a
new `@museumwnf` package name.

**Proof:**

```bash
npm view @museumwnf/<slug>-data version
```

answers with a version (registry lag is real — wait a few minutes before
concluding the publish did not happen; never re-publish on the strength of
one check).

## 4. Create and configure the repository

From a `viewer-workflows` checkout (or its container — same pattern as
`propagate.mjs`), by an operator authenticated with `gh` and holding admin
rights on the `museumwithnofrontiers` org (this tool never stores a
token):

```bash
export GH_TOKEN=$(gh auth token)
docker run --rm -it \
  -e GH_TOKEN \
  -v "$PWD:/w" \
  -w /w node:lts-alpine sh -c "apk add --no-cache git github-cli >/dev/null && \
    node tools/new-website.mjs --slug <slug> --class gallery|exhibition --namespace <ns> --title '<Site name>'"
```

Add `--dry-run` first to preview without touching anything. The full flag
reference is in `viewer-workflows`'
[`MAINTENANCE.md`](https://github.com/museumwithnofrontiers/viewer-workflows/blob/main/MAINTENANCE.md#creating-a-website)
("Creating a website") and `website-template`'s
[`README.md`](https://github.com/museumwithnofrontiers/website-template/blob/main/README.md#admin--creating-a-new-website)
("Admin — creating a new website"). The tool requires the data package
published on npmjs first (step 3) — it refuses to run otherwise, unless
`--settings-only`.

The tool creates the repository from `website-template`, switches on Pages
(source: GitHub Actions), the `main-requires-pr` ruleset, classic branch
protection with the four required checks, allow-auto-merge,
delete-branch-on-merge, CodeQL default setup and Dependabot security
fixes/alerts, then opens and auto-merges the first PR (placeholder
replacement, `@museumwnf/<slug>-data@latest` installed).

**Proof:**

- the tool's own console summary (`[Repository]`, `[Pull request]` lines);
- the first PR reaches `MERGED` by itself (auto-merge armed, unless
  `--no-merge` was passed);
- ```bash
  gh api repos/museumwithnofrontiers/<slug> --jq .template_repository.full_name
  ```
  prints `museumwithnofrontiers/website-template`;
- ```bash
  gh run list -R museumwithnofrontiers/<slug> --workflow=deploy.yml --branch main --limit 1
  ```
  is `completed success`;
- `https://museumwithnofrontiers.github.io/<slug>/` answers.

## 5. Texts

From `scripts/site-i18n` (inventory-app checkout), any developer, reading
the **production** legacy database over the VPN (see the standing warning
above):

```bash
docker run --rm --network host -v "${PWD}:/app" -v site-i18n-node-modules:/app/node_modules -w /app node:22-alpine npm run extract -- <legacy selector> --layout website --namespace <ns> --force
```

`--layout website` writes exactly this one site's own texts (`en.json` plus
one file per legacy language that has at least one of the site's own
texts) into `output/<slug>/locales/`. Reuse the same legacy selector step 0
identified — the lookup command in step 1 already resolved it — rather
than running a separate `npm run list` search, for consistency (documented
in
[`scripts/site-i18n/README.md`](https://github.com/museumwithnofrontiers/inventory-app/blob/main/scripts/site-i18n/README.md)).
Copy `output/<slug>/locales/` into the site repository's own `locales/`
and open the texts PR there. One file needs a merge rather than a copy:
the scaffold's `locales/en.json` already exists and holds placeholder
entries (`<ns>.identity.*`, `<ns>.home.*`, `<ns>.nav.*`, `<ns>.about.body`)
that the scaffold's own `src/dataset.config.js` and `tests/smoke.test.js`
read. Add the extracted entries to that file and keep the placeholders,
so the texts PR stays green on its own; step 6 removes them together with
the code that reads them. If the legacy database holds this site's texts
in English only, `en.json` is the only file the extraction writes, and
that is not an error.

**Proof:** `ci / Texts (blocking)` on that PR validates the copied keys
against the `viewer-i18n` dictionary; once merged and deployed, the About
page shows the extracted text for a **gallery** (an exhibition has no About
page — blocked on the Theme epic, inventory-app#1729) and the Credits page
shows it for both.

## 6. Declare the catalogue, the sheet and the theme

The site's own work, on the repository step 4 created. Starting from
`website-template`'s
[`README.md`](https://github.com/museumwithnofrontiers/website-template/blob/main/README.md#admin--creating-a-new-website),
step 2 ("Declare the catalogue and the sheet") onward, and the "Webdesigner
— theming the website" section for the palette and tokens. Not repeated
here.

**Proof:** the site's own tests (`npm run test`) and build pass.

## 7. Record the site in inventory-app

Add the new site as a submodule under `.new-architecture/`, in the same
form as the existing entries — check
[`.gitmodules`](https://github.com/museumwithnofrontiers/inventory-app/blob/main/.gitmodules)
first: the `.new-architecture/*` entries carry no `shallow = true` line,
unlike the `.legacy-code/*` and `.legacy-database/*` ones.

```bash
git submodule add https://github.com/museumwithnofrontiers/<slug> .new-architecture/<slug>
```

Open this as its own pull request on `inventory-app`.

**Proof:** the diff shows the new `.gitmodules` stanza and the gitlink; the
"Record the site commits in this repository" step of
[`scripts/import-tool/README.md`](https://github.com/museumwithnofrontiers/inventory-app/blob/main/scripts/import-tool/README.md)
now walks over this site the next time `.new-architecture` pointers are
bumped after a re-import.

## 8. Discovery check

From the `viewer-workflows` checkout used in step 4 (or a fresh one):

```bash
node tools/propagate.mjs --dry-run --expect <slug>-data@<published version> --repo museumwithnofrontiers/<slug>
```

The flags are documented in `propagate.mjs`'s own header and in
[`MAINTENANCE.md`](https://github.com/museumwithnofrontiers/viewer-workflows/blob/main/MAINTENANCE.md)
("Step 3, with the tool"). `--repo` restricts the run to this one site;
drop it to also see the site appear in the full discovered list — a site is
discovered from its `template_repository` link, not from any file listing
sites by name.

Run it in the `node:lts-alpine` container with `GH_TOKEN`, as
`MAINTENANCE.md` describes, from a real clone: a git worktree cannot be
mounted, because its `.git` is a pointer file and `gh auth setup-git`
refuses it. Run on the host, the same command may answer that the version
is "not on the registry" while `npm pack` serves it; that is the host-side
registry lag, not a missing publish, and the container does not see it.

**Proof:** the dry-run's report includes this site.

## Steps you may find in older notes

Two steps that used to be part of this recipe are not steps any more.
Per the epic
[#1735](https://github.com/museumwithnofrontiers/inventory-app/issues/1735)
decomposition comment (2026-09-21):

- **Adding the new site to `dependents.json`.** That file no longer
  exists. Since the move to the `museumwithnofrontiers` org, both
  propagation (step 8 above) and `package-ci.yml`'s downstream build
  discover a website from the `template_repository` link GitHub itself
  records at creation (step 4) — which is also why step 4's proof checks
  that link directly.
- **Adding a Dependabot entry in `inventory-app` for the new site.** A
  website is its own repository, with its own `dependabot.yml` inherited
  from `website-template`. `inventory-app`'s own hand-maintained,
  CI-enforced `dependabot.yml` only lists `inventory-app`'s own Node
  projects; its exporter and viewer entries are already globbed patterns,
  so a new site adds nothing there.

## First end-to-end run

This recipe was first run end to end on **coins-medals**, the first site of
M5 wave 1, on **2026-09-21**
([story #1930](https://github.com/museumwithnofrontiers/inventory-app/issues/1930);
the run's proofs are its comments). Every step ran as written. Three
observations were folded into the steps above rather than kept here: the
built staging image that predates the lookup command (step 1), the
scaffold's placeholder locale entries that the texts PR must keep until
step 6 (step 5), and the two container traps of the discovery check
(step 8). The tool's closing hint about `dependents.json` and a Dependabot
entry, the two retired steps listed above, was corrected in
[viewer-workflows#29](https://github.com/museumwithnofrontiers/viewer-workflows/pull/29).
