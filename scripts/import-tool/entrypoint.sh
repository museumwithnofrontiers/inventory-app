#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Entrypoint for the inventory-app legacy import tool container.
#
# The import is two-phase, and the phases never overlap: `stage` reads legacy
# and writes only locally; `ship` reads only that local copy and writes to OVH.
# Nothing here goes from legacy straight to production.
#
# Modes (first arg or $IMPORT_MODE — no default, one must be given):
#   backup-permissions  snapshot users/MFA/roles/permissions to a fixed OVH
#                       path + a redundant local copy. No import, no writes
#                       to application data.
#   stage               import -> image-sync, writing straight to DB_HOST
#                       (the compose "staging-mysql" service). No SSH, no OVH
#                       contact at all — builds a fully-populated local copy
#                       (DB + staged images) at local-network speed.
#   ship                Ships an already-built `stage` copy to OVH:
#                       db:wipe -> migrate -> seed -> permission:sync ->
#                       auth:restore/fallback rebuilds the app layer (users,
#                       roles, permissions, tokens) fresh on OVH itself,
#                       NEVER read from staging-mysql. Then staging-mysql's
#                       CONTENT tables only (legacy import data — explicitly
#                       excluding users/roles/permissions/tokens/sessions/
#                       etc., see SHIP_EXCLUDED_TABLES below) are copied to
#                       OVH and loaded there against OVH's own local MySQL
#                       (see load_staged_dump), then the already-staged
#                       images are pushed to the private originals directory
#                       and the public pictures cache is emptied (see
#                       push_staged_images). Does NOT resync the glossary on
#                       OVH — run the `staging-glossary-sync` compose service
#                       against staging-mysql before `ship` instead, so the
#                       item/collection/timeline_event <-> glossary link rows
#                       are already part of the dump (see README.md).
#                       DESTRUCTIVE. Requires
#                       CONFIRM_WIPE=yes-really-wipe-production, and a `stage`
#                       run to have already populated staging-mysql and the
#                       staging images volume. Restores from a snapshot at
#                       $AUTH_SNAPSHOT_REMOTE if one exists (run
#                       backup-permissions first to create it); if none exists
#                       AND both ADMIN_EMAIL and REGULAR_USER_EMAIL are set,
#                       falls back to recreating just those two accounts
#                       instead. If neither applies, aborts before anything is
#                       lost beyond the wipe itself.
#
# See README.md for the full list of required env vars and mounts.
# ==============================================================================

IMPORTER_DIR=/opt/import-tool/importer

MODE="${1:-${IMPORT_MODE:-}}"

# Only backup-permissions/ship touch OVH — stage writes straight to a local
# DB_HOST and never dials out (and isn't even given an SSH key to dial with),
# so OVH_HOST has no reason to be required for it. Checked explicitly per-mode
# in the dispatch at the bottom instead of unconditionally here.
OVH_HOST="${OVH_HOST:-}"
require_ovh_host() { [ -n "$OVH_HOST" ] || die "OVH_HOST is required for mode '$MODE'"; }
OVH_USER="${OVH_USER:-deploy}"
OVH_APP_DIR="${OVH_APP_DIR:-/opt/inventory/current}"
OVH_SHARED_DIR="${OVH_SHARED_DIR:-/opt/inventory/shared}"
OVH_SSH_KEY_PATH="${OVH_SSH_KEY_PATH:-/run/secrets/deploy_key}"

STAGING_DIR="${IMAGE_STAGING_DIR:-/staging/images}"

# `ship`-only: the LOCAL source DB built by a prior `stage` run. `ship` never
# connects to OVH's database itself — it hands the dump over and lets OVH load
# it locally (see load_staged_dump) — so these are the only DB_* values it
# reads. DB_* proper is `stage`'s target and means nothing here.
LOCAL_DB_HOST="${LOCAL_DB_HOST:-staging-mysql}"
LOCAL_DB_PORT="${LOCAL_DB_PORT:-3306}"
LOCAL_DB_USERNAME="${LOCAL_DB_USERNAME:-inventory}"
LOCAL_DB_PASSWORD="${LOCAL_DB_PASSWORD:-secret}"
LOCAL_DB_DATABASE="${LOCAL_DB_DATABASE:-inventory}"

