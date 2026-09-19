#!/usr/bin/env bash
#
# Сървърната половина на deploy-а. Качва се и се изпълнява от deploy-prod.ps1:
#   bash /tmp/dcards-deploy-<pid>.sh <IMAGE_TAG>
#
# Отделен файл, а не низ в PowerShell: вграден, същият код се екранира двойно и
# става нечетим. КОМЕНТАРИТЕ са на български, ИЗХОДЪТ — на английски (кирилицата
# през bash → ssh → Windows конзола излиза като въпросителни).

set -euo pipefail

IMAGE_TAG="${1:?missing IMAGE_TAG}"
APP_DIR=/opt/dcards
SLUG=dcards
IMAGE="${SLUG}-app-prod"

BACKUP_DIR=/backup/dcards/pre-deploy
# Dump-овете преди deploy са предпазна мрежа за часове, не архив.
KEEP_BACKUPS=5
# Колко стари издания на образа остават за rollback.
KEEP_RELEASES=3

cd "$APP_DIR"
set -a; . ./.env; set +a

log() { echo "[$(date '+%H:%M:%S')] $*"; }

# ------------------------------------------------------- 1. зареждане на образа
log "loading image..."
docker load -q < app-image.tar
rm -f app-image.tar

# --------------------------------------------------------- 2. базата да е жива
# `2>&1` тук, а не в PowerShell: docker compose пише напредъка си в stderr, а
# PowerShell превръща всеки такъв ред в обект-грешка.
log "starting database and cache..."
docker compose -f docker-compose.prod.yml up -d postgres redis 2>&1

# `pg_isready`, а НЕ `docker compose wait` — второто чака контейнерът да ИЗЛЕЗЕ.
DB_READY=0
for _ in $(seq 1 30); do
  if docker exec "${SLUG}-postgres-prod" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
    DB_READY=1; break
  fi
  sleep 2
done
if [ "$DB_READY" != "1" ]; then
  log "ERROR: database did not respond within 60s. Nothing was changed."
  exit 1
fi

# ------------------------------------------------------------- 3. BACKUP ПРЕДИ
# Без този dump миграцията е необратима: rollback връща КОДА, но не и схемата.
mkdir -p "$BACKUP_DIR"
DUMP="$BACKUP_DIR/pre-deploy_$(date +%Y-%m-%d_%H-%M-%S)_${IMAGE_TAG}.sql.gz"
log "backing up database before migrations..."
if docker exec "${SLUG}-postgres-prod" \
     pg_dump --no-owner --no-acl -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$DUMP"; then
  log "  saved: $DUMP ($(du -h "$DUMP" | cut -f1))"
else
  log "  ERROR: backup failed - STOPPING before touching the schema."
  rm -f "$DUMP"
  exit 1
fi
ls -1t "$BACKUP_DIR"/pre-deploy_*.sql.gz 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f

# ---------------------------------------------------------------- 4. миграции
# Еднократен контейнер с НОВИЯ образ, преди новият код да поеме трафик.
# `--env-file` подава целия `.env`, защото `env()` се валидира ЦЯЛА при зареждане.
# ⚠ `docker --env-file` НЕ маха кавичките, а обвивката ги иска — затова файлът
# за docker се произвежда с обелени кавички (наблюдавано на прода на pagagal).
DOCKER_ENV_FILE="$(mktemp)"
trap 'rm -f "$DOCKER_ENV_FILE"' EXIT
sed -E '/^[[:space:]]*(#|$)/d; s/^([A-Za-z_][A-Za-z0-9_]*)="(.*)"$/\1=\2/; s/^([A-Za-z_][A-Za-z0-9_]*)='"'"'(.*)'"'"'$/\1=\2/' .env > "$DOCKER_ENV_FILE"

log "applying migrations..."
docker run --rm \
  --network "${SLUG}-internal-prod" \
  --env-file "$DOCKER_ENV_FILE" \
  -e DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}" \
  -e REDIS_URL="redis://redis:6379" \
  -e NODE_ENV=production \
  "${IMAGE}:${IMAGE_TAG}" \
  node migrate.mjs

# ------------------------------------------------- 5. отбелязване на изданието
docker tag "${IMAGE}:${IMAGE_TAG}" "${IMAGE}:latest"
{ echo "$IMAGE_TAG"; grep -vxF -- "$IMAGE_TAG" .deploy-history 2>/dev/null || true; } > .deploy-history.tmp
mv .deploy-history.tmp .deploy-history

# ----------------------------------------------------------------- 6. пускане
log "starting application (IMAGE_TAG=${IMAGE_TAG})..."
IMAGE_TAG="$IMAGE_TAG" docker compose -f docker-compose.prod.yml up -d --no-build 2>&1

# ------------------------------------------------------------ 7. проверка
# `/api/health/ready` връща 200 само с жива база и Redis.
log "checking /api/health/ready..."
HEALTHY=0
for i in $(seq 1 20); do
  sleep 3
  CODE=$(curl -s -o /tmp/dcards-ready.json -w '%{http_code}' "http://127.0.0.1:${APP_PORT:-3010}/api/health/ready" || echo 000)
  if [ "$CODE" = "200" ]; then HEALTHY=1; log "  ready after $((i * 3))s"; break; fi
  [ $((i % 5)) -eq 0 ] && log "  ...still $CODE (attempt $i/20)"
done

if [ "$HEALTHY" != "1" ]; then
  log "FAILED: no 200 response. Last body:"
  cat /tmp/dcards-ready.json 2>/dev/null || true
  echo
  log "Previous release images are still here - roll back with:"
  log "  .\\scripts\\rollback-prod.ps1"
  log "If a migration is to blame, the pre-migration dump is at: $DUMP"
  exit 1
fi
cat /tmp/dcards-ready.json; echo

# --------------------------------------------------------------- 8. почистване
# СЛЕД проверката, за да са налични образите за връщане назад.
for old in $(tail -n +$((KEEP_RELEASES + 1)) .deploy-history 2>/dev/null); do
  docker rmi "${IMAGE}:${old}" >/dev/null 2>&1 || true
done
head -n "$KEEP_RELEASES" .deploy-history > .deploy-history.tmp && mv .deploy-history.tmp .deploy-history

log "done - release ${IMAGE_TAG}"
