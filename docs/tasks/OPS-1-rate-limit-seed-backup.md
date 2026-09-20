# `OPS-1` — Защита на живите входове, seed в образа, нощен backup

**Тежест:** голяма — пипа auth пътя (`signIn`/`signInUser`/`register`), добавя зависимост към
Redis в публични handlers и подготвя прод операция (backup + cron).
**Заявено:** 2026-09-20
**Сверено с кода:** 2026-09-20 — всеки `файл:ред` по-долу е отворен наново, не преписан от заявката.

## Дневник на етапите

| Етап         | Изпълнител | Кога       | Резултат                                              |
| ------------ | ---------- | ---------- | ----------------------------------------------------- |
| анализ       | analyzer   | 2026-09-20 | задание                                               |
| код          | programmer | 2026-09-20 | готово; 3 отклонения приети                           |
| ревю         | reviewer   | 2026-09-20 | готово с уговорки — EXPIRE NX при всеки опит поправен |
| сигурност    | security   | 2026-09-20 | 6 находки, всички поправени от диригента              |
| тестове      | programmer | 2026-09-20 | 226 теста; браузър 6-и вход; curl 429; Redis down     |
| документация | диригентът | 2026-09-20 | AUTH-9, INF-6, worklog, open-items                    |

## 1. Какво не е наред

Прод е публичен от 2026-09-20 без нито един лимит: `/admin/login`, `/login` и `/register` приемат
неограничено опити (всеки струва един argon2 при m=64 MiB), Server Actions в `/app` и
`/api/{vcard,qr}` нямат таван. Първият админ е направен на ръка (`/register` + SQL) — образът не
носи `seed-admin`. Единственият архив е pre-deploy dump-ът (5 броя) — при спокойна седмица без
deploy няма нито едно копие.

**Сверка с кода — разлики спрямо заявката:**

- Заявката казва „IP от `x-forwarded-for`, първи елемент". **Механизмът е описан грешно:**
  `scripts/remote/nginx/dcards-proxy.stpl:30` ползва `$proxy_add_x_forwarded_for`, който
  **добавя** към XFF, подаден от клиента — първият елемент е под контрола на нападателя. Ред 29
  подава `X-Real-IP: $remote_addr` (презаписва). Cloudflare е само DNS (INF-4), т.е. `$remote_addr`
  е реалният клиент. → Ползва се `x-real-ip`; XFF не се чете.
- `headers()` е Request-time API като `cookies()`, а `session.ts:6,26` вече вика `cookies()` от
  Server Action — същият механизъм. Route handlers имат `Request.headers` директно.
- Standalone носи argon2: `.next/standalone/node_modules/argon2/package.json` съществува.
- `seed-admin.ts` няма зависимост от tsx: чете `process.env`, внася `@/modules/auth/user.service`
  (без `server-only`), `@/modules/core` и `@/modules/platform` — нито един файл там не внася
  `server-only` или `next/*`. esbuild чете `paths` от `tsconfig.json:28`.
- `signInSchema` (`auth/schema.ts:5`) **не** нормализира имейла — ключът по имейл трябва сам да
  прави `toLowerCase()`, както репозиторият.
- pagagal `backup.sh` е с restic, локално хранилище, без offsite. Пренася се само идеята (dump →
  файл → `gzip -t` → ротация), не restic.

## 2. Къде

