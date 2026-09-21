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
| `LEGACY_IMAGES_HOST_PATH` | Host path to the legacy images source, mounted read-only into `stage`. |
| `CONFIRM_WIPE` | Required verbatim (`yes-really-wipe-production`) for `ship` to proceed. Leave unset in `.env`; pass it inline on the command line only when you mean it. |
| `ADMIN_EMAIL` / `REGULAR_USER_EMAIL` | Fallback accounts `ship` creates if no auth snapshot exists — see "Auth restore" below. |

The staged database is configured in `compose.yml`, not here: `stage` writes to
the `staging-mysql` service and `ship` dumps from it. The importer's own
configuration has no route to a production database at all.

## The import, end to end

The short version is `stage`, then `staging-glossary-sync`, then `ship`, then
publish the seven data packages and pin them in the seven websites. The long
version below exists because a full run from empty volumes surfaced four steps
the short version leaves out, every one of which can silently produce a staged
copy that looks finished and is not — and because `ship` updates the
application only; the websites need steps 7 to 9. A copy-paste walkthrough of
the whole thing is at the [bottom of this file](#tldr--the-whole-import-copy-paste).

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

`stage` exits 0 even though the importer itself exits non-zero: this dataset
always produces a few hundred per-row errors (bad or missing legacy data),
which are summarised in the run's own output and are not a reason to skip
image-sync. Expect on the order of 141,000 rows imported with ~380 errors.

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

Rows minus unsynced must equal files on disk. If it doesn't, go back to step 2.

```bash
docker run --rm -v inventory-staging-images:/data alpine sh -c "ls -1 /data | wc -l"
```

```bash
docker compose exec -T staging-mysql mysql -u inventory -psecret -N -e "SELECT (SELECT COUNT(*) FROM inventory.item_images)+(SELECT COUNT(*) FROM inventory.collection_images)+(SELECT COUNT(*) FROM inventory.partner_images)+(SELECT COUNT(*) FROM inventory.partner_logos)+(SELECT COUNT(*) FROM inventory.contributor_images)+(SELECT COUNT(*) FROM inventory.timeline_event_images) AS rows_, (SELECT COUNT(*) FROM inventory.item_images WHERE size=1)+(SELECT COUNT(*) FROM inventory.collection_images WHERE size=1)+(SELECT COUNT(*) FROM inventory.partner_images WHERE size=1)+(SELECT COUNT(*) FROM inventory.partner_logos WHERE size=1) AS unsynced;"
```

### 4. Compute glossary links against the local copy

Required before `ship`: these become plain data rows in the dump, so the
deployed host never has to recompute them.

```bash
docker compose run --rm staging-glossary-sync
```

### 5. Review it locally before shipping

```bash
docker compose --profile staging up -d          # http://localhost:8020
docker compose run --rm staging-seed-auth       # once — admin@example.com / password
```

### 6. Send it to the server

DESTRUCTIVE — wipes and rebuilds the deployed app.

```bash
$env:CONFIRM_WIPE = 'yes-really-wipe-production'
docker compose --env-file scripts/import-tool/.env --profile import run --build --rm ship
```

Run `stage` and `staging-glossary-sync` again any time to pick up new/changed
legacy data — both are safe to rerun against an already-populated
`staging-mysql` (idempotent import, and `staging-glossary-sync` always
recomputes glossary links from scratch). Only `ship` touches the remote
server, and only `ship` needs `CONFIRM_WIPE`.

Incremental updates are the same two steps: re-`stage`, then re-`ship`. There
is no partial-push mode, on purpose — a `ship` always rebuilds the deployed
dataset from the staged copy, so what is deployed is exactly what you reviewed
locally.

`ship` is where the *application* is up to date. The seven public websites are
not: each one builds from a published npm package, and nothing above touches a
package. Three more steps get the new data in front of a visitor.

### 7. Publish the data packages

Each website installs `@museumwnf/<dataset>-data` from the public npmjs
registry (`registry.npmjs.org`), and an exporter run with `--publish` both
exports and publishes — there is no separate `npm publish`. The compose
`exporter` service forces the staging database into its environment, so this
reads the copy you just reviewed, whatever `scripts/exporters/<dataset>/.env`
says.

Authentication is a one-time, per-machine step, done **on the host** — this
is a manual, local publish, never run from CI (see
[`docs/deployment/release-and-propagation.md`](../../docs/deployment/release-and-propagation.md)
§5.3):

```bash
npm login
```

That writes a session token to your **host** `~/.npmrc`. `compose.yml` mounts
that file read-only into the `exporter` container
(`${HOME}/.npmrc:/root/.npmrc:ro`) — the container never runs `npm login`
itself and no token is ever written to a tracked file. **Windows** —
PowerShell does not export `$HOME` to child processes, so `${HOME}` above
resolves to nothing unless you set it first, in every new shell:

```powershell
$env:HOME = $env:USERPROFILE
```

`--publish` runs `npm whoami` against that mounted session before the export
starts and fails fast with an `npm login` hint if it is dead (#1865), instead
of only surfacing as a registry 404 after the whole export has run. The
container has no browser (`NPM_CONFIG_BROWSER=false` in `compose.yml`), so if
npmjs still asks for a 2FA one-time code or a web-login confirmation, npm
prints the URL right there in the terminal and polls the registry for the
login to complete — open the URL yourself, tick "stay authenticated for
publish for the next 5 minutes", and the run continues on its own.

```bash
# What is published now — the only reliable way to read it. No credential
# needed: @museumwnf packages are public.
docker compose --profile tools run --rm --no-deps -w /var/www/app tools npm view @museumwnf/<dataset>-data version
# Export from staging and publish the next patch of it.
docker compose run --rm exporter <dataset> --force --publish
```

A single `--publish` run computes the next patch version: it asks the
registry first and uses it whenever the registry is ahead of the local
counter in `output/.version-<dataset>` — a gitignored, per-worktree file that
is absent in any worktree that has never exported, so a fresh worktree or a
deleted `output/` no longer walks into a taken number. As of #1865 that
counter is written only once `npm publish` has actually succeeded, so a
failed publish never burns the number — a plain rerun retries the very same
version rather than skipping past it. Pass `--package-version <next>`
yourself only for a minor/major bump, or when the registry cannot be reached.

The exporter prints `✓ Published: @museumwnf/<dataset>-data@<next>` on
success; confirm by running the first command again. Seven datasets, seven
runs; publishing only some of them leaves the other websites on the previous
import with no error anywhere.

`PACKAGE_REPO_URL` in `scripts/exporters/<dataset>/.env` is good package
metadata — it populates the published `repository` field — but npmjs does not
require it to install a version, so it is not something a first publish is
blocked on.

### 8. Pin the new version in each website

Publishing changes nothing that is live. Each website is its own repository
(`github.com/museumwithnofrontiers/<site>`) and pins its data package twice: a
caret range in `package.json` and an exact version in `package-lock.json`. The
deploy runs `npm ci` from the lockfile on every push to `main`, so **the
lockfile is what visitors see**, and the new version reaches a site only when
someone moves it. Nobody does this for you automatically: every site's
`.github/dependabot.yml` deliberately ignores the `@museumwnf` scope — not
because Dependabot cannot authenticate (the packages are public on npmjs, and
Dependabot reads those fine) but because moving this pin is meant to stay a
human, operator-driven step, the same principle documented for the shared
platform packages' propagation in
[`docs/deployment/release-and-propagation.md`](../../docs/deployment/release-and-propagation.md)
(§5.2, "Propagate"). `main` is also PR-only on all seven.

In a checkout of the site, on `main`:

```bash
npm install @museumwnf/<site>-data@^<next>
```

That one command rewrites the range and the lockfile together (four lines:
spec, version, resolved URL, integrity — nothing else). Then, in order: run
the site's tests, look at the lockfile diff for anything that resembles a
token (the resolved URLs are `registry.npmjs.org` and carry none, but look
rather than assume), commit both files, push a branch, open the pull request
and let auto-merge take it when the checks pass. Merging is what deploys —
the `Deploy` workflow runs on the push to `main`; confirm it with
`gh run list --workflow deploy.yml` in that repository.

A site whose `npm install` changes nothing did not get a new version: go back
to step 7 for that dataset rather than assuming it published.

### 9. Record the site commits in this repository

`.new-architecture/` tracks every platform repository as a submodule, so this
repository records which commit of each website goes with the data it shipped.
The pointers do not move on their own — an upstream merge is invisible to
`git status` until you refresh — so after the seven site pull requests merge:

```bash
git submodule update --remote .new-architecture
git add .new-architecture
```

Commit the bump on its own branch and merge it through a pull request like
anything else. Its diff is the review: seven gitlinks, each moving to the
commit that pinned the new data.

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
| `ship` | Yes, **destructive** | Rebuilds the remote app layer (`db:wipe` → `migrate` → `db:seed` → `permission:sync` → restore/recreate users), then loads `staging-mysql`'s content tables (dumped and restored directly on the remote host) and pushes the already-staged images. Requires `stage` (+ `staging-glossary-sync`) to have populated the staging volumes. Requires `CONFIRM_WIPE`. |
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
the whole of step 3. Step 8 needs the SSH key instead, and nothing else does.
Steps 9 to 11 need neither — only your own npm login on the host (`npm login`,
once per machine — see step 9) and `gh` logged in. **Windows** — set
`$env:HOME = $env:USERPROFILE` in every new shell before step 9's first
`docker compose run exporter ... --publish`, or the container's mount of your
npm session is silently empty.

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

# OPTIONAL — start the dataset over. Mandatory after an aborted or doubled run:
# the importer skips rows that already exist, so a half-finished import
# otherwise stays half-finished forever.
docker compose run --rm staging-migrate php artisan migrate:fresh --force

# ── 3. STAGE (~1h40m) ────────────────────────────────────────────────────────
# Detached and named on purpose: an attached run dies with its terminal.
docker compose --env-file scripts/import-tool/.env --profile import run -d --name inventory-import-stage stage

# Follow it. Ends with: Mode 'stage' completed successfully
# Expect ~141,000 rows imported and ~380 per-row errors — that is this dataset.
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
# rows_ minus unsynced MUST equal the file count. If it does not, back to 4.
docker run --rm -v inventory-staging-images:/data alpine sh -c "ls -1 /data | wc -l"
docker compose exec -T staging-mysql mysql -u inventory -psecret -N -e "SELECT (SELECT COUNT(*) FROM inventory.item_images)+(SELECT COUNT(*) FROM inventory.collection_images)+(SELECT COUNT(*) FROM inventory.partner_images)+(SELECT COUNT(*) FROM inventory.partner_logos)+(SELECT COUNT(*) FROM inventory.contributor_images)+(SELECT COUNT(*) FROM inventory.timeline_event_images) AS rows_, (SELECT COUNT(*) FROM inventory.item_images WHERE size=1)+(SELECT COUNT(*) FROM inventory.collection_images WHERE size=1)+(SELECT COUNT(*) FROM inventory.partner_images WHERE size=1)+(SELECT COUNT(*) FROM inventory.partner_logos WHERE size=1) AS unsynced;"

# ── 6. GLOSSARY LINKS (required before ship) ─────────────────────────────────
docker compose run --rm staging-glossary-sync

# ── 7. REVIEW LOCALLY ────────────────────────────────────────────────────────
# Gives you a login for http://localhost:8020/admin — admin@example.com / password
docker compose run --rm staging-seed-auth

# OPTIONAL — regenerate the website data packages from the staged copy, without
# publishing them. There are seven datasets, one per website; listing only some
# of them leaves the rest on the previous import.
docker compose run --rm exporter islamicart --force
docker compose run --rm exporter baroqueart --force
docker compose run --rm exporter sharinghistory --force
docker compose run --rm exporter amulets --force
docker compose run --rm exporter carpets --force
docker compose run --rm exporter the-use-of-colours-in-art --force
docker compose run --rm exporter water-in-islam --force

# ── 8. SHIP — DESTRUCTIVE, REBUILDS THE DEPLOYED APP ─────────────────────────
# Snapshot the deployed users/roles/permissions first, so ship's auth-restore
# has something real to restore instead of falling back to two accounts.
docker compose --env-file scripts/import-tool/.env --profile import run --rm backup-permissions

$env:CONFIRM_WIPE = 'yes-really-wipe-production'
docker compose --env-file scripts/import-tool/.env --profile import run --build --rm ship

# ── 9. PUBLISH THE DATA PACKAGES ─────────────────────────────────────────────
# Shipping updates the application; the websites read published npm packages
# and step 8 does not touch them. `--publish` exports AND publishes, so these
# replace step 7's export commands rather than following them. Seven datasets:
# run the block below once per value of $dataset, in any order.
#
# PowerShell does not export $HOME to child processes, so ${HOME} in
# compose.yml — which mounts your npm session read-only into the exporter
# container — resolves to nothing unless you set this first, in EVERY new
# shell:
$env:HOME = $env:USERPROFILE

# One-time per machine: authenticate ON THE HOST (never inside the
# container). This writes a session token to your host ~/.npmrc; nothing in
# this repo ever writes to that file, and no token reaches a tracked file.
npm login

$dataset = 'islamicart'     # then: baroqueart, sharinghistory, amulets, carpets, the-use-of-colours-in-art, water-in-islam

# What the registry holds now. No credential needed — @museumwnf packages
# are public.
docker compose --profile tools run --rm --no-deps -w /var/www/app tools npm view "@museumwnf/$dataset-data" version

# Export from staging and publish the next patch. Auto-increments by asking
# the registry first and using it whenever it is ahead of the gitignored,
# per-worktree counter in output/.version-<dataset> — pass
# --package-version <next> instead only for a minor/major bump, or when the
# registry cannot be reached. Ends with: ✓ Published: @museumwnf/<dataset>-data@<next>
docker compose run --rm exporter $dataset --force --publish

# Confirm before moving on. Must print a version newer than the one above; if
# it still prints the same one, the publish did not happen and the website
# will not see anything either.
docker compose --profile tools run --rm --no-deps -w /var/www/app tools npm view "@museumwnf/$dataset-data" version

# ── 10. PIN THE NEW VERSION IN EACH WEBSITE ──────────────────────────────────
# Publishing changes nothing that is live. Each website is its own repository
# and pins its data package in package.json (^range) AND package-lock.json
# (exact); the deploy runs `npm ci`, so the lockfile is what visitors see.
# Nobody moves it for you automatically: every site's dependabot.yml
# deliberately ignores the @museumwnf scope — not because it cannot
# authenticate (the packages are public on npmjs) but because moving this
# pin is meant to stay a human, operator-driven step — and main is PR-only
# on all seven. Run the block below once per site, from a directory where
# you keep site clones.
$site = 'islamicart'        # then: baroqueart, sharinghistory, amulets, carpets, the-use-of-colours-in-art, water-in-islam
$next = '<the version step 9 published for this site>'

# OPTIONAL — first time on this machine only.
gh repo clone "museumwithnofrontiers/$site"

Set-Location $site
git checkout main
git pull --ff-only
git checkout -B "chore/data-$next"

# Rewrites the range and the lockfile together. If `git diff --stat` shows
# nothing, no newer version exists: back to step 9 for this dataset.
npm install "@museumwnf/$site-data@^$next"
git diff --stat

# The site's own checks, before CI repeats them.
npm test -- --run

# Belt and braces: resolved URLs are registry.npmjs.org and carry no
# credential, but look.
git diff package-lock.json | Select-String -Pattern '_authToken|ghp_|github_pat'

git add package.json package-lock.json
git commit -m "chore: data package $next"
git push -u origin "chore/data-$next"
gh pr create --fill
gh pr merge --squash --delete-branch --auto

# Merging is what deploys: the Deploy workflow runs on the push to main.
# Wait for MERGED, then for the deploy to finish.
gh pr view "chore/data-$next" --json state --jq .state
gh run list --workflow deploy.yml --limit 1
Set-Location ..

# ── 11. RECORD THE SITE COMMITS HERE ─────────────────────────────────────────
# .new-architecture/ tracks every platform repository as a submodule, so this
# repository records which commit of each website goes with the data it
# shipped. Upstream merges are invisible to `git status` until you refresh.
# Back at the inventory-app repo root, after all seven site PRs have merged:
git checkout main
git pull --ff-only
git checkout -B chore/new-architecture-pointers
git submodule update --remote .new-architecture
git add .new-architecture

# Expect seven gitlinks moving (plus any platform package released meanwhile).
git diff --cached --stat

git commit -m "chore: bump .new-architecture pointers after the re-import"
git push -u origin chore/new-architecture-pointers
gh pr create --fill
gh pr merge --squash --delete-branch --auto
```
