# Import Tool

Dockerized pipeline that imports legacy museum data into `inventory-app`, in
two phases that never overlap:

1. **`stage`** reads the legacy database and image tree and builds a complete,
   fully-populated copy locally — `staging-mysql` plus the staging images
   volume. It has no SSH key and cannot reach the deployed server.
2. **`ship`** takes that local copy and sends it to the deployed server as one
   bulk handoff. It has no legacy database credentials and no legacy image
   mount, and cannot read the legacy source.

Nothing goes from legacy straight to production. The separation is structural,
not conventional: it is enforced by what each service is given in `compose.yml`,
so neither phase *can* do the other's job.

A useful side effect is that the staged copy is a complete offline clone you
can browse, export from, and rework without a VPN — the `staging` profile
serves it at <http://localhost:8020> and the exporters run against it (see the
root [README](../../README.md)).

All commands below are run with Docker Compose from the repo root.

## Prerequisites

- **VPN to the legacy network**, connected and left up for the whole run —
  needed by `stage`, which reads the legacy source database (`LEGACY_DB_HOST`).
  This tool never manages the VPN; connect it yourself first.
- **SSH key** for the remote deploy host, and the host reachable on port 22 —
  needed by `ship` and `backup-permissions`. Not given to `stage`.
- `.env` file:
  ```bash
  cp scripts/import-tool/.env.example scripts/import-tool/.env
  # edit scripts/import-tool/.env with real credentials/paths
  ```

### The `--env-file` flag is not optional

These services live in the root `compose.yml` under the `import` profile, but
their credentials do **not**. Every command that touches legacy or the remote
host therefore passes `--env-file scripts/import-tool/.env` explicitly:

```bash
docker compose --env-file scripts/import-tool/.env --profile import run --rm <service>
```

(`staging-glossary-sync` is the exception: it only talks to `staging-mysql`,
whose credentials come from `compose.yml`, so it needs no `--env-file`.)

Compose auto-loads only the *project root's* `.env`, which here is the Laravel
application's own environment file — nothing to do with the importer. Without
the flag, `${OVH_SSH_KEY_HOST_PATH}` and friends fall back to their harmless
placeholder defaults and the run fails with a validation error from
`entrypoint.sh` rather than doing anything dangerous.

Keeping the file out of the project root is deliberate: it holds production
credentials and a path to the legacy image tree, and a bare `docker compose up`
must never be able to pick them up.

Variables (see `.env.example` for the full list with inline comments):

| Variable | Purpose |
|---|---|
| `OVH_HOST` / `OVH_USER` | Remote deploy host and SSH user. Named `OVH_*` for historical reasons — works with any Linux host you configure here. |
| `OVH_SSH_KEY_HOST_PATH` | Host path to the deploy SSH private key. |
| `OVH_APP_DIR` / `OVH_SHARED_DIR` | Paths on the remote host (app directory, shared/persistent storage). |
| `LEGACY_DB_*` | The legacy source database, reached over your VPN. Read by `stage` only. |
| `LEGACY_IMAGES_HOST_PATH` | Host path to the local copy of legacy's image tree, mounted read-only into `stage`. |
| `LEGACY_IMAGES_SOURCE` | Legacy's image tree on the server (a UNC path, over the VPN). `Sync-LegacyImages.ps1` mirrors it into `LEGACY_IMAGES_HOST_PATH`; no container reads it. |
| `CONFIRM_WIPE` | Required verbatim (`yes-really-wipe-production`) for `ship` to proceed. Leave unset in `.env`; pass it inline on the command line only when you mean it. |
| `ADMIN_EMAIL` / `REGULAR_USER_EMAIL` | Fallback accounts `ship` creates if no auth snapshot exists — see "Auth restore" below. |

The staged database is configured in `compose.yml`, not here: `stage` writes to
the `staging-mysql` service and `ship` dumps from it. The importer's own
configuration has no route to a production database at all.

## The import, end to end