# Tables NEVER included in a `ship` data load — every table that stores app
# identity/auth/session/queue/config state rather than imported legacy
# content. `stage`'s staging-mysql never has real data in any of these (no
# seeders run there — see do_stage), so loading them wholesale onto OVH would
# blank out its real users, roles, permission assignments, API tokens, and
# settings. The real app-layer state is instead always (re)built directly on
# OVH by do_wipe_and_restore, using OVH's own APP_KEY — never read from the
# local build. Reviewed against every migration that creates a users/auth/
# session/queue/settings table as of this writing; mysqldump --ignore-table is
# a no-op (not an error) for any of these that don't exist in a given schema
# version, so this list is safe to keep ahead of what's actually deployed.
SHIP_EXCLUDED_TABLES=(
  users password_reset_tokens sessions
  cache cache_locks
  jobs job_batches failed_jobs
  personal_access_tokens email_two_factor_codes
  permissions roles model_has_permissions model_has_roles role_has_permissions
  migrations settings
)

AUTH_SNAPSHOT_REMOTE="${AUTH_SNAPSHOT_REMOTE:-${OVH_SHARED_DIR}/auth-snapshots/current.json.enc}"
AUTH_SNAPSHOT_LOCAL_BACKUP_DIR="${AUTH_SNAPSHOT_LOCAL_BACKUP_DIR:-/backup}"

# ship-mode fallback, only used when no snapshot exists at AUTH_SNAPSHOT_REMOTE
# (see do_wipe_and_restore). Both must be set for the fallback to engage — if
# only one is set, or neither, ship fails with no snapshot rather than
# partially creating accounts.
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
REGULAR_USER_EMAIL="${REGULAR_USER_EMAIL:-}"

DRY_RUN="${DRY_RUN:-0}"

SSH_KEY=""

log() { printf '[import-tool] %s %s\n' "$(date -u +%FT%TZ)" "$*" >&2; }
die() {
  log "FATAL: $*"
  exit 1
}

# ------------------------------------------------------------------------------
# SSH key handling — bind-mounted files from a Windows host often arrive with
# permissive perms that OpenSSH refuses to use. Copy to a private, container-
# local path and lock it down before first use.
# ------------------------------------------------------------------------------
prepare_ssh_key() {
  [ -f "$OVH_SSH_KEY_PATH" ] \
    || die "SSH key not found at $OVH_SSH_KEY_PATH (mount it with -v <host-key>:$OVH_SSH_KEY_PATH:ro)"
  SSH_KEY=/tmp/deploy_key
  cp "$OVH_SSH_KEY_PATH" "$SSH_KEY"
  chmod 600 "$SSH_KEY"
}

SSH_OPTS_BASE=(-o StrictHostKeyChecking=accept-new -o BatchMode=yes -o ConnectTimeout=10)

# Blocking remote command. Fails the whole pipeline immediately on a non-zero
# exit — replaces the old script's fire-and-forget Start-Process calls, which
# had no ordering or completion guarantee at all.
ssh_run() {
  local cmd="$1"
  log "SSH: $cmd"
  ssh "${SSH_OPTS_BASE[@]}" -i "$SSH_KEY" "${OVH_USER}@${OVH_HOST}" \
    "cd '$OVH_APP_DIR' && $cmd" \
    || die "remote command failed: $cmd"
}

