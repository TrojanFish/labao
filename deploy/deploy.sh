#!/usr/bin/env bash
# =============================================================
# YoloCycling VPS Deployment Script
# Usage:
#   First deploy:   ./deploy/deploy.sh --init --domain yolocycling.app --email admin@yolocycling.app
#   Update deploy:  ./deploy/deploy.sh --update
# =============================================================
set -euo pipefail

DOMAIN="${DOMAIN:-yolocycling.app}"
EMAIL="${EMAIL:-admin@yolocycling.app}"
DEPLOY_DIR="/opt/yolocycling"
REPO_URL="${REPO_URL:-}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[$(date '+%H:%M:%S')] $*${NC}"; }
warn() { echo -e "${YELLOW}[WARN] $*${NC}"; }
err()  { echo -e "${RED}[ERROR] $*${NC}" >&2; exit 1; }

# Parse args
MODE="update"
for arg in "$@"; do
  case "$arg" in
    --init)   MODE="init" ;;
    --update) MODE="update" ;;
    --domain=*) DOMAIN="${arg#*=}" ;;
    --email=*)  EMAIL="${arg#*=}" ;;
  esac
done

# ── Check dependencies ──────────────────────────────────────
check_deps() {
  for cmd in docker docker-compose nginx certbot; do
    command -v "$cmd" &>/dev/null || err "Missing dependency: $cmd. Install it first."
  done
  log "Dependencies: OK"
}

# ── Initial setup: SSL certificate ─────────────────────────
init_ssl() {
  log "Obtaining Let's Encrypt certificate for ${DOMAIN}..."
  mkdir -p /var/www/certbot

  # Temporary nginx for ACME challenge
  nginx -t && systemctl start nginx || true

  certbot certonly \
    --webroot \
    -w /var/www/certbot \
    -d "${DOMAIN}" \
    -d "www.${DOMAIN}" \
    --email "${EMAIL}" \
    --agree-tos \
    --non-interactive \
    --keep-until-expiring

  log "SSL certificate obtained."
}

# ── Build & deploy ───────────────────────────────────────────
deploy() {
  log "Deploying YoloCycling to ${DEPLOY_DIR}..."

  mkdir -p "${DEPLOY_DIR}"

  if [[ -n "${REPO_URL}" ]]; then
    if [[ -d "${DEPLOY_DIR}/.git" ]]; then
      log "Pulling latest changes..."
      git -C "${DEPLOY_DIR}" pull --ff-only
    else
      git clone "${REPO_URL}" "${DEPLOY_DIR}"
    fi
  fi

  cd "${DEPLOY_DIR}"

  log "Building Docker images..."
  docker-compose -f deploy/docker-compose.yml build --no-cache

  log "Stopping old containers..."
  docker-compose -f deploy/docker-compose.yml down --remove-orphans || true

  log "Starting services..."
  docker-compose -f deploy/docker-compose.yml up -d

  log "Waiting for healthcheck..."
  sleep 5
  docker-compose -f deploy/docker-compose.yml ps

  log "Deployment complete! Site should be live at https://${DOMAIN}"
}

# ── Verify deployment ────────────────────────────────────────
verify() {
  log "Verifying deployment..."
  HTTP_STATUS=$(curl -sLo /dev/null -w "%{http_code}" "https://${DOMAIN}/")
  if [[ "${HTTP_STATUS}" == "200" ]]; then
    log "✓ Site returns HTTP 200"
  else
    warn "Site returned HTTP ${HTTP_STATUS}"
  fi

  HSTS=$(curl -sI "https://${DOMAIN}/" | grep -i "strict-transport" || true)
  if [[ -n "${HSTS}" ]]; then
    log "✓ HSTS header present"
  else
    warn "HSTS header missing — check nginx config"
  fi
}

# ── Main ─────────────────────────────────────────────────────
check_deps

case "${MODE}" in
  init)
    log "=== Initial deployment for ${DOMAIN} ==="
    init_ssl
    deploy
    verify
    ;;
  update)
    log "=== Updating deployment for ${DOMAIN} ==="
    deploy
    verify
    ;;
  *)
    err "Unknown mode: ${MODE}"
    ;;
esac
