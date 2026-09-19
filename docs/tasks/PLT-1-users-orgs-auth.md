# `PLT-1` — Потребители, организации и истински вход

**Тежест:** голяма — първа миграция на схемата (три таблици) + смяна на източника на админ
акаунта в `auth`. Пуска `security`.
**Заявено:** 2026-09-19
**Сверено с кода:** 2026-09-19 — всеки `файл:ред` по-долу е отворен наново, не преписан от
заявката.

## Дневник на етапите

| Етап         | Изпълнител | Кога       | Резултат                                         |
| ------------ | ---------- | ---------- | ------------------------------------------------ |
| анализ       | analyzer   | 2026-09-19 | задание                                          |
| код          | programmer | 2026-09-19 | готово; 5 отклонения приети (виж worklog)        |
| ревю         | reviewer   | 2026-09-19 | готово с уговорки → open-items                   |
| сигурност    | security   | 2026-09-19 | 3 находки, поправени от диригента                |
| тестове      | programmer | 2026-09-19 | 18 + 7 (диригент) теста; curl/Playwright на живо |
| документация | диригентът | 2026-09-19 | AUTH-5/6, DAT-5/6, INF-5, worklog, open-items    |

## 1. Какво не е наред

Админът влиза с имейл/парола от `.env` (AUTH-5) — няма таблица `users`, няма организации, а
базата е без нито една миграция (`drizzle/meta/_journal.json` е празен). Етап 1 не може да
започне, преди потребителите и организациите да съществуват като данни и входът да чете от тях.

**Сверка със заявката — разлики:**

- `admin-account.ts:50-64` — потвърдено: `findAdminByEmail` е единственото място с env ключове.
- `actions.test.ts:16-21` — **по-широко от заявеното**: тестът мокира `env()` с
  `ADMIN_BOOTSTRAP_*` и очаква `id: 'bootstrap'` (ред 65). „Auth не се пипа" важи за кода, но
  този тест се пренаписва задължително — иначе `pnpm verify` пада.
- `eslint.config.mjs:161` — **механизмът е описан грешно**: `'../*/*.schema'` стои в
  забранената група БЕЗ `!`, т.е. по семантиката на `no-restricted-imports` това е забрана, а
  съобщението на ред 163 го нарича изключение. FK импортът между модули ще спре на линта.
- `core/db/schema.ts:1-2` — коментарът вече казва, че регистърът внася файловете със схеми,
  не barrel-ите (цикъл през `client.ts`). Затова общите колони се внасят относително, не през
  `@/modules/core`.
- `docker-compose.dev.yml` е `postgres:18-alpine` → `uuidv7()` е налична нативно.
- Pagagal (`vitest.globalSetup.ts`, `vitest.setup.ts`, `vitest.env.ts`): образец-база с
  миграции + копие по тестов файл; контейнерите остават вдигнати; средата е твърдо зашита, не
  от `.env`.

## 2. Къде