# Absolute path of one of the app's image directories on OVH (`available`:
# the private originals; `pictures`: the public cache of burned renditions),
# asked of the deployed app itself so a push always lands where its config
# reads from. Validated before use: the callers rsync --delete into these and
# empty them, so a surprising answer must stop the pipeline, not be acted on.
remote_image_path() {
  local type="$1" out path
  out="$(ssh "${SSH_OPTS_BASE[@]}" -i "$SSH_KEY" "${OVH_USER}@${OVH_HOST}" \
    "cd '$OVH_APP_DIR' && php artisan storage:image-path $type")" \
    || die "could not resolve the '$type' image directory on OVH"
  path="$(printf '%s\n' "$out" | tail -n 1 | tr -d '\r')"
  case "$path" in
    /*/storage/app/?*) ;;
    *) die "unexpected '$type' image directory from OVH: '$path'" ;;
  esac
  printf '%s\n' "$path"
}

# ------------------------------------------------------------------------------
# Importer steps — `stage` only. They run in this container against
# DB_HOST/DB_PORT, which compose points at staging-mysql.
# ------------------------------------------------------------------------------
# The importer's `import` command exits 1 whenever totals.errors > 0 (see
# src/cli/import.ts) — which this legacy dataset always has some of:
# individual rows with genuinely bad/missing legacy data, already tracked and
# summarized as warnings/errors in the run's own output, not a sign the whole
# run failed. image-sync still needs to run against whatever WAS imported
# rather than the whole stage aborting over a handful of known,
# already-summarized per-row failures — this used to die() here, which
# silently skipped image-sync on every real run (confirmed: the run that
# produced "135343 imported ... 385 errors" never reached it, because this
# function killed the container right after the import summary printed).
run_importer_import() {
  local extra_args=()
  [ "$DRY_RUN" = "1" ] && extra_args+=(--dry-run)

  log "Running importer: import ${extra_args[*]}"
  local rc=0
  (cd "$IMPORTER_DIR" && npx tsx src/cli/import.ts import "${extra_args[@]}") || rc=$?
  if [ "$rc" -ne 0 ]; then
    log "NOTE: importer 'import' exited non-zero (rc=$rc) — see the run's own summary above for the error count. Continuing to image-sync regardless; this is expected for this dataset, not treated as fatal."
  fi
  return 0
}

run_image_sync() {
  local extra_args=()
  [ "$DRY_RUN" = "1" ] && extra_args+=(--dry-run)

  log "Running importer: image-sync --copy --target-dir $STAGING_DIR ${extra_args[*]}"
  mkdir -p "$STAGING_DIR"
  local rc=0
  (cd "$IMPORTER_DIR" && npx tsx src/cli/import.ts image-sync --copy --target-dir "$STAGING_DIR" "${extra_args[@]}") || rc=$?
  if [ "$rc" -ne 0 ]; then
    # Same reasoning as run_importer_import: image-sync exits 1 whenever any
    # file failed (e.g. "Legacy image not found" — broken links already
    # present in the legacy image tree itself, not something this container
    # can fix). Not treated as fatal here; the run's own summary above
    # already lists exactly what's missing.
    log "NOTE: image-sync exited non-zero (rc=$rc) — see the run's own summary above for what's missing. Not treated as fatal in stage mode."
  fi
  return 0
}

# ------------------------------------------------------------------------------
# Mode implementations
# ------------------------------------------------------------------------------

# True if a snapshot file already exists on the OVH host. Checked with a
# plain remote `test -f` rather than parsing auth:restore's error text —
# more robust, and lets us distinguish "no snapshot, fall back" from any
# OTHER auth:restore failure (wrong APP_KEY, missing roles, etc.), which
# should still abort the pipeline hard rather than silently paper over it.
snapshot_exists() {
  ssh "${SSH_OPTS_BASE[@]}" -i "$SSH_KEY" "${OVH_USER}@${OVH_HOST}" \
    "test -f '$AUTH_SNAPSHOT_REMOTE'"
}

# Recreates exactly two accounts (one "Manager of Users" admin, one
# "Regular User") when no snapshot exists to restore instead. Requires
# ADMIN_EMAIL/REGULAR_USER_EMAIL — never invented or defaulted. user:create
# does not set a plaintext password; it emails a password-reset invitation
# to that address.
create_fallback_accounts() {
  log "No snapshot to restore — recreating fallback accounts for ADMIN_EMAIL and REGULAR_USER_EMAIL instead"
  ssh_run "php artisan user:create '$ADMIN_EMAIL' '$ADMIN_EMAIL'"
  ssh_run "php artisan user:email-verification '$ADMIN_EMAIL' verify"
  ssh_run "php artisan user:assign-role '$ADMIN_EMAIL' 'Manager of Users'"
  ssh_run "php artisan user:create '$REGULAR_USER_EMAIL' '$REGULAR_USER_EMAIL'"
  ssh_run "php artisan user:email-verification '$REGULAR_USER_EMAIL' verify"
  ssh_run "php artisan user:assign-role '$REGULAR_USER_EMAIL' 'Regular User'"
  log "Fallback accounts created — check $ADMIN_EMAIL and $REGULAR_USER_EMAIL for password-reset emails"
}

do_wipe_and_restore() {
  [ "${CONFIRM_WIPE:-}" = "yes-really-wipe-production" ] \
    || die "ship mode requires CONFIRM_WIPE=yes-really-wipe-production — refusing to wipe the database"

  prepare_ssh_key
  ssh_run "php artisan db:wipe --force"
  ssh_run "php artisan migrate --force"
  ssh_run "php artisan optimize:clear"
  ssh_run "php artisan db:seed --class=MinimalDatabaseSeeder --force"
  ssh_run "php artisan permission:sync"

  if snapshot_exists; then
    ssh_run "php artisan auth:restore '$AUTH_SNAPSHOT_REMOTE' --force"
  elif [ -n "$ADMIN_EMAIL" ] && [ -n "$REGULAR_USER_EMAIL" ]; then
    create_fallback_accounts
  else
    die "no snapshot at $AUTH_SNAPSHOT_REMOTE and ADMIN_EMAIL/REGULAR_USER_EMAIL not both set — nothing to restore and no fallback configured. Run backup-permissions first, or set both in .env to allow account recreation as a fallback."
  fi
}

do_stage() {
  log "Stage mode: writing straight to DB_HOST=${DB_HOST:-<unset>} — no SSH, no OVH contact"
  run_importer_import
  run_image_sync
}

# Dumps LOCAL_DB_* (staging-mysql, built by a prior `stage` run), excluding
# every table in SHIP_EXCLUDED_TABLES, copies the dump to OVH, and loads it
# there against OVH's own local MySQL (DB_HOST=127.0.0.1 from OVH's own point
# of view — same host) using OVH's own `mysql` client.
#
# This is the entire point of `stage`/`ship`: avoid the thousands of small
# round-trips over the network that made the old direct-to-OVH import take
# hours. An earlier version of this function instead opened an SSH tunnel
# and loaded the dump *from here*, statement by statement, over that tunnel —
# reintroducing exactly that cost one level down (confirmed in practice: over
# an hour in, nowhere near done, for ~328k single-row statements). Copying
# the file over and running the load on OVH itself makes it local-loopback
# I/O instead of WAN round-trips per statement.
#
# This also sidesteps the reason this tool avoids piping mysqldump straight
# into its own `mysql` CLI everywhere else: that CLI is Alpine's MariaDB
# client, which can't authenticate to a modern MySQL 8 server's default
# caching_sha2_password plugin at all (confirmed: "Plugin caching_sha2_password
# could not be loaded"). That limitation is specific to this container's
# client dialing in from outside — OVH's own `mysql` client is a real, modern
# MySQL client matching its own server, with no such problem, because it's
# not a different implementation and it's not Alpine.
load_staged_dump() {
  local ignore_flags=()
  local t
  for t in "${SHIP_EXCLUDED_TABLES[@]}"; do
    ignore_flags+=(--ignore-table="${LOCAL_DB_DATABASE}.${t}")
  done

  local dump_file="/tmp/staged-dump.sql"
  log "Dumping staging-mysql (excluding: ${SHIP_EXCLUDED_TABLES[*]}) to $dump_file"
  # --skip-extended-insert: one row per INSERT statement instead of mysqldump's
  # default bulk multi-row INSERTs, so no single statement can ever exceed
  # OVH's max_allowed_packet regardless of table size or how it's configured.
  # The load runs locally on OVH (see below), so the extra statement count
  # costs essentially nothing — each is local-loopback I/O, not a network
  # round-trip.
  # --no-create-info: data only, no DROP TABLE/CREATE TABLE. Structure is
  # already authoritative on OVH from do_wipe_and_restore's `migrate --force`
  # moments ago — dumping CREATE TABLE too fights it (confirmed in practice:
  # "Table 'artist_item' already exists" loading the dump, since migrate had
  # already created every table before this ever runs).
  mysqldump -h "$LOCAL_DB_HOST" -P "$LOCAL_DB_PORT" -u "$LOCAL_DB_USERNAME" -p"$LOCAL_DB_PASSWORD" --ssl=0 \
    --single-transaction --routines --no-tablespaces --skip-extended-insert --no-create-info \
    "${ignore_flags[@]}" "$LOCAL_DB_DATABASE" \
    > "$dump_file" \
    || die "dumping staging-mysql failed"

  local remote_dump="${OVH_SHARED_DIR}/staged-dump.sql"
  log "Copying $dump_file to ${OVH_HOST}:${remote_dump}"
  scp "${SSH_OPTS_BASE[@]}" -i "$SSH_KEY" "$dump_file" "${OVH_USER}@${OVH_HOST}:${remote_dump}" \
    || die "copying staged dump to OVH failed"
  rm -f "$dump_file"

  log "Loading ${remote_dump} into OVH's local MySQL (127.0.0.1:3306)"
  # DB_PASSWORD is read from OVH's own .env, not passed from here — it's
  # already the correct credential for OVH's own database, and this avoids
  # ever putting our copy of it on the wire or in a remote command's argv.
  # Assumes an unquoted value in .env (true today; every credential in this
  # pipeline is a generated token with no spaces).
  ssh "${SSH_OPTS_BASE[@]}" -i "$SSH_KEY" "${OVH_USER}@${OVH_HOST}" bash -s <<REMOTE_SCRIPT \
    || die "loading staged dump on OVH failed"
set -euo pipefail
cd '$OVH_APP_DIR'
DB_PASS=\$(grep -m1 '^DB_PASSWORD=' .env | cut -d= -f2-)
MYSQL_PWD="\$DB_PASS" mysql -h 127.0.0.1 -P 3306 -u inventory inventory < '$remote_dump'
rm -f '$remote_dump'
REMOTE_SCRIPT
}

# Where `ship` puts the images, asked of OVH and checked BEFORE the wipe, so a
# surprising configuration aborts while production is still intact rather than
# after its database is gone. Sets ORIGINALS_DIR and PICTURES_DIR.
ORIGINALS_DIR=""
PICTURES_DIR=""
resolve_image_destinations() {
  ORIGINALS_DIR="$(remote_image_path available)"
  PICTURES_DIR="$(remote_image_path pictures)"
  case "$ORIGINALS_DIR/" in
    "$PICTURES_DIR"/*) die "originals ($ORIGINALS_DIR) resolve inside the pictures cache ($PICTURES_DIR) — refusing to ship" ;;
  esac
  case "$PICTURES_DIR/" in
    "$ORIGINALS_DIR"/*) die "the pictures cache ($PICTURES_DIR) resolves inside the originals ($ORIGINALS_DIR) — refusing to ship" ;;
  esac
  log "Originals go to ${OVH_HOST}:${ORIGINALS_DIR}; the pictures cache at ${PICTURES_DIR} will be emptied"
}

# Pushes images already staged by a prior `stage` run (the staging images
# volume, mounted read-only at $STAGING_DIR) to OVH. The importer's image-sync
# step is never re-run here — and cannot be, since `ship` has no legacy mount.
#
# Staged files are pristine originals, so they go where the app keeps
# originals (`storage:image-path available` — the private image-originals disk),
# never into the public pictures directory: that is only the cache `/pub` fills
# with burned renditions on demand. Pushing there left every image without an
# original to burn from (#1984).
#
# --delete is always correct here: do_wipe_and_restore already wiped OVH
# (available_images included), so whatever is in $STAGING_DIR is the full,
# authoritative set of originals.
push_staged_images() {
  if [ "$DRY_RUN" = "1" ]; then
    log "DRY_RUN=1 — skipping rsync push to OVH"
    return 0
  fi

  local originals_dir="$ORIGINALS_DIR" pictures_dir="$PICTURES_DIR"
  [ -n "$originals_dir" ] && [ -n "$pictures_dir" ] \
    || die "image destinations were not resolved before the push (resolve_image_destinations)"

  # rsync creates only the last path component, and a server that never held
  # an original has none of the private disk's parents yet.
  ssh_run "mkdir -p '$originals_dir'"

  # Ownership comes from the receiving side (deploy, and the www-data group of
  # the setgid storage tree), and group read/write is granted explicitly:
  # PHP-FPM and the queue (www-data) read originals to burn and delete them,
  # while deploy pushes and backfills.
  log "rsync -az --stats --delete --no-owner --no-group --chmod=D2775,F664 $STAGING_DIR/ -> ${OVH_HOST}:${originals_dir}/"
  rsync -az --stats --delete --no-owner --no-group --chmod=D2775,F664 \
    -e "ssh ${SSH_OPTS_BASE[*]} -i $SSH_KEY" \
    "$STAGING_DIR"/ \
    "${OVH_USER}@${OVH_HOST}:${originals_dir}/" \
    || die "rsync push failed"

  # Every cached rendition belongs to the database that was just wiped, and
  # ships from before the private disk left unburned originals in there.
  # Empty the cache; `/pub` regenerates each image on its next request.
  ssh_run "if [ -d '$pictures_dir' ]; then find '$pictures_dir' -mindepth 1 -delete; fi"
}

# Ships an already-built `stage` copy to OVH. The app layer (users, roles,
# permissions, tokens) is always rebuilt fresh on OVH itself by
# do_wipe_and_restore: real users/roles come from OVH's own snapshot (or the
# fallback accounts), never from staging-mysql, which has none of it — see
# do_stage. Only the CONTENT tables (the actual imported legacy data) come
# from the local build.
#
# No glossary resync on OVH: the `staging-glossary-sync` compose service (run
# against staging-mysql, after `stage` and before `ship`) already computed
# item_translation_spelling/collection_translation_spelling/
# timeline_event_translation_spelling as plain data rows, so load_staged_dump's
# dump already carries them — nothing left to trigger on OVH. Dispatching a
# resync here would just make inventory-queue.service redo the exact same work
# a second time.
do_ship() {
  prepare_ssh_key
  resolve_image_destinations

  do_wipe_and_restore

  # No tunnel here: load_staged_dump copies the dump to OVH and loads it
  # there directly against its own local MySQL — see load_staged_dump for why.
  # do_wipe_and_restore already called prepare_ssh_key.
  load_staged_dump

  push_staged_images
}

do_backup_permissions() {
  prepare_ssh_key
  mkdir -p "$AUTH_SNAPSHOT_LOCAL_BACKUP_DIR"
  local ts
  ts="$(date -u +%Y%m%dT%H%M%SZ)"

  ssh_run "php artisan auth:snapshot '$AUTH_SNAPSHOT_REMOTE' --force"

  local local_copy="${AUTH_SNAPSHOT_LOCAL_BACKUP_DIR}/auth-snapshot-${ts}.json.enc"
  log "Pulling redundant local copy to $local_copy"
  scp "${SSH_OPTS_BASE[@]}" -i "$SSH_KEY" \
    "${OVH_USER}@${OVH_HOST}:${AUTH_SNAPSHOT_REMOTE}" \
    "$local_copy" \
    || die "failed to pull local backup copy of snapshot"
}

# ------------------------------------------------------------------------------
# Dispatch
# ------------------------------------------------------------------------------
case "$MODE" in
backup-permissions)
  require_ovh_host
  do_backup_permissions
  ;;
stage)
  do_stage
  ;;
ship)
  require_ovh_host
  [ "${CONFIRM_WIPE:-}" = "yes-really-wipe-production" ] \
    || die "ship mode requires CONFIRM_WIPE=yes-really-wipe-production — refusing to wipe the database"
  do_ship
  ;;
"")
  die "no mode given (expected one of: backup-permissions | stage | ship). Run a compose service from the import profile rather than this script directly — see scripts/import-tool/README.md."
  ;;
*)
  die "unknown mode '$MODE' (expected: backup-permissions | stage | ship)"
  ;;
esac

log "Mode '$MODE' completed successfully"