| Файл                                               | Редове         | Роля в промяната                                             |
| -------------------------------------------------- | -------------- | ------------------------------------------------------------ |
| `src/modules/core/rate-limit/limiter.ts`           | нов            | главна: `createLimiter(store)` → `consume`                   |
| `src/modules/core/rate-limit/client-ip.ts`         | нов            | главна: `clientIpFrom(headers: Headers)`                     |
| `src/modules/core/rate-limit/policy.ts`            | нов            | прагове, ключове, текст на съобщението                       |
| `src/modules/core/index.ts`                        | 1-3            | съгласуване: експорт на `rateLimit`, `clientIpFrom`, policy  |
| `src/modules/auth/actions.ts`                      | 37-52          | главна: лимит в `signIn` след Zod, преди `openSession`       |
| `src/modules/auth/user-actions.ts`                 | 46-61, 83-92   | главна: `signInUser`, `register`                             |
| `src/app/app/(protected)/profiles/new/actions.ts`  | 35-37          | главна: лимит по потребител след `requireCurrent`            |
| `src/app/app/(protected)/profiles/[id]/actions.ts` | 87-89, 114-116 | същото за `save`/`delete`                                    |
| `src/app/api/vcard/[slug]/route.ts`                | 24-28          | главна: 429 след slug валидация, преди базата                |
| `src/app/api/qr/[slug]/route.ts`                   | 23-27          | същото                                                       |
| `scripts/db/seed-admin.ts`                         | 1-119          | само за контекст — не се променя                             |
| `package.json`                                     | 16, 36         | `build:seed` по образеца на `build:migrate`; `build` го вика |
| `docker/app.Dockerfile`                            | 34             | `seed-admin.mjs` идва със standalone — само коментар         |
| `scripts/remote/backup.sh`                         | нов            | главна: нощен dump + uploads + ротация                       |
| `scripts/remote/deploy.sh`                         | 52-65, 72-84   | само за контекст — образец за dump и `--env-file`            |
| `docs/go-live.md`                                  | 44-56          | § 5 seed, § 6 backup                                         |
| `docs/open-items.md`, `docs/decisions.md`          | —              | диригентът                                                   |

## 3. Как (посока, не готов код)

### 3.1 Лимитер (`core/rate-limit/`)

- **Алгоритъм:** fixed window. `INCR key` → ако е 1, `EXPIRE key window NX` (Redis 7) → ако броят
  > лимита, `TTL key` за `retryAfterSec`. `NX` прави прекъснат `INCR`/`EXPIRE` безвреден. Три
  > команди, не Lua: тестват се с фалшив store.
- **API:** `createLimiter(store: RateLimitStore)` където `RateLimitStore = Pick<Redis, 'incr' |
'expire' | 'ttl'>`; връща `consume(key, limit, windowSec): Promise<{ allowed: boolean;
retryAfterSec: number }>`. Barrel-ът на `core` изнася готов `rateLimit = createLimiter(redis)`.
  Всички опити се броят, включително успешен вход — без „нулиране при успех".
- **Fail-open** при паднал Redis (прието): `consume` лови грешката, логва `console.error('rate-limit:
store unavailable', cause)` и връща `allowed: true`. Без Redis входът така или иначе не отваря
  сесия (AUTH-4), а `/api/{vcard,qr}` не зависят от Redis — fail-closed би ги свалил при инцидент,
  срещу ARC-3. Единствената цена е CPU от argon2 през прозореца на инцидента — статуквото.
- **`clientIpFrom(headers)`:** чист helper, приема `Headers` (не вика `next/headers` — `core` остава
  без Next, за да може seed бъндълът да го внася). Чете `x-real-ip`, trim; липсва/празно →
  `'unknown'` (един общ bucket; в dev без nginx всички са там). **Не чете XFF.**
- **`policy.ts`:** една таблица с прагове и строители на ключове:
  - `rl:login:email:<lower(email)>` — 5 / 900 s; `rl:login:ip:<ip>` — 20 / 900 s (общи за админ и
    клиентски вход — същите акаунти, AUTH-7)
  - `rl:register:ip:<ip>` — 3 / 3600 s
  - `rl:action:user:<userId>` — 60 / 60 s
  - `rl:api:ip:<ip>` — 60 / 60 s (общ bucket за vcard и qr)
  - `tooManyMessage(retryAfterSec)` → `'Твърде много опити. Опитай след X минути.'`, X =
    `max(1, ceil(sec/60))`.

### 3.2 Къде се вика

- `signIn` (`actions.ts:39` → преди `openSession`): `ip = clientIpFrom(await headers())`; `consume`
  за имейл и за IP (и двата се броят); ако някой откаже → `{ ok: false, message:
tooManyMessage(max(retryAfter)) }`. Примамката и `findAdminByEmail` **не** се викат — лимитът е
  преди базата и argon2. Извън `try` около `openSession`.