| Файл                                                              | Редове       | Роля в промяната                                               |
| ----------------------------------------------------------------- | ------------ | -------------------------------------------------------------- |
| `src/modules/core/db/columns.ts`                                  | нов          | `primaryId()`, `createdAt()` — по pagagal `columns.ts`         |
| `src/modules/auth/user.schema.ts`                                 | нов          | таблица `users`                                                |
| `src/modules/auth/user.repository.ts`                             | нов          | SQL за `users` (единствено място)                              |
| `src/modules/platform/organization.schema.ts`                     | нов          | `organizations`, `org_members`, три `pgEnum`                   |
| `src/modules/platform/organization.repository.ts`                 | нов          | SQL за org + членство                                          |
| `src/modules/core/db/schema.ts`                                   | 4            | регистър: три `export *`                                       |
| `src/modules/core/db/client.ts`                                   | 15-16        | тип на изпълнителя (db или транзакция) за репозиториите        |
| `src/modules/core/index.ts`                                       | 1            | изнася новия тип                                               |
| `src/modules/auth/admin-account.ts`                               | 13-27, 46-64 | `findAdminByEmail` → репозиторий; `bootstrapPasswordHash` пада |
| `src/modules/auth/index.ts`                                       | 3-10         | изнася `createUser`, `findUserByEmail`, `PublicUser`           |
| `src/modules/platform/index.ts`                                   | 3            | изнася `createPersonalOrganization`                            |
| `src/modules/core/env.ts`                                         | 14-17        | двата ключа падат                                              |
| `.env.example`                                                    | 23-25        | двата реда падат; ред-указание за seed                         |
| `src/modules/auth/actions.test.ts`                                | 16-21, 64-68 | мок на репозиторий вместо env; uuid вместо `'bootstrap'`       |
| `drizzle/0000_*.sql`, `drizzle/meta/*`                            | генер.       | първата миграция — само през `pnpm db:generate`                |
| `scripts/db/seed-admin.ts`                                        | нов          | CLI: първи админ + лична org                                   |
| `docker-compose.test.yml`                                         | нов          | изолиран Postgres за тестове                                   |
| `vitest.env.ts`, `vitest.globalSetup.db.ts`, `vitest.setup.db.ts` | нови         | тестова среда, миграции, изолация                              |
| `vitest.config.ts`                                                | 15-34        | трети проект `db`                                              |
| `package.json`                                                    | 14-34        | `db:seed:admin`, `test:infra:down`                             |
| `eslint.config.mjs`                                               | 161          | съгласуване — виж § 3.1                                        |

## 3. Как (посока, не готов код)

### 3.1 Схеми

- **Къде живее `users`** (прието от диригента): `src/modules/auth/user.schema.ts`. Auth владее
  идентичността (имейл, хеш, `is_admin`, `email_verified_at`); платформата не бива да вижда
  `password_hash`. `organizations`/`org_members` са в `platform` и сочат `users` през
  `../auth/user.schema` — точно изключението на ARC-2.
- **Линтът:** ред 161 в `eslint.config.mjs` ще спре FK импорта. Ако `pnpm lint` наистина
  спре — `'../*/*.schema'` се маха от групата (съобщението остава; относителните импорти
  бездруго не се ограничават, по коментара на ред 152-153). Ако не спре — не се пипа, а
  находката се записва в ревюто.
- **ID:** `uuid` с `default(sql\`uuidv7()\`)` — нативно в PostgreSQL 18, сортируемо по време,
  без генерация в приложението; същото като pagagal. Не v4: губи подредбата без полза. Не
  serial: ID-та влизат в URL-и и сесии.
- **Timestamps:** `timestamp(..., { withTimezone: true, mode: 'date' })`, `created_at`
  `.notNull().defaultNow()`. Само `created_at` — § 5.1 не изисква `updated_at`; добавя се от
  цикъла, който първи редактира ред.
- **`users`:** `email text notNull` + `uniqueIndex` върху `lower(email)` (както pagagal);
  репозиторият търси през `lower()`, за да ползва индекса. `password_hash text notNull`,
  `name text notNull`, `email_verified_at` nullable, `is_admin boolean notNull default false`.
  Тип `PublicUser` без `passwordHash` с изрично изброяване (не `Omit`) — образец
  `users.schema.ts:61-77` в pagagal.
- **`organizations`:** `pgEnum('organization_type', ['personal','company'])`,
  `pgEnum('organization_plan', ['free','pro'])`, `plan` default `free`, `plan_expires_at`
  nullable, `owner_user_id` → `users.id` (`onDelete: 'restrict'` — org без собственик е
  невалидна). `org_members`: `pgEnum('org_member_role', ['owner','editor'])`, съставен PK
  `(org_id, user_id)`, `org_id` cascade, `user_id` cascade, индекс по `user_id` (§ 5.1:
  един user в много org).
- **Общи колони** се внасят с относителен път `../core/db/columns` — през barrel-а се цикли
  (`schema.ts:1-2`).
- **Миграция:** `pnpm db:generate --name init_users_orgs` → `drizzle/0000_init_users_orgs.sql`.
  Ръчна редакция на SQL-а — не (DAT-1). Сгрешена → трие се и се генерира наново.

