#!/usr/bin/env bash
#
# provision-search.sh — the global search on a server (M15 B5, B6; ADR 005)
#
# Installs Meilisearch (the pinned binary, checked by SHA-256) as a systemd
# service on 127.0.0.1:7700, Node for the loader, the two restricted keys,
# and the public edge: an nginx vhost for SEARCH_DOMAIN with its own
# certificate. Nothing of the inventory changes, and nginx is never stopped.
#
# Run as root from a copy of scripts/search that sits next to
# scripts/exporters/search/schema (the bundle deploy-search-ovh.yml uploads):
#
#   sudo bash provision-search.sh
#
# Optional env vars (or scripts/infra.local):
#   SEARCH_DOMAIN         default search.metanull.eu
#   SEARCH_ADMIN_EMAIL    default INVENTORY_ADMIN_EMAIL; Let's Encrypt registration
#
# Idempotent: a re-run changes only what differs.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ -f "${SCRIPT_DIR}/../infra.local" ]] && source "${SCRIPT_DIR}/../infra.local"

DOMAIN="${SEARCH_DOMAIN:-search.metanull.eu}"
ADMIN_EMAIL="${SEARCH_ADMIN_EMAIL:-${INVENTORY_ADMIN_EMAIL:-}}"
DEPLOY_USER="deploy"
VERSION="$(tr -d '[:space:]' < "${SCRIPT_DIR}/meilisearch.version")"
SHA256="$(tr -d '[:space:]' < "${SCRIPT_DIR}/meilisearch.sha256")"
BIN="/usr/local/bin/meilisearch"
DATA_DIR="/var/lib/meilisearch"
CONF_DIR="/etc/meilisearch"
EDGE_DIR="/etc/nginx/search"
ACME_DIR="/var/www/certbot"
SEARCH_DIR="/opt/search"
LOADER_KEY_FILE="/home/${DEPLOY_USER}/.search-loader-key"

info()  { echo -e "\033[0;32m[SEARCH]\033[0m $1"; }
warn()  { echo -e "\033[1;33m[SEARCH]\033[0m $1"; }
error() { echo -e "\033[0;31m[SEARCH]\033[0m $1"; exit 1; }

[[ $EUID -ne 0 ]] && error "Run as root (or via sudo)."
[[ "$(uname -m)" == "x86_64" ]] || error "Only the linux-amd64 binary is pinned (meilisearch.sha256)."
id "${DEPLOY_USER}" >/dev/null 2>&1 || error "The ${DEPLOY_USER} user is missing: run scripts/provision.sh first."
[[ -f "${SCRIPT_DIR}/../exporters/search/schema/validate.mjs" ]] || error "Run from the bundle: scripts/search next to scripts/exporters/search/schema."

# =============================================================================
# 1. Node, from Ubuntu's own packages (the loader and keys.mjs need 22 or later)
# =============================================================================
if ! command -v node >/dev/null 2>&1; then
    info "Installing Node from the Ubuntu archive..."
    # Node only: the deploy workflow installs the package (npm ci) before uploading.
    apt-get install -y -qq nodejs
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
(( NODE_MAJOR >= 22 )) || error "Node ${NODE_MAJOR} is too old for the loader (needs 22 or later)."
command -v envsubst >/dev/null 2>&1 || apt-get install -y -qq gettext-base

# =============================================================================
# 2. The Meilisearch binary, pinned and checked
# =============================================================================
CURRENT="$("${BIN}" --version 2>/dev/null | awk '{print "v"$2}' || true)"
if [[ "${CURRENT}" != "${VERSION}" ]]; then
    info "Installing Meilisearch ${VERSION} (was: ${CURRENT:-none})..."
    TMP="$(mktemp)"
    curl -fsSL -o "${TMP}" "https://github.com/meilisearch/meilisearch/releases/download/${VERSION}/meilisearch-linux-amd64"
    echo "${SHA256}  ${TMP}" | sha256sum -c --quiet - || { rm -f "${TMP}"; error "SHA-256 mismatch: refusing the binary."; }
    install -m 0755 -o root -g root "${TMP}" "${BIN}"
    rm -f "${TMP}"
    BINARY_CHANGED=1
