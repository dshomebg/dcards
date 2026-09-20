#!/usr/bin/env bash
#
# Нощният архив на прода. Върви от root crontab на сървъра (03:00; pagagal е в 03:20):
#   0 3 * * * /opt/dcards/backup.sh >> /var/log/dcards-backup.log 2>&1
#
# Държи ДВЕТЕ неща, които pre-deploy dump-ът не пази: базата извън прозореца на
# издаването и качените файлове. `.env` НЕ се архивира, offsite е отделен цикъл.
# КОМЕНТАРИТЕ са на български, ИЗХОДЪТ — на английски (cron, ssh от Windows).

set -euo pipefail
# Dump-овете носят хешове и лични данни; на споделен хост никой друг не ги чете.
umask 077

APP_DIR=/opt/dcards
SLUG=dcards
BACKUP_DIR=/backup/dcards/daily
# Ротация в дни; pre-deploy dump-овете са в друга папка и не се пипат.
KEEP_DAYS=14

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

cd "$APP_DIR"
set -a; . ./.env; set +a
: "${POSTGRES_USER:?POSTGRES_USER missing in $APP_DIR/.env}"
: "${POSTGRES_DB:?POSTGRES_DB missing in $APP_DIR/.env}"

mkdir -p "$BACKUP_DIR"
STAMP=$(date '+%Y-%m-%d_%H-%M')
DUMP="$BACKUP_DIR/db_${STAMP}.sql.gz"
UPLOADS_ARCHIVE="$BACKUP_DIR/uploads_${STAMP}.tar.gz"

# ⚠ При провал частичният файл се маха: отрязан dump изглежда като архив.
# `fail` чисти сам — в `cmd || fail` ERR trap-ът не се задейства; той е за останалото.
cleanup_partial() { rm -f "$DUMP" "$UPLOADS_ARCHIVE"; }
fail() { log "FAILED: $*"; cleanup_partial; exit 1; }
trap cleanup_partial ERR

log "starting nightly backup, stamp $STAMP"

# ------------------------------------------------------------------ 1. базата
# `pipefail` вдига грешката на pg_dump през тръбата към gzip.
log "dumping database..."
docker exec "${SLUG}-postgres-prod" \
  pg_dump --no-owner --no-acl -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > "$DUMP" || fail "pg_dump"

# Проверява се и обвивката, и съдържанието: празен валиден gzip също е „файл".
gzip -t "$DUMP" || fail "dump is corrupt"
# `head` затваря тръбата рано и `zcat` умира от SIGPIPE — за тази проверка pipefail спира.
set +o pipefail
HEADER=$(zcat "$DUMP" | head -3)
set -o pipefail
grep -q 'PostgreSQL database dump' <<<"$HEADER" \
  || fail "dump does not look like a PostgreSQL dump"
log "  saved: $DUMP ($(du -h "$DUMP" | cut -f1))"

# ----------------------------------------------------------- 2. качените файлове
# Пътят се пита, не се заковава: `/var/lib/docker/volumes/...` е вътрешност на Docker.
UPLOADS=$(docker volume inspect "${SLUG}-uploads-data-prod" --format '{{.Mountpoint}}') \
  || fail "cannot find uploads volume"
[ -d "$UPLOADS" ] || fail "uploads path is not readable: $UPLOADS"

log "archiving uploads from $UPLOADS..."
tar -czf "$UPLOADS_ARCHIVE" -C "$UPLOADS" . || fail "tar uploads"
gzip -t "$UPLOADS_ARCHIVE" || fail "uploads archive is corrupt"
log "  saved: $UPLOADS_ARCHIVE ($(du -h "$UPLOADS_ARCHIVE" | cut -f1))"

# ---------------------------------------------------------------- 3. ротация
# СЛЕД успешния нов архив — провал по-горе излиза преди да е изтрито каквото и да е.
trap - ERR
log "removing archives older than $KEEP_DAYS days..."
find "$BACKUP_DIR" -name '*.gz' -mtime +"$KEEP_DAYS" -delete

log "done. archives in $BACKUP_DIR:"
ls -1 "$BACKUP_DIR" | tail -6