### 3.2 Входът

- `findAdminByEmail` вика `user.repository.findByEmailWithHash` (не излиза от barrel-а);
  връща `null`, ако няма ред **или** `is_admin` е `false`. Така не-админът минава по
  същия път като непознат имейл — примамка, същото съобщение, същото време. `actions.ts`
  не се пипа.
- `AdminRecord` се сглобява от реда: `id` (uuid), `email`, `name`, `passwordHash`.
- `bootstrapPasswordHash` и коментарът на ред 13-16 падат; `decoyPasswordHash` и
  `verifyPassword` остават.
- Репозиториите приемат изпълнител (`db` или транзакция) като първи параметър — един тип в
  `client.ts`, изнесен през `@/modules/core`. Нужно е, за да е seed-ът атомарен през два
  модула без auth да внася platform.

### 3.3 Seed

- `pnpm db:seed:admin -- --email … --password … [--name …]`; липсващ аргумент се чете от
  `SEED_ADMIN_EMAIL/PASSWORD/NAME`; парола под 8 знака → отказ. Входът се валидира със Zod.
- Изход на английски (CLAUDE.md § 1). `tsx --env-file-if-exists=.env`, както `db:migrate`.
- Логика: в **една транзакция** `createUser` (auth хешира с argon2id, `isAdmin: true`,
  `emailVerifiedAt: now` — създаден от оператор, няма кого да потвърждава) →
  `createPersonalOrganization` (platform: org `type=personal`, `name` = името на
  потребителя, `owner_user_id`, плюс ред в `org_members` с `role=owner`).
- Идемпотентност: съществуващ имейл (без оглед на регистъра) → „admin already exists,
  nothing changed", изход 0. **Не** сменя парола и не повишава в админ.
- Логиката е в изнесена функция, CLI частта се изпълнява само при директно пускане — за да
  има тест.

### 3.4 Тестова база (вариант А, приет от диригента)

`docker-compose.test.yml` — `dcards-test-postgres`, `postgres:18-alpine`, `127.0.0.1:55434`,
tmpfs, `fsync=off`, без volume. `vitest.env.ts` с твърдо зашити `DATABASE_URL`/`REDIS_URL`/
`SESSION_SECRET` (не от `.env` — тест не бива да стигне до развойна база).
`vitest.globalSetup.db.ts`: `compose up -d`, чака healthcheck, пуска миграциите от `./drizzle`
в образец `dcards_test`; при развален образец го пресъздава. `vitest.setup.db.ts`:
`CREATE DATABASE … TEMPLATE` по тестов файл и `process.env.DATABASE_URL` към копието **преди**
да се внесе `core` (`client.ts:12` чете при импорт). Контейнерът остава вдигнат;
`pnpm test:infra:down` го спира. Нов vitest проект `db` с
`include: ['src/**/*.db.test.ts', 'scripts/**/*.db.test.ts']` — `node` и `dom` остават без
Docker. Redis не влиза в compose-а сега — `redis/client.ts:13` е `lazyConnect`.

### 3.5 Ред на работа

columns → схеми → регистър → `db:generate` → репозитории → тестова база → `admin-account`

- env → seed → тестове → проверки по пипнатото.

## 4. Какво НЕ се пипа

- `session.ts`, `current-admin.ts`, `actions.ts`, формата за вход, пазачът в
  `admin/(protected)/layout.tsx`, `LogoutButton` — готови и одитирани в ADM-1 (AUTH-4).
- Примамката `decoyPasswordHash` и общото съобщение `REJECTED` — не се променят.
- `SESSION_SECRET` в `env.ts:13` — стои (ADM-1 § 3.2, отделно решение).
- Регистрация на клиенти, покани, `/app`, `profiles`, `profile_links` — следващи цикли.
- `updated_at`, `last_login_at`, `is_active` — не се добавят „за после".
- `migrate.ts`, `build:migrate`, Dockerfile, деплой скриптовете — не се пипат.
- `docker-compose.dev.yml` и развойната база — тестовете НЕ я ползват (CLAUDE.md § 7).
- Никакъв ръчен SQL в `drizzle/*.sql`; никакъв SQL извън `*.repository.ts` (изключение:
  seed/тестовата инфраструктура за `CREATE DATABASE`).