The short version is `stage`, then `staging-glossary-sync`, then `ship`, then
publish the data packages, propagate them to the websites and take a new parity
baseline. The long version below exists because real runs surfaced steps the
short version leaves out, every one of which can silently produce a staged copy
that looks finished and is not — and because `ship` updates the application
only; the websites need steps 7 to 10. A copy-paste walkthrough of the whole
thing is at the [bottom of this file](#tldr--the-whole-import-copy-paste).

### First: make sure nothing else is importing

Two `stage` runs against the same `staging-mysql` will corrupt it — they race
on the same rows, and the damage is not obvious afterwards.

```bash
docker ps --filter "name=stage" --filter "name=import" --format "{{.Names}} {{.Status}}"
```

Anything listed is a live importer; stop it before starting another. Note that
**Ctrl-C does not stop a detached or `run`-created container** — the CLI exits
and the container keeps going, so always confirm with `docker ps` rather than
assuming. Compose names its one-offs `inventory-stage-run-<hash>`.

### Then: refresh the local copy of legacy's images

`stage` reads legacy's pictures from `LEGACY_IMAGES_HOST_PATH`, a copy of the
image tree on the legacy server. Pictures added on legacy since the last
refresh are missing from that copy, and image-sync then reports them as
`Legacy image not found` although legacy shows them. Mirror the tree first
(Windows host, VPN up):

```powershell
./scripts/import-tool/Sync-LegacyImages.ps1 -ListOnly   # what would change
./scripts/import-tool/Sync-LegacyImages.ps1
```

The mirror is exact: a file deleted on legacy is deleted from the copy too. The
log, under `scripts/import-tool/logs/`, lists every file copied or deleted. A
full pass takes about 40 minutes, most of it comparing unchanged files.

### 1. Build the local copy from legacy

VPN up; no contact with the server. Around 1h40m for the full dataset, so run
it **detached and named** — an attached run dies with the terminal that started
it.

```bash
docker compose --env-file scripts/import-tool/.env --profile import run -d --name inventory-import-stage stage
docker logs -f inventory-import-stage        # ends: Mode 'stage' completed successfully
docker rm inventory-import-stage
```

If the staging database already holds a partial or aborted run, reset it first
— the importer skips rows that already exist, so a half-finished import stays
half-finished:

```bash
docker compose run --rm staging-migrate php artisan migrate:fresh --force
```

The importer ends one of three ways, and `stage` follows it:

- **0, clean** — `stage` runs image-sync and completes.
- **1, row errors** — this dataset always produces a few hundred per-row
  errors (bad or missing legacy data), summarised in the run's own output. Not
  a reason to skip image-sync: `stage` still completes and exits 0. Expect on
  the order of 141,000 rows imported with ~380 errors.
- **2, a step failed** — a step threw, or processed nothing and reported
  errors (its source query timed out, say). The importer stops there, names
  the step and its cause after the summary, and `stage` ends with
  `FATAL: importer 'import' stopped on a failed step`, skips image-sync and
  exits non-zero. The staged copy is incomplete: do not ship it. Reset staging
  and stage again.

### 2. Re-run image-sync until it stops failing

**One `stage` run is not enough**, at least on a host whose legacy images live
on a mapped network drive. Image copies fail in bulk with

```
ENOMEM: not enough memory, copyfile '/legacy-images/…' -> '/staging/images/…'
```

which is not the container running out of memory — it peaked at 207 MiB of
7.7 GiB — but Docker Desktop's file-sharing layer buckling under sustained
reads. A first full run produced 1,303 image failures, of which 1,035 were this
and only 244 were real.

`image-sync` copies only rows still marked `size=1`, so re-running it retries
exactly the failures and skips everything that landed. Run it until the count
is zero:

```bash
docker compose --env-file scripts/import-tool/.env --profile import run --rm --entrypoint sh stage -c "cd /opt/import-tool/importer && npx tsx src/cli/import.ts image-sync --copy --target-dir /staging/images 2>&1 | grep -c ENOMEM"
```

```bash
docker compose --env-file scripts/import-tool/.env --profile import run --rm --entrypoint sh stage -c "cd /opt/import-tool/importer && npx tsx src/cli/import.ts image-sync --copy --target-dir /staging/images"
```

Three passes cleared it completely on a from-scratch rebuild. What remains
afterwards is `Legacy image not found` — the legacy tree's own broken links
(263 of them), which no amount of re-running will fix.

This failure mode was invisible for years because the staging volume was
accumulated across many runs, each one quietly filling the gaps left by the
last. A rebuild from empty surfaces all of it at once.

### 3. Confirm the images reconcile

Every synced image row (`size` no longer 1) must have its file in the images
volume, named by the last part of its `path`. If any is missing, go back to
step 2. Comparing totals does not work: the volume is kept between runs (image
ids are stable, so a failed copy still has the previous file), and it holds
more files than any one run has rows.

```powershell
$q = "SELECT path FROM item_images WHERE size<>1 UNION ALL SELECT path FROM collection_images WHERE size<>1 UNION ALL SELECT path FROM partner_images WHERE size<>1 UNION ALL SELECT path FROM partner_logos WHERE size<>1 UNION ALL SELECT path FROM contributor_images WHERE size<>1 UNION ALL SELECT path FROM timeline_event_images WHERE size<>1;"
$paths = docker compose exec -T staging-mysql mysql -u inventory -psecret inventory -N -e $q 2>$null
$files = [Collections.Generic.HashSet[string]]::new([string[]](docker run --rm -v inventory-staging-images:/i alpine ls /i))
$missing = @($paths | Where-Object { -not $files.Contains(($_ -split '/')[-1]) })
"synced rows: $($paths.Count)  missing files: $($missing.Count)"   # must be 0
```

### 4. Compute glossary links against the local copy

Required before `ship`: these become plain data rows in the dump, so the
deployed host never has to recompute them.

```bash
docker compose run --rm staging-glossary-sync
```

### 5. Review it, and compare it with production, before shipping

```bash
docker compose --profile staging up -d          # http://localhost:8020
docker compose run --rm staging-seed-auth       # once — admin@example.com / password
```

**Compare the staged item counts with production, per project and type.** A
whole importer step can fail and leave the rest of the run looking normal:
reimport 8 staged twice without a single mwnf3 object (17,935 items instead of
28,553), and only this comparison caught it. Count the staged copy:

```bash
docker compose exec -T staging-mysql mysql -u inventory -psecret inventory -e "SELECT COALESCE(p.internal_name,'(none)') project, i.type, COUNT(*) n FROM items i LEFT JOIN projects p ON p.id=i.project_id GROUP BY 1,2 ORDER BY 1,2;"
```

and the same on the server, with the app's own models (`ssh` to the deploy
host, `php artisan tinker --execute=…` in the app directory, with
`< /dev/null` so tinker does not wait on input). The groups must match. Small
growth where curators edit live legacy (the-hijaz-railway) is normal; a group
that shrinks or disappears is not — reset staging and stage again.

