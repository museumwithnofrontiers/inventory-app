# Dataset Exporters

One exporter per public website ("dataset"). Each exporter reads the
inventory-app MySQL database (read-only) and produces a static, denormalized
JSON **data-package**, published as a public npm package on npmjs
(`registry.npmjs.org`), under the `@museumwnf` scope, from
[data-packages](https://github.com/museumwithnofrontiers/data-packages). The matching viewer
(see [`../viewers/`](../viewers/README.md)) consumes that package at build
time — the public websites never talk to the database or the Laravel API.

> These packages used to be private packages on GitHub Packages, under the
> `@metanull` scope. They moved to npmjs as part of milestone M1 (epics
> #1720–#1722, completed 2026-09-15) so that a public website can install
> them with no credential at all.

```
legacy DBs ──(importer, run once)──▶ inventory-app DB ──(exporter, per dataset)──▶ @museumwnf/<dataset>-data ──▶ viewer
```

## Datasets

| Directory | Legacy scope | Package | Consumed by |
|---|---|---|---|
| [`islamicart/`](islamicart/README.md) | project `ISL` + `EPM` (one dataset) | `@museumwnf/islamicart-data` | `scripts/viewers/islamicart` |
| [`baroqueart/`](baroqueart/README.md) | project `BAR` | `@museumwnf/baroqueart-data` | `scripts/viewers/baroqueart` |
| [`sharinghistory/`](sharinghistory/README.md) | project `awe` (SH keyspace, lowercase) | `@museumwnf/sharinghistory-data` | `scripts/viewers/sharinghistory` |
| [`dxa-gallery/`](dxa-gallery/README.md) | any THG gallery, scoped per run by `--instance`: [`carpets`](instances/carpets.md) (gallery 9, membership union, DCA-native + borrowed), [`amulets`](instances/amulets.md) (gallery 4, membership union) | `@museumwnf/<slug>-data`, per instance | `scripts/viewers/carpets`, `scripts/viewers/amulets` |
| [`galleries/`](galleries/README.md) | the galleries hub: every gallery under the galleries root, and the museums of project `GALLERIES` ([`galleries`](instances/galleries.md)) | `@museumwnf/galleries-data` | the galleries hub website |
| [`explore/`](explore/README.md) | Explore: the collection tree under the Explore root and the records it holds, whatever their project ([`explore`](instances/explore.md)) | `@museumwnf/explore-data` | the Explore website |
| [`dxa-exhibition/`](dxa-exhibition/README.md) | any THG exhibition, scoped per run by `--instance`: [`the-use-of-colours-in-art`](instances/the-use-of-colours-in-art.md) (exhibition 47), [`water-in-islam`](instances/water-in-islam.md) (exhibition 56) — both membership union + curated theme tree | `@museumwnf/<slug>-data`, per instance | `scripts/viewers/the-use-of-colours-in-art` *(water viewer not built yet)* |

Each directory is a **self-contained Node/TypeScript project** (own
`package.json`, `tsconfig.json`, `vitest.config.ts`, `.env`). See the README
inside each one for dataset specifics.

### Project-scoped vs gallery-scoped

The first three exporters scope by **project**: every item with
`project_id IN (…)`. The DXA family ([epic #1539](https://github.com/museumwithnofrontiers/inventory-app/issues/1539))
scopes by **collection** instead — a thematic gallery's item universe is the
membership union legacy expressed as an OR predicate (native project OR one of
six `thg_gallery_*` link tables), materialized by the importer in
`collection_item`. Amulets owns none of its 45 objects; they are borrowed from
EPM, ISL, Sharing History and DCA. Carpets is the hybrid case that exercises the
design properly: 398 of its 486 members are native DCA records and the rest come
from six other projects. Anything a project-scoped fork treats as a per-export
constant — the source project on the sheet, the context that picks a record's
canonical translation — is per-item there. The package shapes are
specified in [`docs/dxa-gallery-data-package.md`](docs/dxa-gallery-data-package.md)
and [`docs/dxa-exhibition-data-package.md`](docs/dxa-exhibition-data-package.md).

**Exhibitions** are galleries plus a curated layer: `exhibition.json` replaces
`gallery.json`, and `themes.json` (an ordered tree of themes and sub-themes,
each holding hand-picked pictures with their own per-exhibition texts) and
`related_content.json` are added. `the-use-of-colours-in-art` is the reference
implementation and the extreme of the borrowed case — 24 of its 171 members are
its own, the rest come from seven other projects. `water-in-islam` is its fork
and the opposite balance — 314 native records among 495 — and the site that
exercises what a single exhibition could not: hidden museums, an exhibition with
no chronology of its own, and one published language.

## Parameterised DXA exporters and instance files

`carpets`/`amulets` and `the-use-of-colours-in-art`/`water-in-islam` were each
forked pairs that differed only in the hardcoded scope constant, the package
name and a handful of comments — exactly the kind of copy-paste duplication
that does not survive going from a handful of sites to dozens (epic #1734).
`dxa-gallery` replaces the gallery pair with **one** exporter that takes
`--instance <name|path>` instead of a per-fork constant; `dxa-exhibition`
does the same for the exhibition pair.

An "instance" is a small JSON file under
[`instances/`](instances/README.md) (`<slug>.json`) holding the collection
UUID, the site slug, a display name and the package name — see that README
for the field shapes, how `kind` picks the right exporter, and how to obtain
a `collection_id`. No legacy id appears anywhere in either parameterised
exporter's own source; the four forked directories that used to serve these
sites (`carpets`, `amulets`, `the-use-of-colours-in-art`, `water-in-islam`)
are gone, their parameterised replacements verified equivalent
([#1913](https://github.com/museumwithnofrontiers/inventory-app/issues/1913)). Each instance's
site-specific knowledge — legacy scope, membership reasoning, gaps, decisions
— now lives next to its instance file as `instances/<slug>.md`.

### Batch: re-export every instance in one run

`docker-entrypoint.sh all` ([#1922](https://github.com/museumwithnofrontiers/inventory-app/issues/1922))
iterates every `instances/*.json` file — the parameterised DXA instances
and, via `kind: "standalone"`, the standalone exporters below — and
runs each one's exporter in turn, instead of one `docker compose run` per
site. See the plan first:

```bash
docker compose --profile jobs run --rm --no-deps exporter all --dry-run
```

Then run it for real (add `--publish` to stage every package into the
data-packages checkout; see *Build + publish a data-package update* below):

```bash
docker compose --profile jobs run --rm --no-deps exporter all --force
docker compose --profile jobs run --rm --no-deps exporter all --force --publish --base-url https://inventory.metanull.eu
```

One instance failing does not stop the others: the batch runs every planned
instance, prints a summary table (instance, exporter, result, staged
version), exits non-zero if any instance failed, and — after a `--publish`
run — prints a ready-to-paste `node tools/propagate.mjs --expect
<pkg>@<version> …` line for every package that got a new version, to run
once the data-packages pull request is merged and released. `--only
<slug>[,<slug>…]` restricts the batch to specific instances (e.g. to redo one
after a targeted re-import); an unknown slug is refused rather than silently
shrinking the batch. An instance file with an unknown `kind`, or a
`standalone` file missing its `exporter` field, fails the whole batch before
anything runs, naming the file — see [`instances/README.md`](instances/README.md).

## Why forked per dataset (deliberate decision)

Exporters are **forked, not shared** (decision from the Baroque Art epic,
2026-08-21). Each website's legacy feature set differs — e.g. dynasties,
artintro and the glossary browse exist only for Islamic Art — and a shared
profile-driven exporter would accumulate per-dataset conditionals. Forks are
pruned instead: the baroqueart fork simply has no dynasty exporter. The cost
is that cross-cutting fixes must be ported to every fork (e.g. the
unpublished-exhibition filter, added to both in #1477/#1478); when you fix a
`src/exporters/*` file in one fork, check whether the siblings need the same
change.

**2026-09-21 amendment.** The DXA family (`dxa-gallery`, `dxa-exhibition`) is
the exception: its four forks differed only by a hardcoded scope constant, a
package name and a handful of comments — never by feature — so epic #1734
collapsed them into two parameterised exporters plus a per-site instance file
each (see *Parameterised DXA exporters and instance files* above). The
standalone trio (`islamicart`, `baroqueart`, `sharinghistory`) stays forked:
their differences are real per-site features, not copy-paste duplication, and
the decision above still applies to them.

**2026-09-28.** [`galleries`](galleries/README.md), the galleries hub's
exporter (epic #1744), is a fourth standalone exporter. It is not a fork of
the trio: it ships a shape of its own (a galleries list and a partner
directory, no items), built from `dxa-gallery`'s core.

**2026-09-28.** [`explore`](explore/README.md), Explore's exporter (epic
#1745), is a fork of `sharinghistory`. Explore is no project, so its scope is
a collection tree and the records it holds, not a project key.

## Package layout

```
output/<dataset>/
├── manifest.json            # projectIds/projectKeys (parallel arrays), languages, export metadata,
│                            #   and projects: name/site_url/related_database_url/
│                            #   artistic_introduction_url per referenced project UUID (epic #1727 phase 2)
├── items.json               # objects, monuments, monument details
├── collections.json         # projects, exhibitions, themes, pages, galleries…
├── partners.json / countries.json / languages.json
├── timelines.json / timeline_events.json
├── glossary.json
├── translations/
│   └── <entity>.<lang>.json # one file per entity per language; a file is
│                            #   absent when that entity has no translations
│                            #   in that language — viewers must tolerate this
└── *.json.gz                # precompressed copies, never staged or published
```

Entity files hold language-independent data (ids, relations, image URLs,
display order); all human-readable text lives in `translations/`. Image URLs
are absolute, built from `BASE_URL` (the inventory app's public storage).

That layout is the project-scoped one. A gallery package keeps the same
skeleton but swaps `collections.json` for a `gallery.json` site anchor and adds
`tags.json`, the facet vocabulary with its categories intact — see
[`docs/dxa-gallery-data-package.md`](docs/dxa-gallery-data-package.md).

Section anchors (exhibitions root, artistic-introduction root, Historical
Background/Profiles roots, National Context overlays, …) are identified by
the `purpose` field on collections (#1505) — a controlled vocabulary set by
the importer (`exhibitions-root`, `artistic-introduction-root`,
`historical-profiles-root`, `national-context`, …), unique per context for
`*-root` values. Viewers resolve sections **only** via `purpose`; the
`backward_compatibility` keys still shipped alongside are informational.
Exhibitions whose legacy `show` flag is `'n'` (preserved in
`collection_translations.extra.legacy_exhibition.show`) are excluded from the
package, as the legacy sites never listed them.

## Licence (story #1690)

Every published package carries the MWNF legal notice, not `UNLICENSED`: the
notice permits non-commercial/educational use, which `UNLICENSED` (all rights
reserved) would contradict, and no SPDX identifier matches its actual terms.
[`docs/LICENSE.md.template`](docs/LICENSE.md.template) is the single source of
that text — each exporter's `PublishManager.stage()` copies it verbatim
into the package as `LICENSE.md` on every `--publish` run, and
`generatePackageJson()` defaults `license` to `SEE LICENSE IN LICENSE.md`
(override with `PACKAGE_LICENSE`). `manifest.json` additionally carries a
`rights` block (`rights_holder`, `terms_url`, `attribution`) that a website
reads to render a source credit (viewer-core#79). A test per exporter checks
the staged `LICENSE.md` against the template so the packages cannot drift
apart.

## Running an export

The supported way is the `exporter` service in the repo-root `compose.yml`,
which runs against the **staging** database — the local copy of the real
dataset built by the importer. Nothing is installed on the host:

```bash
docker compose run --rm exporter <dataset> --force
```

`DB_*` is forced to `staging-mysql` and wins over the exporter's own `.env`
(dotenv does not override variables that are already set), so the database is
pinned and everything else in that file — `BASE_URL` above all — still
applies. Everything after the dataset name is passed through to
`npm run export`. See the [repo README](../../README.md) for the staging
profile itself.

Running an exporter directly on the host (`cd scripts/exporters/<dataset> &&
npm run export`) still works and reads whatever its `.env` points at, but then
node, the dependencies and a reachable database are your problem.

## Build + publish a data-package update (end to end)

Every package's source lives in
[museumwithnofrontiers/data-packages](https://github.com/museumwithnofrontiers/data-packages).
`--publish` stages an export there, with the next version; merging the pull
request that carries it publishes the version from that repository's release
workflow, through npm trusted publishing
([#2433](https://github.com/museumwithnofrontiers/inventory-app/issues/2433)).
Nothing here publishes, and nothing needs an npm login.

[`docs/publishing.md`](docs/publishing.md) has the whole cycle — the
data-packages checkout, versions, the package layout and troubleshooting.
Per dataset, the command is the same (exports are **read-only**):

```bash
docker compose --profile jobs run --rm exporter <dataset> --force --publish --base-url https://inventory.metanull.eu
```

Each exporter is single-purpose: its dataset scope — output subdirectory,
project keys, package name — is hardcoded in its `src/cli/export.ts`, and
the CLI takes no scope arguments (passing any is an error). In particular
the islamicart exporter unconditionally exports **both** `ISL` and `EPM`:
they are one dataset, and an ISL-only export would silently drop 29
collections (see [`islamicart/README.md`](islamicart/README.md)).

**Publishing changes nothing that is live.** Each site installs a pinned
version of its data package at build time, so a new version only reaches a
site once it is propagated — see
[`docs/deployment/release-and-propagation.md`](../../docs/deployment/release-and-propagation.md).

## Adding a new dataset

**A DXA gallery or exhibition** — a thematic gallery or curated exhibition
scoped by a `collections` UUID: one instance file, no directory copy.

1. Look up the collection UUID:
   `php artisan importer:find-collection gallery|exhibition <legacy id|slug|exact English title> --json`
   (inside the `app`/`staging-app` container).
2. Add `scripts/exporters/instances/<slug>.json` — see
   [`instances/README.md`](instances/README.md) for the field shapes and how
   `kind` picks `dxa-gallery` or `dxa-exhibition`.
3. Add `scripts/exporters/instances/<slug>.md`, the site note: legacy scope,
   membership and borrowed-record reasoning, gaps, decisions and per-site
   quirks — see any existing `instances/*.md` for the shape.
4. Validate counts against the legacy site/database before first publish
   (see `baroqueart/tools/legacy-validation.sql` for a worked example, and
   `.legacy-database/` for offline legacy dumps), then record the check as
   `scripts/exporters/docs/validation/<slug>-<date>.md`.
5. Stage it
   (`docker compose --profile jobs run --rm exporter dxa-gallery --instance <slug> --force --publish --base-url https://inventory.metanull.eu`,
   or `dxa-exhibition` for an exhibition). A new package's first version is
   published by hand and its trusted publisher set before data-packages
   takes it — see [`docs/publishing.md`](docs/publishing.md#trusted-publishing).
   Then create the matching site.

**A standalone site** — its feature set differs enough to need its own fork
(see *Why forked per dataset* above):

1. Copy the closest existing exporter directory to `scripts/exporters/<name>`.
2. Prune exporters the dataset doesn't need; set the hardcoded dataset
   constants in `src/cli/export.ts` (`SUBDIRECTORY`, `PROJECT_KEYS`,
   `PACKAGE_NAME`).
3. If the project's exhibitions need a root marker, the importer's
   `project-exhibition-root-keying` step already creates one (with
   `purpose: exhibitions-root`) for every non-ISL project — run it
   standalone with `--only` (see `../importer/README.md`), no full re-import
   required. On a database populated before #1505, run
   `--only collection-purpose-backfill` once so all markers carry their
   `purpose`; on a database populated before the museum→project link existed,
   run `--only museum-project-link-backfill` once so gallery partner lists can
   reproduce legacy's MWNF-384 branch (a gallery exporter otherwise reports
   `0 holding no member item` and silently ships a short list).
4. Validate counts against the legacy site/database before first publish
   (see `baroqueart/tools/legacy-validation.sql` for a worked example, and
   `.legacy-database/` for offline legacy dumps).
5. Publish, then create the matching viewer (see
   [`../viewers/README.md`](../viewers/README.md)).

**No CI edit is needed anywhere.** The `Exporter Validation` job, the
`Dependency Audit` matrix and [`.github/dependabot.yml`](../../.github/dependabot.yml)
all cover the directories under `scripts/exporters/` that contain a
`package.json` — the first two by globbing the tree at runtime, Dependabot by
its `directories: ["/scripts/exporters/*"]` pattern. A new dataset is
type-checked, linted, tested, audited and dependency-updated from its first
pull request with no configuration change.

Keep `type-check`, `lint:check` and `test` in the copied `package.json` — those
are the three scripts the job runs; a fork that drops or renames one contributes
a silently empty check rather than failing.

Do **not** add `registries:` anywhere for an exporter. Exporters read the
database and write JSON, so they consume no `@museumwnf` package; the exporter
glob is deliberately an entry that carries no credential. No npm project in
this repository consumes a package from GitHub Packages any more, so no
Dependabot entry needs one either.
