#!/usr/bin/env bash
#
# Чисти качени файлове, към които нищо не сочи: лого, качено в количката, но
# непоръчано; стара снимка на профил или продукт, чието изтриване се е провалило.
# По подразбиране САМО ИЗБРОЯВА; трие с `--delete`. Седмично от root crontab:
#   30 4 * * 0 /opt/dcards/cleanup-uploads.sh --delete >> /var/log/dcards-cleanup.log 2>&1
# ⚠ Нова колона с ключ на файл влиза в заявката по-долу — иначе файловете ѝ са „сираци".
# КОМЕНТАРИТЕ са на български, ИЗХОДЪТ — на английски (cron, ssh от Windows).

set -euo pipefail

APP_DIR=/opt/dcards
SLUG=dcards
VOLUME=${SLUG}-uploads-data-prod
# Количката плъзга 7 дни при всеки запис — 30 дни покриват всяка реална поръчка.
MIN_AGE_DAYS=30
# Предпазител: толкова много сираци значи забравена колона, не боклук.
MAX_ORPHANS=50
DELETE=0
[ "${1:-}" = "--delete" ] && DELETE=1

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

cd "$APP_DIR"
set -a; . ./.env; set +a
: "${POSTGRES_USER:?POSTGRES_USER missing in $APP_DIR/.env}"
: "${POSTGRES_DB:?POSTGRES_DB missing in $APP_DIR/.env}"

alert() {
  [ -n "${MAIL_ADMIN_TO:-}" ] || return 0
  printf 'To: %s\nSubject: [%s] uploads cleanup FAILED\n\n%s\nLog: /var/log/dcards-cleanup.log\n' \
    "$MAIL_ADMIN_TO" "$SLUG" "$1" | /usr/sbin/sendmail -- "$MAIL_ADMIN_TO" || true
}
fail() { log "FAILED: $*"; alert "$*"; exit 1; }

REFERENCED=$(mktemp)
ORPHANS=$(mktemp)
trap 'rm -f "$REFERENCED" "$ORPHANS"' EXIT
trap 'alert "unexpected error at line $LINENO"' ERR

UPLOADS=$(docker volume inspect "$VOLUME" --format '{{.Mountpoint}}') \
  || fail "cannot find uploads volume"
[ -d "$UPLOADS" ] || fail "uploads path is not readable: $UPLOADS"

# Провал на заявката = СТОП (празен списък би изтрил всичко); празен РЕЗУЛТАТ е
# законен — нищо не е реферирано.
docker exec "${SLUG}-postgres-prod" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -v ON_ERROR_STOP=1 -At -c "
    select photo_key from profiles where photo_key is not null
    union select logo_key from profiles where logo_key is not null
    union select personalization->>'logoKey' from order_items
      where personalization->>'logoKey' is not null
    union select jsonb_array_elements_text(images) from products
      where jsonb_typeof(images) = 'array'" \
  > "$REFERENCED" || fail "cannot read referenced keys"
log "referenced keys in database: $(wc -l < "$REFERENCED")"

kept=0
while IFS= read -r -d '' file; do
  key=${file#"$UPLOADS"/}
  if grep -qxF "$key" "$REFERENCED"; then
    kept=$((kept + 1))
  else
    printf '%s\0' "$key" >> "$ORPHANS"
    log "  orphan $key"
  fi
done < <(find "$UPLOADS/logos" "$UPLOADS/photos" "$UPLOADS/products" \
  -type f -name '*.webp' -mtime +"$MIN_AGE_DAYS" -print0 2>/dev/null || true)

orphans=$(tr -cd '\0' < "$ORPHANS" | wc -c)
log "old files kept: $kept, orphans: $orphans"
[ "$orphans" -le "$MAX_ORPHANS" ] \
  || fail "$orphans orphans exceed the cap of $MAX_ORPHANS - nothing deleted, check the query"

if [ "$DELETE" = "1" ] && [ "$orphans" -gt 0 ]; then
  # Трие се във временен контейнер, в който е само томът: подменен с symlink
  # път води в неговата файлова система, не в хоста (root).
  docker run --rm -i --network none -v "$VOLUME:/data" postgres:18-alpine \
    sh -c 'cd /data && xargs -0 rm -f --' < "$ORPHANS" \
    || fail "delete failed"
  log "done. removed $orphans orphans"
else
  log "done. dry run (pass --delete to remove)"
fi
