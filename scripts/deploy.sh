#!/usr/bin/env bash
#
# deploy.sh — Deploy a pre-built inventory-app release to the OVH VPS
#
# Usage (run as 'deploy' user):
#   bash deploy.sh /tmp/inventory-release.tar.gz
#
# The archive is built by CI (build.yml) and contains the full application
# with production vendor/ and compiled public/build/ assets.
# No git, composer, npm, or sudo is required.
#
# Prerequisites (handled by provision.sh, run once as root):
#   - PHP-FPM, Nginx, MySQL, Valkey installed (via motivya provision.sh)
#   - /opt/inventory/ owned by deploy:www-data
#   - /opt/inventory/shared/storage/ directory tree exists
#   - Nginx vhost pointing to /opt/inventory/current/public
#   - MySQL credentials in /home/deploy/.inventory-db-credentials
#   - inventory-queue.service systemd unit installed
#
# This script is idempotent — safe to re-run.
# This script uses NO sudo — all operations are within /opt/inventory/.
#
set -euo pipefail

# --- Configuration -----------------------------------------------------------
# PHP itself is provisioned separately (see provision.sh's PHP_VERSION) — this
# script only unpacks a release tarball and never selects a PHP version.
APP_DIR="/opt/inventory"
CURRENT="${APP_DIR}/current"

# --- Arguments ---------------------------------------------------------------
ARCHIVE="${1:-}"
[[ -z "$ARCHIVE" ]] && { echo "[DEPLOY] ERROR: Usage: deploy.sh <archive.tar.gz>"; exit 1; }
[[ ! -f "$ARCHIVE" ]] && { echo "[DEPLOY] ERROR: Archive not found: ${ARCHIVE}"; exit 1; }

# --- Colors -------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn()  { echo -e "${YELLOW}[DEPLOY]${NC} $1"; }
error() { echo -e "${RED}[DEPLOY]${NC} $1"; exit 1; }

# --- Pre-flight checks -------------------------------------------------------
preflight() {
    # Verify we are NOT root
    [[ $EUID -eq 0 ]] && error "This script must NOT be run as root. Run as '$(whoami)' or the deploy user."

    # Verify PHP is available
    command -v php &>/dev/null || error "PHP not found. Run provision.sh first (as root)."

    # Verify tar is available
    command -v tar &>/dev/null || error "tar not found."

    # Verify app directory is writable
    [[ -w "$APP_DIR" ]] || error "${APP_DIR} is not writable. Run provision.sh first."

    # Verify shared storage exists
    [[ -d "${APP_DIR}/shared/storage" ]] || error "${APP_DIR}/shared/storage missing. Run provision.sh first."
}

# --- 1. Extract release -------------------------------------------------------
deploy_release() {
    local RELEASE_DIR="${APP_DIR}/releases/$(date +%Y%m%d%H%M%S)"
    mkdir -p "$RELEASE_DIR"

    info "Extracting release to ${RELEASE_DIR}..."
    tar xzf "$ARCHIVE" -C "$RELEASE_DIR"

    if [[ ! -f "${RELEASE_DIR}/.env.example" ]]; then
        error ".env.example was not found at release root. Build artifact format is invalid."
    fi

    # Symlink shared storage into the release
    rm -rf "${RELEASE_DIR}/storage"
    ln -sfn "${APP_DIR}/shared/storage" "${RELEASE_DIR}/storage"

    # Ensure bootstrap/cache exists and is writable by www-data (PHP-FPM)
    mkdir -p "${RELEASE_DIR}/bootstrap/cache"
    chgrp www-data "${RELEASE_DIR}/bootstrap/cache" 2>/dev/null || true
    chmod g+w "${RELEASE_DIR}/bootstrap/cache"

    # If provisioning created CURRENT as a real directory, replace it.
    if [[ -d "${CURRENT}" && ! -L "${CURRENT}" ]]; then
        rm -rf "${CURRENT}"
    fi

    # Swap the current symlink atomically
    ln -sfn "$RELEASE_DIR" "${CURRENT}"

    info "Release deployed: ${RELEASE_DIR}"
}

