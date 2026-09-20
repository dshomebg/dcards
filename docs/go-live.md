# Пускане на прода

> **Проверен:** 2026-09-19 (подготвено, НЕ изпълнено)
> **Инвалидира се от:** първия реален deploy — тогава се записва какво е било различно.

Сървърът е споделен (INF-1). Стъпки 2 и 3 пипат nginx на хоста и се правят **само след
изрично потвърждение** (CLAUDE.md § 5). Всичко останало е скриптирано.

## 1. Еднократно — `.env` на сървъра

```powershell
.\scripts\bootstrap-prod.ps1
```

Създава `/opt/dcards`, генерира парола за базата и `SESSION_SECRET`, взима `MAIL_PASS` от
локалния `.env`. Отказва, ако `.env` вече съществува.

⚠ `MAIL_PASS` се записва в единични кавички: dotenv (Next и compose) чете непрокавичкан `#`
като начало на коментар и паролата тихо се реже → `EAUTH`, нула писма. Парола с `'` — смени я.
`MAIL_ADMIN_TO=info@…` праща копие на всяка нова поръчка (без данни на клиента).

## 2. Еднократно — nginx шаблон в Hestia

Домейнът е с шаблон `default` (PHP от `public_html`). Трябва proxy към `127.0.0.1:3010`,
по модела на `pagagal-proxy`. Шаблонът е в `scripts/remote/nginx/`:

```bash
scp scripts/remote/nginx/dcards-proxy.tpl scripts/remote/nginx/dcards-proxy.stpl \
    pagagal:/usr/local/hestia/data/templates/web/nginx/php-fpm/
ssh pagagal 'cp /usr/local/hestia/data/templates/web/php-fpm/no-php.tpl \
    /usr/local/hestia/data/templates/web/php-fpm/dcards-proxy.tpl'
ssh pagagal 'export PATH=$PATH:/usr/local/hestia/bin && \
    v-change-web-domain-tpl pagagal dcards-bg.com dcards-proxy && nginx -t'
```

⚠ Преди `v-change-web-domain-tpl` контейнерът трябва да е горе (стъпка 3), иначе сайтът
дава 502 между двете стъпки. Редът е: bootstrap → deploy → шаблон.

## 3. Всеки път — deploy

```powershell
.\scripts\deploy-prod.ps1
```

Гейтове → build → tar → сървър: backup на базата → миграции → старт → `/api/health/ready`.
Проваленият deploy оставя старите образи; `.\scripts\rollback-prod.ps1` връща предишното.

## 4. Проверка

- `https://www.dcards-bg.com/api/health/ready` → `{"status":"ready"}`
- `ssh pagagal 'docker ps --filter name=dcards'` → `dcards-app-prod`, `dcards-postgres-prod`,
  `dcards-redis-prod` — `healthy`
- Съседите непокътнати: `docker ps --filter name=pagagal` — същите контейнери, същите uptime.

## 5. Първи админ — `seed-admin.mjs` от образа

Образът носи `seed-admin.mjs` (бъндълнат от `pnpm build`, до `migrate.mjs`). Пуска се като
миграциите — еднократен контейнер в мрежата на прода, със същия обелен `.env`
(`deploy.sh` § 4). Паролата се подава през `SEED_ADMIN_PASSWORD` от `read -s`, за да не
остане в shell history:

```bash
ssh pagagal
cd /opt/dcards && set -a && . ./.env && set +a
read -rs -p 'admin password: ' SEED_ADMIN_PASSWORD; echo
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}"
ENV_FILE=$(mktemp) && sed -E '/^[[:space:]]*(#|$)/d; s/^([A-Za-z_][A-Za-z0-9_]*)="(.*)"$/\1=\2/; s/^([A-Za-z_][A-Za-z0-9_]*)='"'"'(.*)'"'"'$/\1=\2/' .env > "$ENV_FILE"
docker run --rm --network dcards-internal-prod --env-file "$ENV_FILE" \
  -e DATABASE_URL \
  -e REDIS_URL=redis://redis:6379 -e NODE_ENV=production \
  -e SEED_ADMIN_PASSWORD \
  dcards-app-prod:latest node seed-admin.mjs --email admin@example.com --name 'Име'
rm -f "$ENV_FILE"; unset SEED_ADMIN_PASSWORD DATABASE_URL
```

Първото пускане печата `admin created: user …, organization …`; второто със същия имейл —
`user already exists, nothing changed` (идемпотентно, нищо не се презаписва).

## 6. Нощен backup — `backup.sh` (с потвърждение, PRC-2)

`scripts/remote/backup.sh` прави dump на базата (`gzip -t` + проверка на заглавието) и
`tar.gz` на тома с качените файлове в `/backup/dcards/daily/`, после трие по-старите от 14
дни — само след успешен нов архив. Не пипа pre-deploy dump-овете, не архивира `.env`.

```bash
scp scripts/remote/backup.sh pagagal:/opt/dcards/backup.sh
ssh pagagal 'chmod 750 /opt/dcards/backup.sh && install -d -m 700 /backup/dcards /backup/dcards/daily /backup/dcards/pre-deploy'
ssh pagagal '/opt/dcards/backup.sh'                       # първи ръчен пуск
ssh pagagal 'ls -la /backup/dcards/daily; zcat /backup/dcards/daily/db_*.sql.gz | head -3'
ssh pagagal '(crontab -l 2>/dev/null; echo "0 3 * * * /opt/dcards/backup.sh >> /var/log/dcards-backup.log 2>&1") | crontab -'
```

03:00 — pagagal е в 03:20, не се застъпват. Offsite копие е отделен цикъл.

## Какво ОЩЕ не е решено

- ~~Канонично `www` или без~~ — решено 2026-09-19: **с www**; `dcards-proxy.stpl` прави 301 от
  голия домейн, `APP_URL=https://www.dcards-bg.com`.
- ~~Backup извън pre-deploy dump-овете~~ — нощният е § 6 (OPS-1); offsite остава отворен.
