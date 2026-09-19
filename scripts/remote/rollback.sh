#!/usr/bin/env bash
#
# Сървърната половина на връщането назад. Качва се от rollback-prod.ps1:
#   bash /tmp/dcards-rollback-<pid>.sh <TARGET_SHA>
#
# Коментарите са на български, изходът — на английски (виж deploy.sh).

set -euo pipefail

TARGET="${1:?missing target release}"
APP_DIR=/opt/dcards
SLUG=dcards
IMAGE="${SLUG}-app-prod"

cd "$APP_DIR"
set -a; . ./.env; set +a

log() { echo "[$(date '+%H:%M:%S')] $*"; }

if ! docker image inspect "${IMAGE}:${TARGET}" >/dev/null 2>&1; then
  log "ERROR: image ${IMAGE}:${TARGET} not found (pruned beyond retention)."
  log "Deploy that commit from source instead."
  exit 1
fi

log "rolling back to ${TARGET}..."
docker tag "${IMAGE}:${TARGET}" "${IMAGE}:latest"
IMAGE_TAG="$TARGET" docker compose -f docker-compose.prod.yml up -d --no-build 2>&1

{ echo "$TARGET"; grep -vxF -- "$TARGET" .deploy-history 2>/dev/null || true; } > .deploy-history.tmp
mv .deploy-history.tmp .deploy-history

log "checking /api/health/ready..."
for _ in $(seq 1 20); do
  sleep 3
  CODE=$(curl -s -o /tmp/dcards-ready.json -w '%{http_code}' "http://127.0.0.1:${APP_PORT:-3010}/api/health/ready" || echo 000)
  if [ "$CODE" = "200" ]; then
    log "rolled back to ${TARGET} - application responding"
    cat /tmp/dcards-ready.json; echo
    exit 0
  fi
done

log "WARNING: rolled back to ${TARGET}, but health check did NOT return 200."
cat /tmp/dcards-ready.json 2>/dev/null || true
echo
log "If the database schema is the cause, pre-deploy dumps are in:"
log "  /backup/dcards/pre-deploy/"
exit 1