else
    info "Meilisearch ${VERSION} already installed."
    BINARY_CHANGED=0
fi

# =============================================================================
# 3. User, data directory, master key, systemd unit
# =============================================================================
id meilisearch >/dev/null 2>&1 || useradd --system --home-dir "${DATA_DIR}" --shell /usr/sbin/nologin meilisearch
install -d -m 0750 -o meilisearch -g meilisearch "${DATA_DIR}"
install -d -m 0750 -o root -g meilisearch "${CONF_DIR}"

if [[ ! -s "${CONF_DIR}/master.key" ]]; then
    info "Generating the master key..."
    ( umask 077; openssl rand -hex 32 > "${CONF_DIR}/master.key" )
fi
chown root:root "${CONF_DIR}/master.key"; chmod 600 "${CONF_DIR}/master.key"

ENV_FILE="${CONF_DIR}/env"
NEW_ENV="$(cat <<EOF
MEILI_ENV=production
MEILI_MASTER_KEY=$(cat "${CONF_DIR}/master.key")
MEILI_HTTP_ADDR=127.0.0.1:7700
MEILI_DB_PATH=${DATA_DIR}/data.ms
MEILI_DUMP_DIR=${DATA_DIR}/dumps
MEILI_SNAPSHOT_DIR=${DATA_DIR}/snapshots
MEILI_NO_ANALYTICS=true
MEILI_MAX_INDEXING_MEMORY=1Gb
MEILI_MAX_INDEXING_THREADS=2
EOF
)"
if [[ ! -f "${ENV_FILE}" ]] || [[ "$(cat "${ENV_FILE}")" != "${NEW_ENV}" ]]; then
    ( umask 027; printf '%s\n' "${NEW_ENV}" > "${ENV_FILE}" )
    ENV_CHANGED=1
else
    ENV_CHANGED=0
fi
chown root:meilisearch "${ENV_FILE}"; chmod 640 "${ENV_FILE}"

UNIT="/etc/systemd/system/meilisearch.service"
NEW_UNIT="$(cat <<EOF
[Unit]
Description=Meilisearch for the global search (M15, ADR 005)
After=network.target

[Service]
Type=simple
User=meilisearch
Group=meilisearch
EnvironmentFile=${ENV_FILE}
ExecStart=${BIN}
Restart=on-failure
RestartSec=5
WorkingDirectory=${DATA_DIR}
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${DATA_DIR}
MemoryMax=2G
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF
)"
if [[ ! -f "${UNIT}" ]] || [[ "$(cat "${UNIT}")" != "${NEW_UNIT}" ]]; then
    printf '%s\n' "${NEW_UNIT}" > "${UNIT}"
    UNIT_CHANGED=1
else
    UNIT_CHANGED=0
fi
systemctl daemon-reload
systemctl enable meilisearch >/dev/null
if (( BINARY_CHANGED || ENV_CHANGED || UNIT_CHANGED )) || ! systemctl is-active --quiet meilisearch; then
    info "Restarting Meilisearch..."
    systemctl restart meilisearch
fi

# =============================================================================
# 4. The two restricted keys
# =============================================================================
install -d -m 0750 -o root -g www-data "${EDGE_DIR}"
info "Creating the loader and search keys..."
MEILI_URL="http://127.0.0.1:7700" MEILI_MASTER_KEY_FILE="${CONF_DIR}/master.key" \
    node "${SCRIPT_DIR}/keys.mjs" --loader-key "${LOADER_KEY_FILE}" --edge-include "${EDGE_DIR}/search-key.conf"
