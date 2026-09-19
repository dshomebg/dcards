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

## Какво ОЩЕ не е решено

- Канонично `www` или без: pagagal прави 301 към `www`. Тук `APP_URL` е `https://www.dcards-bg.com`;
  Hestia `nginx.forcessl.conf` вече прави http → https, но не и apex → www. Решава се преди
  първия deploy.
- Backup извън pre-deploy dump-овете (нощен, извън сървъра) — pagagal има `backup.sh`; ще се
  пренесе, когато има данни за пазене.