- `signInUser` (`user-actions.ts:48`): идентично, същите ключове.
- `register` (`user-actions.ts:88` → преди `registerAccount`): само IP ключ.
- `createProfileAction` / `saveProfileAction` / `deleteProfileAction`: след `requireCurrent()`
  (нужен е `user.id`), преди `isOrgMember`; отказ → `failure(tooManyMessage(...))`.
- `vcard`/`qr` `GET`: след `slugSchema` (невалиден slug остава 404 без Redis), преди
  `findPublicProfileBySlug`; `ip = clientIpFrom(req.headers)`; отказ → `429`, тяло `Too many
requests`, headers `Retry-After: <sec>`, `Cache-Control: no-store`.

### 3.3 Seed в образа

- `package.json`: `build:seed` = esbuild на `scripts/db/seed-admin.ts` със същите флагове като
  `build:migrate` + `--external:argon2` → `.next/standalone/seed-admin.mjs`; `build` вика и него.
  `argon2` се резолва от `.next/standalone/node_modules/argon2`. `postgres`/`ioredis`/`zod`/
  `drizzle-orm` се бъндълват; Redis не се свързва (`lazyConnect`).
- `isDirectRun` (`seed-admin.ts:116-117`) сравнява `argv[1]` с `import.meta.url` — програмистът
  проверява с `node .next/standalone/seed-admin.mjs --email …` локално; ако `main()` не тръгва,
  условието се коригира.
- Dockerfile: ред 34 копира целия `standalone` — `seed-admin.mjs` влиза без нов ред.
- `docs/go-live.md` § 5 „Първи админ": командата по образеца на `deploy.sh:72-84` — същият обелен
  `.env`, `--network dcards-internal-prod`, `-e DATABASE_URL=…@postgres:5432/…`, `-e
REDIS_URL=redis://redis:6379`, образ `dcards-app-prod:latest`, `node seed-admin.mjs --email …
--password …`. Бележка: паролата в командния ред остава в shell history — препоръка за
  `SEED_ADMIN_PASSWORD` през `-e` от `read -s`.

### 3.4 Нощен backup (`scripts/remote/backup.sh`)

- `set -euo pipefail`; `cd /opt/dcards; set -a; . ./.env; set +a`; `log()`/`fail()` на английски.
- **База:** `docker exec dcards-postgres-prod pg_dump --no-owner --no-acl -U … | gzip >
/backup/dcards/daily/db_<YYYY-MM-DD_HH-MM>.sql.gz` — после `gzip -t` и `zcat … | head -3 | grep
-q 'PostgreSQL database dump'`. Провал → ненулев код, без частичен файл.
- **Uploads:** `docker volume inspect dcards-uploads-data-prod --format '{{.Mountpoint}}'` →
  `tar -czf /backup/dcards/daily/uploads_<same>.tar.gz -C <mountpoint> .`.
- **Ротация:** `find /backup/dcards/daily -name '*.gz' -mtime +14 -delete` — след успешен нов
  архив, не преди.
- **Не** пипа pre-deploy dump-овете; **не** архивира `.env`. Offsite — отделен цикъл.
- Инсталиране (диригент, с потвърждение; описва се в `go-live.md` § 6): `scp
scripts/remote/backup.sh pagagal:/opt/dcards/backup.sh`, `chmod 750`, `mkdir -p
/backup/dcards/daily`; root crontab: `0 3 * * * /opt/dcards/backup.sh >>
/var/log/dcards-backup.log 2>&1` (pagagal е в 03:20 — не се застъпват); първи ръчен пуск.

## 4. Какво НЕ се пипа