chown "${DEPLOY_USER}:${DEPLOY_USER}" "${LOADER_KEY_FILE}"; chmod 600 "${LOADER_KEY_FILE}"
chown root:www-data "${EDGE_DIR}/search-key.conf"; chmod 640 "${EDGE_DIR}/search-key.conf"

# Where deploy-search-ovh.yml unpacks each release.
install -d -m 0755 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" "${SEARCH_DIR}" "${SEARCH_DIR}/releases"

# =============================================================================
# 5. The public edge: nginx vhost and certificate (nginx keeps running)
# =============================================================================
for t in http server; do
    MEILI_UPSTREAM="127.0.0.1:7700" SEARCH_EDGE_DIR="${EDGE_DIR}" \
        envsubst '${MEILI_UPSTREAM} ${SEARCH_EDGE_DIR}' < "${SCRIPT_DIR}/edge/${t}.conf.template" > "${EDGE_DIR}/${t}.conf"
    chown root:www-data "${EDGE_DIR}/${t}.conf"; chmod 640 "${EDGE_DIR}/${t}.conf"
done
# The server's CORS list has no extra origin; local Docker adds localhost.
[[ -f "${EDGE_DIR}/cors-extra.conf" ]] || : > "${EDGE_DIR}/cors-extra.conf"
chown root:www-data "${EDGE_DIR}/cors-extra.conf"; chmod 640 "${EDGE_DIR}/cors-extra.conf"

install -d -m 0755 "${ACME_DIR}"
VHOST="/etc/nginx/sites-available/search"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"

write_http_vhost() {
    cat > "${VHOST}" <<EOF
# The global search edge (M15, ADR 005) — written by scripts/search/provision-search.sh
include ${EDGE_DIR}/http.conf;

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    server_tokens off;

    location /.well-known/acme-challenge/ {
        root ${ACME_DIR};
    }
    location / {
        return 301 https://\$host\$request_uri;
    }
}
EOF
}

if [[ ! -f "${CERT_DIR}/fullchain.pem" ]]; then
    # The server's existing Let's Encrypt account is reused; an e-mail is
    # needed only when there is none yet.
    EMAIL_ARGS=()
    if [[ -n "${ADMIN_EMAIL}" ]]; then
        EMAIL_ARGS=(-m "${ADMIN_EMAIL}")
    elif ! compgen -G "/etc/letsencrypt/accounts/*/directory/*" >/dev/null; then
        error "No Let's Encrypt account yet: set SEARCH_ADMIN_EMAIL (or INVENTORY_ADMIN_EMAIL)."
    fi
    info "Requesting a certificate for ${DOMAIN} (webroot, nginx keeps serving)..."
    write_http_vhost
    ln -sf "${VHOST}" /etc/nginx/sites-enabled/search
    nginx -t && systemctl reload nginx
    certbot certonly --webroot -w "${ACME_DIR}" -d "${DOMAIN}" \
        --agree-tos "${EMAIL_ARGS[@]}" --non-interactive
fi

write_http_vhost
cat >> "${VHOST}" <<EOF

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name ${DOMAIN};

    ssl_certificate     ${CERT_DIR}/fullchain.pem;
    ssl_certificate_key ${CERT_DIR}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # server.conf carries every header, HSTS included.
    include ${EDGE_DIR}/server.conf;
}
EOF
[[ -f /etc/letsencrypt/options-ssl-nginx.conf ]] || sed -i '/options-ssl-nginx.conf/d' "${VHOST}"
[[ -f /etc/letsencrypt/ssl-dhparams.pem ]] || sed -i '/ssl-dhparams.pem/d' "${VHOST}"
ln -sf "${VHOST}" /etc/nginx/sites-enabled/search
nginx -t
systemctl reload nginx

info "Done. Meilisearch ${VERSION} on 127.0.0.1:7700, edge at https://${DOMAIN}."
info "Next: merge a pin of @museumwnf/search-data (deploy-search-ovh.yml loads it)."