- Промяна на парола/повишаване през seed — не.

## 5. Приемни критерии

- [ ] `pnpm db:migrate` на празна база минава; второ пускане казва „up to date" без грешка.
- [ ] `drizzle/0000_*.sql` е генериран, не писан; `pnpm db:generate` втори път не създава
      нова миграция (схемата и снимката съвпадат).
- [ ] `pnpm db:seed:admin` създава потребител с `is_admin = true`, `email_verified_at`
      попълнен, лична организация `type=personal, plan=free` с `owner_user_id` = потребителя
      и ред в `org_members` с `role=owner` — в една транзакция.
- [ ] Второ пускане на seed със същия имейл (и с друг регистър на буквите) не дублира, не
      променя парола, излиза с код 0 и го казва на английски.
- [ ] Seed с парола под 8 знака или невалиден имейл отказва, без да пише в базата.
- [ ] `/admin/login` с имейла/паролата от seed отваря сесия и води към `/admin`; регистърът
      на имейла няма значение.
- [ ] Потребител с `is_admin = false` получава „Грешен имейл или парола." — същото, което
      получава непознат имейл; хеш проверката се изпълнява и в двата случая (веднъж).
- [ ] `ADMIN_BOOTSTRAP_*` не съществуват никъде в `src/`, `.env.example`, `env.ts`; с тях в
      `.env` приложението стартира, без да ги чете.
- [ ] Тестовете за база вървят срещу `dcards-test-postgres` на 55434; развойната база на
      5433 остава недокосната.
- [ ] `pnpm test` минава без `.env` файл.
- [ ] `pnpm verify` минава с нула предупреждения; FK импортът `../auth/user.schema` не спира
      линта.

## 6. Как се проверява

**Машинно:**

```bash
pnpm verify                       # format, comments, typecheck, lint, test (вкл. проекта db)
pnpm db:generate                  # втори път: „No schema changes"
pnpm db:migrate && pnpm db:migrate
pnpm db:seed:admin -- --email a@x.bg --password correct-horse-1
pnpm db:seed:admin -- --email A@X.BG --password other-password-2   # nothing changed, exit 0
pnpm test:infra:down
```

**Ръчно** (`pnpm infra:up`, `pnpm db:migrate`, seed, `pnpm dev`, :3100):

1. `/admin/login` → seed имейл (с главни букви) + парола → `/admin`, името от seed в панела.
2. Същият имейл + грешна парола → „Грешен имейл или парола."
3. В `pnpm db:studio` сложи `is_admin = false` на потребителя → вход → същото съобщение.
4. Изход → `/admin/login`; `/admin` без сесия → пренасочва към login.
5. `.env` с оставени `ADMIN_BOOTSTRAP_*` → приложението стартира, входът с тях отказва.

**Регресия — какво НЕ трябва да се счупи:**

- Плъзгащата сесия (AUTH-4), изходът при паднал Redis (отказ, не преструвка).
- `pnpm build` → `migrate.mjs` в standalone; `docker build` с `drizzle/` вътре.
- `env.test.ts`, `nav-tree.test.ts` и `dom` проектът — вървят без Docker.
- Тестът за примамката (`actions.test.ts:36-42`) — `verify` се вика точно веднъж и за
  непознат имейл, и за не-админ.

## 7. Блокиращи въпроси

Няма. Двата избора (§ 3.1 къде живее `users`; § 3.4 вариант А) са приети от диригента.

**За документацията (не блокира):** AUTH-5 се заменя с „обръща AUTH-5 — админът е ред в
`users` с `is_admin`, първият се създава със seed"; нови решения за uuidv7 + timestamptz
(§ Данни) и за изолираната тестова база (§ Инфраструктура); `handover.md` споменава
`ADMIN_BOOTSTRAP_*`.