# --- 2. Configure Laravel (first deploy) -------------------------------------
configure_laravel() {
    cd "$CURRENT"

    if [[ ! -f "${APP_DIR}/shared/.env" ]]; then
        info "First deploy — creating .env from .env.example..."
        cp .env.example "${APP_DIR}/shared/.env"

        # Production defaults
        sed -i 's/^APP_ENV=.*/APP_ENV=production/' "${APP_DIR}/shared/.env"
        sed -i 's/^APP_DEBUG=.*/APP_DEBUG=false/' "${APP_DIR}/shared/.env"
        sed -i 's|^APP_URL=.*|APP_URL=https://inventory.metanull.eu|' "${APP_DIR}/shared/.env"

        # MySQL (if credentials file exists, written by provision.sh)
        DEPLOY_CRED_FILE="/home/deploy/.inventory-db-credentials"
        if [[ -f "$DEPLOY_CRED_FILE" ]]; then
            source "$DEPLOY_CRED_FILE"
            info "Configuring MySQL from credentials file..."
            sed -i 's/^DB_CONNECTION=.*/DB_CONNECTION=mysql/' "${APP_DIR}/shared/.env"
            sed -i "s/^DB_HOST=.*/DB_HOST=127.0.0.1/" "${APP_DIR}/shared/.env"
            sed -i "s/^DB_PORT=.*/DB_PORT=3306/" "${APP_DIR}/shared/.env"
            sed -i "s/^DB_DATABASE=.*/DB_DATABASE=${DB_NAME}/" "${APP_DIR}/shared/.env"
            sed -i "s/^DB_USERNAME=.*/DB_USERNAME=${DB_USER}/" "${APP_DIR}/shared/.env"
            sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=${DB_PASSWORD}/" "${APP_DIR}/shared/.env"
        else
            warn "No MySQL credentials found at ${DEPLOY_CRED_FILE} — keeping defaults from .env.example."
        fi

        # Redis/Valkey — use DB 2 and 3 to avoid collision with Motivya (DB 0 and 1)
        if command -v valkey-cli &>/dev/null || command -v redis-cli &>/dev/null; then
            info "Configuring Redis/Valkey for cache, sessions, and queues (DB 2/3)..."
            sed -i 's/^CACHE_STORE=.*/CACHE_STORE=redis/' "${APP_DIR}/shared/.env"
            sed -i 's/^SESSION_DRIVER=.*/SESSION_DRIVER=redis/' "${APP_DIR}/shared/.env"
            sed -i 's/^QUEUE_CONNECTION=.*/QUEUE_CONNECTION=redis/' "${APP_DIR}/shared/.env"
            # Append Redis DB isolation settings
            echo '' >> "${APP_DIR}/shared/.env"
            echo '# Redis DB isolation (Motivya uses DB 0/1)' >> "${APP_DIR}/shared/.env"
            echo 'REDIS_HOST=127.0.0.1' >> "${APP_DIR}/shared/.env"
            echo 'REDIS_PORT=6379' >> "${APP_DIR}/shared/.env"
            echo 'REDIS_DB=2' >> "${APP_DIR}/shared/.env"
            echo 'REDIS_CACHE_DB=3' >> "${APP_DIR}/shared/.env"
        fi

        warn "First deploy .env created — review ${APP_DIR}/shared/.env before going live."
    fi

    # Symlink .env (must happen before key:generate or artisan commands)
    ln -sfn "${APP_DIR}/shared/.env" "${CURRENT}/.env"

    # Generate key if missing
    if ! grep -q '^APP_KEY=base64:' "${APP_DIR}/shared/.env"; then
        info "Generating application key..."
        php artisan key:generate --force
    fi
}

# --- 3. Run migrations -------------------------------------------------------
run_migrations() {
    cd "$CURRENT"
    info "Running database migrations..."
    php artisan migrate --force
}

# --- 4. Warm caches ----------------------------------------------------------
warm_caches() {
    cd "$CURRENT"
    info "Warming Laravel caches..."
    # optimize generates config, events, routes, views, package manifest, and
    # any framework-registered caches (e.g. Filament, blade-icons) in one pass.
    # Pre-generating all cache files means PHP-FPM (www-data) only needs read
    # access to bootstrap/cache at runtime — no runtime writes required.
    php artisan optimize
}

# --- 5. Restart queue worker -------------------------------------------------
restart_queue_worker() {
    cd "$CURRENT"
    info "Restarting queue workers..."
    php artisan queue:restart 2>/dev/null || warn "Queue restart signal sent (worker may not be running yet)."
}

# --- 6. Prune old releases (keep last 5) -------------------------------------
prune_releases() {
    local RELEASES_DIR="${APP_DIR}/releases"
    local COUNT
    COUNT=$(ls -1d "${RELEASES_DIR}"/*/ 2>/dev/null | wc -l)
    if (( COUNT > 5 )); then
        info "Pruning old releases (keeping last 5)..."
        ls -1dt "${RELEASES_DIR}"/*/ | tail -n +6 | xargs rm -rf
    fi
}

# --- 7. Health check ----------------------------------------------------------
health_check() {
    info "Running health check..."
    sleep 2
    local HTTP_STATUS
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
        "http://localhost/" -H "Host: inventory.metanull.eu" || echo "000")

    if [[ "$HTTP_STATUS" == "200" ]]; then
        info "Health check PASSED (HTTP ${HTTP_STATUS})"
    else
        warn "Health check returned HTTP ${HTTP_STATUS} (may be OK on first deploy without routes)."
    fi
}

# =============================================================================
# Main
# =============================================================================
info "Starting deployment as $(whoami)..."
preflight
deploy_release
configure_laravel
run_migrations
warm_caches
restart_queue_worker
prune_releases
health_check
info "Deployment complete! $(date)"
