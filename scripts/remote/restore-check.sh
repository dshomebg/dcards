#!/usr/bin/env bash
#
# Учение за възстановяване: последният нощен dump се зарежда в ВРЕМЕНЕН Postgres
# контейнер и се броят редовете. Продът не се пипа. Седмично от root crontab:
#   0 5 * * 0 /opt/dcards/restore-check.sh >> /var/log/dcards-restore-check.log 2>&1
# Истинското възстановяване е описано в `docs/go-live.md` § Възстановяване.
# КОМЕНТАРИТЕ са на български, ИЗХОДЪТ — на английски (cron, ssh от Windows).

set -euo pipefail

# Пътищата се подменят само за локалната проба на скрипта.
APP_DIR=${APP_DIR:-/opt/dcards}
SLUG=dcards
BACKUP_DIR=${BACKUP_DIR:-/backup/dcards/daily}
CHECK=${SLUG}-restore-check
# Същата версия като прода — dump от по-нов Postgres не се зарежда в по-стар.
IMAGE=postgres:18-alpine

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

cd "$APP_DIR"
set -a; . ./.env; set +a

alert() {
  [ -n "${MAIL_ADMIN_TO:-}" ] || return 0
  printf 'To: %s\nSubject: [%s] restore check FAILED\n\n%s\nLog: /var/log/dcards-restore-check.log\n' \
    "$MAIL_ADMIN_TO" "$SLUG" "$1" | /usr/sbin/sendmail -- "$MAIL_ADMIN_TO" || true
}
# Контейнерът е само наш (`--rm`, без том) — махането му не пипа нищо чуждо.
# `-v`: анонимният том на образа носи пълно копие на прода — не остава висящ.
cleanup() { docker rm -fv "$CHECK" >/dev/null 2>&1 || true; }
fail() { log "FAILED: $*"; cleanup; alert "$*"; exit 1; }
trap 'cleanup; alert "unexpected error at line $LINENO"' ERR
trap cleanup EXIT

DUMP=$(ls -1t "$BACKUP_DIR"/db_*.sql.gz 2>/dev/null | head -1 || true)
[ -n "$DUMP" ] || fail "no dump in $BACKUP_DIR"
log "restoring $DUMP into a throwaway container..."

cleanup
docker run -d --rm --name "$CHECK" --network none \
  -e POSTGRES_PASSWORD=check -e POSTGRES_DB=check "$IMAGE" >/dev/null \
  || fail "cannot start $IMAGE"

# През TCP, не сокета: entrypoint-ът първо вдига временен сървър само на сокета
# и го спира — `pg_isready` там казва „готов" точно преди рестарта.
for _ in $(seq 1 30); do
  docker exec "$CHECK" pg_isready -h 127.0.0.1 -U postgres -d check >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$CHECK" pg_isready -h 127.0.0.1 -U postgres -d check >/dev/null 2>&1 \
  || fail "throwaway postgres did not start"

zcat "$DUMP" | docker exec -i "$CHECK" psql -h 127.0.0.1 -q -U postgres -d check \
  -v ON_ERROR_STOP=1 >/dev/null || fail "dump does not restore"

# Таблица, която липсва, проваля заявката — броят е доказателство, не украса.
COUNTS=$(docker exec "$CHECK" psql -h 127.0.0.1 -U postgres -d check -v ON_ERROR_STOP=1 -At -c "
  select 'users=' || (select count(*) from users)
    || ' organizations=' || (select count(*) from organizations)
    || ' profiles=' || (select count(*) from profiles)
    || ' cards=' || (select count(*) from cards)
    || ' orders=' || (select count(*) from orders)") \
  || fail "restored database is missing tables"
[ "${COUNTS#users=0 }" = "$COUNTS" ] || fail "restored database has no users"

log "done. restored $(basename "$DUMP"): $COUNTS"