### 6. Send it to the server

DESTRUCTIVE — wipes and rebuilds the deployed app. First snapshot the deployed
users, roles and permissions, which `ship` restores after the wipe (without a
snapshot it falls back to two accounts; see [Auth restore](#auth-restore-ship)):

```bash
docker compose --env-file scripts/import-tool/.env --profile import run --rm backup-permissions
```

Ship only over a clean line. `ship` wipes the server, restores auth, then
copies one dump of a few hundred MB with no resume: a dropped connection
mid-copy leaves production with an empty dataset until a rerun succeeds. Run
the ping below a few times and ship only when it says 20/20:

```powershell
(Test-Connection <deploy host> -Count 20 | Where-Object Status -eq 'Success').Count
$env:CONFIRM_WIPE = 'yes-really-wipe-production'
docker compose --env-file scripts/import-tool/.env --profile import run --build --rm ship
```

Then check the server's counts equal the staged ones. `ship` revokes OAuth
tokens with the auth restore, so connected apps (the MCP connectors) must sign
in again.

Run `stage` and `staging-glossary-sync` again any time to pick up new/changed
legacy data. `staging-glossary-sync` always recomputes glossary links from
scratch. `stage` only adds: a record already staged is skipped, never
updated, so an importer fix or a legacy edit reaches a staged record only after
`migrate:fresh`. A full reimport therefore always starts from an empty schema.
Only `ship` touches the remote server, and only `ship` needs `CONFIRM_WIPE`.

There is no partial-push mode, on purpose — a `ship` always rebuilds the
deployed dataset from the staged copy, so what is deployed is exactly what you
reviewed locally.

`ship` is where the *application* is up to date. The public websites are not:
each one builds from a published npm package, and nothing above touches a
package. The steps below get the new data in front of a visitor.

### 7. Publish the data packages

Each website installs `@museumwnf/<dataset>-data` from the public npmjs
registry (`registry.npmjs.org`). Every package's source lives in
[data-packages](https://github.com/museumwithnofrontiers/data-packages): an
exporter run with `--publish` stages its export there, with the next version,
and merging the pull request that carries it publishes every changed package
from that repository's release workflow
([#2433](https://github.com/museumwithnofrontiers/inventory-app/issues/2433)).
Nothing here publishes, and nothing needs an npm login. The compose
`exporter` service forces the staging database into its environment, so this
reads the copy you just reviewed, whatever `scripts/exporters/<dataset>/.env`
says. `docker-entrypoint.sh all` ([#1922](https://github.com/museumwithnofrontiers/inventory-app/issues/1922))
does every dataset in one run — that is the command below; see
[`scripts/exporters/README.md`](../exporters/README.md#batch-re-export-every-instance-in-one-run)
for `--dry-run`, `--only <slug>[,<slug>…]` to redo a subset, and what its
summary table and failure handling look like. The mechanics are in
[`scripts/exporters/docs/publishing.md`](../exporters/docs/publishing.md).

The data-packages checkout sits next to this one (`../data-packages`, or
`DATA_PACKAGES_PATH`); `--publish` refuses to start without it.

`--publish` requires `--base-url https://inventory.metanull.eu`. The packages
bake every image URL in, and without an absolute base they all point nowhere
(the 2026-10-19 publish broke every site's images that way).

```bash
# What is published now — the only reliable way to read it. No credential
# needed: @museumwnf packages are public.
docker compose --profile tools run --rm --no-deps -w /var/www/app tools npm view @museumwnf/<dataset>-data version
# Bring data-packages to main and branch it.
git -C ../data-packages switch main
git -C ../data-packages pull --ff-only
git -C ../data-packages switch -c feature/reimport-<date>
# See the plan, then export every dataset from staging and stage the next
# patch of each one that changed.
docker compose --profile jobs run --rm --no-deps exporter all --dry-run
docker compose --profile jobs run --rm --no-deps exporter all --force --publish --base-url https://inventory.metanull.eu
# To redo some instances instead of the whole batch:
docker compose --profile jobs run --rm --no-deps exporter all --force --publish --base-url https://inventory.metanull.eu --only <slug>[,<slug>…]
```

The next version is one patch above the later of the version data-packages
holds and the registry's latest. A package whose export is unchanged keeps
its version and is not staged. Pass `--package-version <next>` yourself only
for a minor/major bump.

`all` runs every instance to the end even if one fails, then prints a summary
table (instance, exporter, result, staged version) and exits non-zero if any
instance failed — staging only some leaves the other websites on the previous
import, and the summary is how you see that happened instead of assuming
everything went out. It also prints the ready-to-paste
`--expect <pkg>@<version>` list that step 8 needs.

Then publish:

1. Commit `packages/` on the data-packages branch, push it and open a pull
   request. Its `Validate packages` check refuses a changed package whose
   version is not above main's or is already published.
2. Merge it. Its `release.yml` run publishes every package whose version the
   registry does not hold yet, with provenance.
3. Confirm with the first command above: it must print the new version
   (npmjs can lag a few minutes; never conclude from one check).

### 8. Propagate the new versions to the websites

Publishing changes nothing that is live. Each website is its own repository
(`github.com/museumwithnofrontiers/<site>`) and pins its data package twice: a
caret range in `package.json` and an exact version in `package-lock.json`. The
deploy runs `npm ci` from the lockfile on every push to `main`, so **the
lockfile is what visitors see**, and the new version reaches a site only when
someone moves it. Every site's `.github/dependabot.yml` deliberately ignores
the `@museumwnf` scope: moving this pin is an operator step.

One run of `tools/propagate.mjs` in
[viewer-workflows](https://github.com/museumwithnofrontiers/viewer-workflows)
moves every site at once: it opens one pull request per site that needs a
newer version, and each merges itself when that site's checks pass. Merging is
what deploys. The procedure, with its Docker command line, is §5.2 of
[`docs/deployment/release-and-propagation.md`](../../docs/deployment/release-and-propagation.md).
Two rules from experience:

- **Always pass `--expect <pkg>@<version>` for every package published in
  step 7** (the list step 7 prints). Without it, a run that starts before the
  registry serves the new versions bumps nothing and still exits 0.
- **Dry-run first** (`--dry-run`): it lists the sites it would update. Every
  site with a published package should be on that list.

Then wait until every pull request is merged and the `deploy.yml` run on each
merge commit has succeeded (`gh run list --workflow deploy.yml --commit
<sha>` in the site's repository). Deploys queue for runners when many sites
merge at once, so a pending run is not yet a failure.

### 9. Record the site commits in this repository

`.new-architecture/` tracks every platform repository as a submodule, so this
repository records which commit of each website goes with the data it shipped.
The pointers do not move on their own — an upstream merge is invisible to
`git status` until you refresh — so after the site pull requests merge:

```bash
git submodule update --remote .new-architecture
git add .new-architecture
```

Commit the bump on its own branch and merge it through a pull request like
anything else. Its diff is the review: one gitlink per site, each moving to
the commit that pinned the new data.

### 10. Take a new parity baseline

Once the sites are deployed, compare every site's published package with
legacy and take the run as the new baseline. The tool and its options are in
[`scripts/parity/README.md`](../parity/README.md); from a worktree, point
`PARITY_WORK_PATH`, `LEGACY_DATABASE_PATH` and `LEGACY_CODE_PATH` at the main
checkout so the cache is shared.

```bash
docker compose run --rm parity
```

The gate compares the run with the newest baseline under
`scripts/parity/baselines/` and fails on any regression. Explain each one
before taking the baseline: check the live legacy site or database, not only
the dump, which falls behind where curators still edit (the-hijaz-railway). A
legacy data error becomes a child task of #2339; an import or export defect
gets its own issue.

Then copy `diff-runs.json`, `diff-runs.md`, `overview.json`, `overview.md`,
`packages.md` and `sitemap.md` from `out/` to
`scripts/parity/baselines/<date>/`, add a paragraph under "Baselines" in the
parity README (what changed, and why each regression is accepted), and open
the pull request.

## The staging volumes

Two volumes hold the staged clone. They are declared `external:` in
`compose.yml` so that a stray `docker compose down -v` cannot destroy them: a
full stage is hours of importing and several gigabytes of images.

| Volume | Holds |
|---|---|
| `inventory-staging-mysql-data` | the staged database |
| `inventory-staging-images` | the staged images (flat `<uuid>.jpg`, ~7.5 GB) |

Because they are external, Compose will not create them either. Once, before
the first import:

```bash
docker volume create inventory-staging-mysql-data
docker volume create inventory-staging-images
```

The hyphen distinguishes them on sight: Compose names the volumes it manages
`inventory_<name>` with an underscore, and those are the disposable ones.

### Back up before a destructive re-stage

Restoring is much cheaper than re-importing:

```bash
docker compose --profile staging up -d staging-mysql
docker compose exec -T staging-mysql mysqldump -u inventory -psecret inventory > staging-db.sql
docker run --rm -v inventory-staging-images:/data -v "${PWD}:/out" alpine \
  tar czf /out/staging-images.tar.gz -C /data .
```

To restore into empty volumes:

```bash
docker compose --profile staging up -d staging-mysql
docker compose exec -T staging-mysql mysql -u inventory -psecret inventory < staging-db.sql
docker run --rm -v inventory-staging-images:/data -v "${PWD}:/out" alpine \
  tar xzf /out/staging-images.tar.gz -C /data
```

### Start over completely

```bash
docker compose --profile staging down
docker volume rm inventory-staging-mysql-data inventory-staging-images
docker volume create inventory-staging-mysql-data
docker volume create inventory-staging-images
```

Then run `stage` again — `staging-migrate` recreates the schema on the way in.

## Commands reference

| Command | Touches remote server? | What it does |
|---|---|---|
| `stage` | No — has no SSH key | Imports legacy data + syncs images into `staging-mysql` and the staging images volume. No auth/seeders: the staged database has no users (add one locally with the `staging-seed-auth` service if you want to browse it). |
| `staging-glossary-sync` | No | Computes glossary term ↔ item/collection/timeline-event links against `staging-mysql`, in-container, via `glossary:bulk-resync` (one combined pattern per language, one pass per translation — a couple of minutes, vs. over a day for `glossary:resync`'s one-job-per-spelling approach). Run after `stage`, before `ship`. |
| `ship` | Yes, **destructive** | Rebuilds the remote app layer (`db:wipe` → `migrate` → `db:seed` → `permission:sync` → restore/recreate users), then loads `staging-mysql`'s content tables (dumped and restored directly on the remote host) and pushes the already-staged images into the app's private originals directory (resolved on the remote host with `php artisan storage:image-path available`), emptying the public pictures cache that `/pub` refills on demand. Requires `stage` (+ `staging-glossary-sync`) to have populated the staging volumes. Requires `CONFIRM_WIPE`. |
| `backup-permissions` | Yes (read + write snapshot) | Snapshots users (incl. MFA), roles, permissions, and API tokens to an encrypted file on the remote host, plus a timestamped local copy. Read-only against application data. Run it before your first `ship`. |

### Dry runs

Set `DRY_RUN=1` to pass `--dry-run` through to `stage`'s `import` and
`image-sync` steps — nothing is written anywhere. Not available for `ship`'s
wipe/restore steps.

### Re-running a single importer step

`entrypoint.sh` reads its first argument as a mode (`stage`/`ship`/
`backup-permissions`) only — it does not forward flags like `--only` to the
importer CLI. To target one step, bypass the entrypoint and rebuild `stage`
first if you changed the importer's source (its image `COPY`s `src/` at
*build* time; the running container never reads the host working tree):

```
docker compose --profile import build stage
docker compose --env-file scripts/import-tool/.env --profile import run --rm --entrypoint sh stage -c "cd /opt/import-tool/importer && npx tsx src/cli/import.ts import --only <key>"
```

**Dependency order matters even for a single targeted step**, and a full
`stage` run gets it right automatically (via each importer's declared
`dependencies`) in a way manual `--only` runs do not:

- `sh-exhibition-item` writes `collection_item.extra` as a full replace
  (`ON DUPLICATE KEY UPDATE extra = VALUES(extra)`) for both exhibition and
  theme/subtheme pivots. Re-running it *after*
  `sh-exhibition-item-justifications` wipes the justifications that step
  just wrote — run `sh-exhibition-item` first, or not at all, when you only
  meant to touch justifications.
- `sh-monument`'s refresh (an already-imported monument's translations are
  recomputed from legacy on every run) also fully replaces `extra`, and its
  own transformer never sets `legacy_display_status` — that flag belongs to
  `sh-item-display-status`. Re-running `sh-monument` *after*
  `sh-item-display-status` silently erases the flag `sh-item-display-status`
  just stamped. Run `sh-item-display-status` **last** whenever both need a
  targeted re-run.

Either mistake is silent — no error, no warning, just a value quietly
missing from the next export. Confirmed only by diffing a fresh export
against what is actually published, not by staging counts or import logs.

## Auth restore (`ship`)

`ship` rebuilds the remote app's users/roles/permissions from scratch, then
restores them:

1. If a snapshot exists at `AUTH_SNAPSHOT_REMOTE` (created by
   `backup-permissions`), it's restored exactly — every user, MFA setup, and
   role/permission assignment as they were.
2. Otherwise, if both `ADMIN_EMAIL` and `REGULAR_USER_EMAIL` are set,
   exactly those two accounts are recreated (`Manager of Users` and
   `Regular User` roles respectively). Neither gets a plaintext password —
   `user:create` emails a password-reset invitation, so outbound mail must
   work on the remote host.
3. If neither applies, the run aborts right after the wipe, with a clear
   message — the `users` table is left empty and nothing else runs. Run
   `backup-permissions` at least once beforehand to avoid this.

Nothing from the staged database is involved: `ship`'s dump excludes `users`,
`roles`, `permissions`, tokens and sessions outright (`SHIP_EXCLUDED_TABLES`
in `entrypoint.sh`), so accounts created locally — by `staging-seed-auth`, say
— cannot reach the server.

## Testing against the real remote server

In order of increasing risk:

1. `backup-permissions` — read-only against application data.
2. `DRY_RUN=1 stage` — confirms the legacy source is reachable and the
   importer runs, without writing anything.
3. `stage` for real — local only, nothing remote can be affected.
4. Review the result at <http://localhost:8020>.
5. `ship` — only after 1–4 are clean, and only with a known-good snapshot
   already at `AUTH_SNAPSHOT_REMOTE`.

## TL;DR — the whole import, copy-paste

Every command needed for a complete re-import, in order, for a PowerShell
prompt at the repo root. Lines marked `# OPTIONAL` are diagnostics and
recovery — run them when the check above them says to, skip them otherwise.
Everything else is required.

The VPN to the legacy network must be up for steps 2, 3 and 4, and stay up for
the whole of step 3. Step 8 needs the SSH key instead (and the count check in
step 7 reads the server over it). Steps 9 to 11 need neither — only `gh` logged in and a
data-packages checkout next to this one; step 12 needs the VPN
again, for live legacy.

```powershell
# ── 0. NOTHING ELSE MAY BE IMPORTING ─────────────────────────────────────────
# Two concurrent stage runs corrupt staging-mysql. This must print nothing.
docker ps --filter "name=stage" --filter "name=import" --format "{{.Names}} {{.Status}}"

# OPTIONAL — only if the line above listed something. Ctrl-C does NOT stop a
# detached container; stop it by the name docker ps printed, then re-check.
docker stop inventory-import-stage

# ── 1. STACK UP ──────────────────────────────────────────────────────────────
# OPTIONAL — first time on this machine only: the staging volumes are external,
# so Compose will not create them for you.
docker volume create inventory-staging-mysql-data
docker volume create inventory-staging-images

docker compose --profile staging up -d
docker compose --env-file scripts/import-tool/.env --profile import build stage

# ── 2. PRE-FLIGHT ────────────────────────────────────────────────────────────
# Confirms the VPN reaches legacy and staging-mysql answers, before you commit
# an hour and a half to a run that would fail at the first query.
docker compose --env-file scripts/import-tool/.env --profile import run --rm --entrypoint sh stage -c "cd /opt/import-tool/importer && npx tsx src/cli/import.ts validate"

# Mirror legacy's image tree into LEGACY_IMAGES_HOST_PATH (~40 min). Without
# it, pictures added on legacy since the last mirror are "not found".
./scripts/import-tool/Sync-LegacyImages.ps1

# Start the dataset over. stage only adds: a record already staged is skipped,
# never updated, so without this a fix or a legacy edit never reaches it.
docker compose run --rm staging-migrate php artisan migrate:fresh --force

# ── 3. STAGE (~1h40m) ────────────────────────────────────────────────────────
# Detached and named on purpose: an attached run dies with its terminal.
docker compose --env-file scripts/import-tool/.env --profile import run -d --name inventory-import-stage stage

# Follow it. Ends with: Mode 'stage' completed successfully
# Expect ~141,000 rows imported and ~380 per-row errors — that is this dataset.
# If it ends with "FATAL: importer 'import' stopped on a failed step" instead,
# a whole step failed and the importer stopped: fix the cause it names, then
# go back to the migrate:fresh line in step 2 and stage again. Never ship it.
docker logs -f inventory-import-stage

# ── 4. THE ENOMEM LOOP — DO NOT SKIP ─────────────────────────────────────────
# Image copies fail in bulk when Docker Desktop's file sharing buckles on the
# legacy image drive. Count them (1035 of 1303 failures on a from-scratch run):
docker logs inventory-import-stage 2>&1 | Select-String -Pattern "ENOMEM" -AllMatches | Measure-Object -Line

docker rm inventory-import-stage

# OPTIONAL, REPEATED — run this while the count above is non-zero. image-sync
# only copies rows still marked size=1, so each pass retries exactly the
# failures. Three passes cleared it completely.
docker compose --env-file scripts/import-tool/.env --profile import run --rm --entrypoint sh stage -c "cd /opt/import-tool/importer && npx tsx src/cli/import.ts image-sync --copy --target-dir /staging/images"

# Re-count after each pass. Stop when this prints 0. What remains then is
# "Legacy image not found" — the legacy tree's own broken links, unfixable.
docker compose --env-file scripts/import-tool/.env --profile import run --rm --entrypoint sh stage -c "cd /opt/import-tool/importer && npx tsx src/cli/import.ts image-sync --copy --target-dir /staging/images 2>&1 | grep -c ENOMEM"

# ── 5. RECONCILE ─────────────────────────────────────────────────────────────
# Every synced image row MUST have its file. If any is missing, back to 4.
$q = "SELECT path FROM item_images WHERE size<>1 UNION ALL SELECT path FROM collection_images WHERE size<>1 UNION ALL SELECT path FROM partner_images WHERE size<>1 UNION ALL SELECT path FROM partner_logos WHERE size<>1 UNION ALL SELECT path FROM contributor_images WHERE size<>1 UNION ALL SELECT path FROM timeline_event_images WHERE size<>1;"
$paths = docker compose exec -T staging-mysql mysql -u inventory -psecret inventory -N -e $q 2>$null
$files = [Collections.Generic.HashSet[string]]::new([string[]](docker run --rm -v inventory-staging-images:/i alpine ls /i))
@($paths | Where-Object { -not $files.Contains(($_ -split '/')[-1]) }).Count   # must print 0

# ── 6. GLOSSARY LINKS (required before ship) ─────────────────────────────────
docker compose run --rm staging-glossary-sync

# ── 7. REVIEW LOCALLY ────────────────────────────────────────────────────────
# Gives you a login for http://localhost:8020/admin — admin@example.com / password
docker compose run --rm staging-seed-auth

# OPTIONAL — regenerate the website data packages from the staged copy, without
# publishing them. `all` (#1922) does every dataset in one run; running only
# some of them individually instead leaves the rest on the previous import.
docker compose run --rm exporter all --force

# Compare the staged item counts per project and type with production (the
# same counts on the server; see "5. Review it, and compare it with
# production" above). A group that shrinks or disappears means a step failed:
# reset staging and stage again.
docker compose exec -T staging-mysql mysql -u inventory -psecret inventory -e "SELECT COALESCE(p.internal_name,'(none)') project, i.type, COUNT(*) n FROM items i LEFT JOIN projects p ON p.id=i.project_id GROUP BY 1,2 ORDER BY 1,2;"

# ── 8. SHIP — DESTRUCTIVE, REBUILDS THE DEPLOYED APP ─────────────────────────
# Snapshot the deployed users/roles/permissions first, so ship's auth-restore
# has something real to restore instead of falling back to two accounts.
docker compose --env-file scripts/import-tool/.env --profile import run --rm backup-permissions

# Ship only when this prints 20, a few times in a row: a dropped connection
# mid-copy leaves production empty until a rerun succeeds.
(Test-Connection <deploy host> -Count 20 | Where-Object Status -eq 'Success').Count

$env:CONFIRM_WIPE = 'yes-really-wipe-production'
docker compose --env-file scripts/import-tool/.env --profile import run --build --rm ship

# ── 9. PUBLISH THE DATA PACKAGES ─────────────────────────────────────────────
# Shipping updates the application; the websites read published npm packages
# and step 8 does not touch them. `--publish` exports AND stages each package
# into the data-packages checkout, so this replaces step 7's export commands
# rather than following them. `docker-entrypoint.sh all` (#1922) does every
# dataset — the forked exporters plus the parameterised ones, once per
# instance slug they carry — in one run instead of one invocation per row.
# Merging the data-packages pull request publishes them (#2433); nothing here
# needs an npm login.

# Bring data-packages to main and branch it.
git -C ../data-packages switch main
git -C ../data-packages pull --ff-only
git -C ../data-packages switch -c feature/reimport-<date>

# See the plan first — touches nothing.
docker compose --profile jobs run --rm --no-deps exporter all --dry-run

# Export every dataset from staging and stage the next patch of each one that
# changed. One dataset failing does not stop the others. Ends with a summary
# table (instance, exporter, result, staged version) and a ready-to-paste
# `node tools/propagate.mjs --expect <pkg>@<version> …` block for step 10.
# --base-url is required: the packages bake every image URL in.
docker compose --profile jobs run --rm --no-deps exporter all --force --publish --base-url https://inventory.metanull.eu

# To redo some instances instead of the whole batch:
docker compose --profile jobs run --rm --no-deps exporter all --force --publish --base-url https://inventory.metanull.eu --only carpets

# Publish: one pull request in data-packages, merged once its checks pass.
git -C ../data-packages add packages
git -C ../data-packages commit -m "Reimport <date>"
git -C ../data-packages push -u origin feature/reimport-<date>
gh pr create -R museumwithnofrontiers/data-packages --head feature/reimport-<date> --fill
gh pr checks -R museumwithnofrontiers/data-packages feature/reimport-<date> --watch
gh pr merge -R museumwithnofrontiers/data-packages feature/reimport-<date> --squash --delete-branch
gh run list -R museumwithnofrontiers/data-packages --workflow release.yml --limit 1

# Confirm before moving on — the registry, not the summary table, is the
# source of truth. Must print a version newer than before the run; if it
# still prints the same one, the release run did not publish it and the
# website will not see anything either.
docker compose --profile tools run --rm --no-deps -w /var/www/app tools npm view "@museumwnf/<slug>-data" version

# ── 10. PROPAGATE TO THE WEBSITES ────────────────────────────────────────────
# Publishing changes nothing that is live: each website pins its package in
# its lockfile. One propagate run opens a pull request on every site that
# needs a newer version; each merges itself when its checks pass, and the
# merge deploys. Full command line: §5.2 of
# docs/deployment/release-and-propagation.md. Paste the --expect list step 9
# printed (without it a run can bump nothing and still exit 0), dry-run first.
node tools/propagate.mjs --owner museumwithnofrontiers --expect <pkg>@<version> … --dry-run
node tools/propagate.mjs --owner museumwithnofrontiers --expect <pkg>@<version> …

# Then, per site: wait for the PR to reach MERGED and for the deploy.yml run
# on its merge commit to succeed (deploys queue when many sites merge at once).
gh run list --repo museumwithnofrontiers/<site> --workflow deploy.yml --commit <merge sha>

# ── 11. RECORD THE SITE COMMITS HERE ─────────────────────────────────────────
# .new-architecture/ tracks every platform repository as a submodule, so this
# repository records which commit of each website goes with the data it
# shipped. Upstream merges are invisible to `git status` until you refresh.
# Back at the inventory-app repo root, after the site PRs have merged:
git checkout main
git pull --ff-only
git checkout -B chore/new-architecture-pointers
git submodule update --remote .new-architecture
git add .new-architecture

# Expect one gitlink per site moving (plus any platform package released meanwhile).
git diff --cached --stat

git commit -m "chore: bump .new-architecture pointers after the re-import"
git push -u origin chore/new-architecture-pointers
gh pr create --fill
gh pr merge --squash --delete-branch --auto

# ── 12. NEW PARITY BASELINE ──────────────────────────────────────────────────
# Once the sites are deployed: compare every published package with legacy.
# From a worktree, point the three paths at the main checkout (shared cache).
$env:PARITY_WORK_PATH = "<main checkout>\tmp\parity"
$env:LEGACY_DATABASE_PATH = "<main checkout>\.legacy-database"
$env:LEGACY_CODE_PATH = "<main checkout>\.legacy-code"
docker compose run --rm parity

# Explain every regression the gate lists (check live legacy, not only the
# dump), then copy diff-runs.json, diff-runs.md, overview.json, overview.md,
# packages.md and sitemap.md from out/ to scripts/parity/baselines/<date>/,
# add a paragraph under "Baselines" in scripts/parity/README.md, and open the
# pull request.
```