- Времето на примамката и `ARGON2_OPTIONS` (AUTH-4/AUTH-6) — лимитът стои преди тях.
- `session.ts`, TTL и cookie-то; `readSession` fail-null остава.
- Смяна на парола (OPS-2), потвърждение на имейл, CAPTCHA, WAF, nginx `limit_req`, `dcards-proxy.stpl`.
- Zod схемите на входа — имейлът се нормализира в ключа, не в схемата.
- `seed-admin.ts` логиката, `seed-demo.ts`, `migrate.ts`, `deploy.sh`, `bootstrap-prod.ps1`.
- Retention на pre-deploy dump-овете; restic, offsite, `.env` в архива.
- `docker-compose.prod.yml` и томовете; никакви `docker` команди към съседите (INF-1).
- Инсталирането на cron и качването на `backup.sh` са прод промени — диригентът (PRC-2).
- Не се въвежда `server-only` в `core` — `clientIpFrom` е чист именно затова.

## 5. Приемни критерии

- [ ] 6-и опит за вход с един и същ имейл (без оглед на регистъра) в рамките на 15 мин → „Твърде
      много опити…", дори с вярна парола; `verify`/примамката не се викат.
- [ ] 21-и опит за вход от един `X-Real-IP` за 15 мин с различни имейли → отказ.
- [ ] 4-та регистрация от един IP в рамките на час → отказ; първите три минават.
- [ ] 61-во извикване на `saveProfileAction` от един потребител за 1 мин → `{ ok: false, message }`.
- [ ] 61-ва заявка към `/api/vcard/{slug}` или `/api/qr/{slug}` (общ брояч) от един IP за 1 мин →
      `429`, `Retry-After`, `Cache-Control: no-store`; невалиден slug остава 404 без Redis.
- [ ] Липсващ `X-Real-IP` → bucket `unknown`; XFF не влияе на ключа.
- [ ] Паднал Redis → всички пътища се държат както преди цикъла; в лога има `rate-limit: store
unavailable`.
- [ ] `pnpm build` произвежда `.next/standalone/seed-admin.mjs`; `docker run … node seed-admin.mjs`
      срещу прод стека печата `admin created`, второто пускане — `user already exists`.
- [ ] `backup.sh` при ръчен пуск създава `db_*.sql.gz` (валиден gzip с `PostgreSQL database dump`)
      и `uploads_*.tar.gz`; старите се трият само след успешен нов архив; провал → ненулев код без
      частичен файл.
- [ ] Изходът на `backup.sh` и на seed бъндъла е на английски.

## 6. Как се проверява

**Машинно:** `pnpm verify`; `pnpm build && node --env-file=.env .next/standalone/seed-admin.mjs
--email t@x.bg --password correct-horse-1`; `bash -n scripts/remote/backup.sh`.

Тестове: `limiter.test.ts` (фалшив store: под лимита → allowed; на лимита → `retryAfterSec` = TTL;
`expire` с `NX` само при първи опит; store хвърля → allowed + `console.error`); `client-ip.test.ts`
(x-real-ip, липсва → `unknown`, XFF се игнорира); в `actions.test.ts`/`user-actions.test.ts` —
мокът на `@/modules/core` получава `rateLimit.consume`; при отказ → съобщението, `verifySpy` и
`findByEmailWithHash` не са викани; ключът по имейл е с малки букви; `register` при отказ не вика
`registerAccount`.

**Ръчно:** 1. Локално: `/admin/login`, 6 пъти един имейл → шестият дава „Твърде много опити…";
`redis-cli keys 'rl:*'`. 2. Прод (диригент): `ssh pagagal /opt/dcards/backup.sh` → `ls
/backup/dcards/daily`; `zcat db_*.sql.gz | head -3`. 3. Прод (диригент): seed командата с тестов
имейл → вход в `/admin`.

**Регресия:** вход с вярна парола на първи опит; едно съобщение за грешна парола (`REJECTED`);
`/api/qr` остава `public, max-age=86400` при 200; `migrate.mjs` и deploy-ът — `build` вика и
`build:seed`; pre-deploy dump-овете не се трият.

## 7. Блокиращи въпроси

Няма. Приети: fail-open; успешният вход също се брои; IP само от `X-Real-IP`.
