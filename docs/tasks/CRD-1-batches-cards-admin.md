# `CRD-1` — Партиди и карти: схема, генериране, CSV, админ екрани

**Тежест:** голяма — нова схема (2 таблици, миграция `0002`), вечни публични идентификатори
(DAT-3), първите админ Server Actions и route handler с auth (AUTH-7).
**Заявено:** 2026-09-20
**Сверено с кода:** 2026-09-20 — всеки `файл:ред` по-долу е отворен наново, не преписан от заявката.

## Дневник на етапите

| Етап         | Изпълнител | Кога       | Резултат |
| ------------ | ---------- | ---------- | -------- |
| анализ       | analyzer   | 2026-09-20 | готово   |
| код          | programmer |            |          |
| ревю         | reviewer   |            |          |
| сигурност    | security   |            |          |
| тестове      | programmer |            |          |
| документация | secretary  |            |          |

## 1. Какво не е наред

Админът няма как да произведе карти: няма таблици за партиди и карти, няма генератор на
`card_id`/`activation_code`, няма CSV за писача на чипове и `/admin/batches`, `/admin/cards` са
заглушки. Етап 2 не може да започне без това; активацията и `/c/{id}` са CRD-2.

**Сверка с кода — разлики спрямо заявката:**

- `src/components/list/index.ts:1-11` НЕ изнася `PagePager` (само `CursorPager`). Не се ползва тук
  — детайлът на партида е ≤ 1000 реда и се рендира без прелистване.
- `DataTable` няма нито един консуматор в `src/app` — този цикъл е първият. Сигнатура:
  `data-table.tsx:75-81` (`caption, columns, rows, rowKey`), `Column.cell(row, index)`.
- `isUniqueViolation` има ДВЕ копия: `platform/profile.service.ts:154`, `auth/registration.ts:20`.
  Трето не се пише — виж § 3.1.
- `env.ts:10` — `APP_URL` default е `:3000`, `.env.example:6` — `:3100`. Не е в обхвата.
- `Admin` е `SessionUser` — носи `id`, което стига за `created_by` и за ключа на лимита.
- `RESERVED_SLUGS` вече пази `c` — `/c/{id}` не се бие със slug.

## 2. Къде

| Файл                                                              | Редове  | Роля в промяната                                                       |
| ----------------------------------------------------------------- | ------- | ---------------------------------------------------------------------- |
| `src/modules/platform/card.schema.ts`                             | нов     | главна: `card_batches`, `cards`, enum `card_status`                    |
| `src/modules/platform/card-id.ts`                                 | нов     | главна: чист генератор (азбука, дължина, код) — без db                 |
| `src/modules/platform/card-url.ts`                                | нов     | `cardUrl(base, id)` по образец `profile-url.ts`                        |
| `src/modules/platform/card-csv.ts`                                | нов     | чиста функция `buildCardsCsv(rows, base)`                              |
| `src/modules/platform/card.repository.ts`                         | нов     | целият SQL за двете таблици                                            |
| `src/modules/platform/batch.service.ts`                           | нов     | създаване (транзакция + retry), списък, детайл, „записани", редове CSV |
| `src/modules/platform/card.service.ts`                            | нов     | `CardError`, `cardIdSchema`, търсене за админ, откачане, деактивация   |
| `src/modules/platform/index.ts`                                   | 1-41    | съгласуване: изнася новото                                             |
| `src/modules/core/db/schema.ts`                                   | 4-6     | съгласуване: регистрира `card.schema`                                  |
| `src/modules/core/db/errors.ts`, `core/index.ts`                  | нов / 4 | `isUniqueViolation` на едно място (§ 3.1)                              |
| `src/modules/core/env.ts`, `.env.example`                         | 10 / 6  | `CARD_URL_BASE` (§ 3.4)                                                |
| `drizzle/0002_*.sql`                                              | нов     | само от `drizzle-kit generate` (DAT-1)                                 |
| `src/app/admin/(protected)/current.ts`                            | нов     | `requireAdmin()` по образец `app/(protected)/current.ts`               |
| `src/app/admin/(protected)/rate-limit.ts`                         | нов     | `adminActionLimit()` по образец `app/(protected)/rate-limit.ts`        |
| `src/app/admin/(protected)/batches/{page,actions,schema}.ts(x)`   | замяна  | списък + Server Actions                                                |
| `src/app/admin/(protected)/batches/new/{page,new-batch-form}.tsx` | нов     | форма (образец `profiles/new/new-profile-form.tsx`)                    |
| `src/app/admin/(protected)/batches/[id]/page.tsx`                 | нов     | детайл с `DataTable`                                                   |
| `src/app/admin/(protected)/cards/{page,actions,card-detail}.tsx`  | замяна  | търсене + детайл + действия                                            |
| `src/app/admin/api/batches/[id]/export/route.ts`                  | нов     | CSV handler (образец `api/qr/[slug]/route.ts`)                         |

Всеки файл под 300 реда (COD-1); колоните на таблицата — в отделен `columns.tsx`, ако прехвърли.

## 3. Как (посока, не готов код)

### 3.1 Схема (`card.schema.ts`, `zadanie.md` § 5.3)

- `card_batches`: `id` (`primaryId()`), `name text not null`, `quantity integer not null`,
  `created_by uuid → users.id onDelete restrict`, `created_at`. Без `updated_at`.
- `cards`: `id text PK` — **не** uuid; `batch_id uuid not null → card_batches restrict` (картите
  са вечни — партида с карти не се трие); `activation_code text not null`; `status card_status
not null default 'blank'`; `org_id uuid null → organizations restrict`; `profile_id uuid null →
profiles set null` (картата остава в org като неразпределена, § 5.3); `written_at`,
  `activated_at` timestamptz null.
- Enum `card_status`: `blank|written|assigned|active|disabled` — точно този ред.
- Индекси: `cards_status_idx`, `cards_batch_idx`, `cards_org_idx`, `cards_profile_idx`;
  `uniqueIndex('cards_batch_code_idx').on(batchId, activationCode)`.
- CHECK (образец `profile.schema.ts`, `sql.raw`): `id ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6,8}$'`,
  `activation_code ~ '^[0-9]{6}$'`.
- **`order_id` НЕ се добавя сега** — идва с FK в етап 3 заедно с `orders`.
- **`activation_code` в чист вид** (прието): кодът е физически на картата и CSV-то трябва да го
  отпечата; 6 цифри = 1M стойности, офлайн обръщане на хеш е тривиално; истинската защита е rate
  limit по `card_id` при активация (CRD-2, AUTH-9).
- `isUniqueViolation` се премества в `core/db/errors.ts` и излиза през barrel-а; двете
  съществуващи копия **не се пипат**.

### 3.2 Генериране (`card-id.ts`, чисто; DAT-3)

- `CARD_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'` (32 знака), `CARD_ID_LENGTH = 8`.
  32⁶ ≈ 1.07·10⁹ прави сляпото отгатване реалистично при десетки хиляди карти; 32⁸ ≈ 1.1·10¹².
- `randomBytes(8)` → всеки байт `& 31` → знак. 256 се дели на 32 — няма modulo bias.
- `activation_code`: `randomInt(0, 1_000_000)` → `padStart(6, '0')`.
- Уникалност на кода **в партидата**: дедуп в паметта (`Set`) ПРЕДИ insert-а; уникалният индекс е
  втора линия.
- Уникалност на `card_id` е глобална (PK). Една транзакция — insert на batch, insert на всичките
  N карти; при `isUniqueViolation` → транзакцията пада, регенерира се целият набор, до 3 пъти,
  после `CardError('id_collision')`. Генераторът се подава като **опционален параметър** на
  `createBatch` — db тестът инжектира сблъсък без `vi.mock` на `crypto`.
- `quantity`: Zod `int().min(1).max(1000)`. `name`: `trim().min(1).max(80)`.
- `createBatch(executor, input, generate?)` валидира целия вход със Zod (DAT-8); `createdBy` идва
  от `requireAdmin()`, никога от формата.

### 3.3 Сервиз и репозиторий

- `listBatches` — GROUP BY по `batch_id, status`, сглобен в `BatchSummary { id, name, quantity,
written, active, createdAt }` (записани = `status ≠ blank`, активни = `active`).
- `getBatch(id)` → `null` или детайл с всички карти `{ id, activationCode, status, orgName|null,
profileName|null }` (LEFT JOIN, изрични полета — DAT-7).
- `markBatchWritten(id)` — `UPDATE … SET status='written', written_at=now() WHERE batch_id=$1 AND
status='blank'` → връща броя; повторно → 0, без грешка.
- `findCardForAdmin(id)` → `null` или `{ id, batchId, batchName, activationCode, status, org:
{id,name}|null, profile: {id,name,slug}|null, writtenAt, activatedAt }`.
- `detachCardProfile(id)` — `profile_id = null`; `disableCard(id)` — `status='disabled'`,
  `org_id`/`profile_id` остават. Връщане от `disabled` не се моделира тук. И двете →
  `CardError('card_not_found')` при непозната карта.
- `cardIdSchema`: `z.string().trim().toUpperCase()` → regex от азбуката, 6–8 знака. Точно търсене.

### 3.4 Адрес на картата и CSV

- `env.ts`: `CARD_URL_BASE: z.url().optional()`; `cardUrl(env().CARD_URL_BASE ?? env().APP_URL,
id)` → `${base}/c/${id}`. Въвежда се сега, за да не се презаписват CSV-та при купуване на
  краткия домейн. `.env.example` — коментиран ред.
- `buildCardsCsv(rows, base)`: заглавие `card_id,url,activation_code`, CRLF (RFC 4180), без BOM,
  без кавички. Кодът е с водещите нули (Excel ги реже — печатницата отваря текстовия файл).
- Handler `GET /admin/api/batches/{id}/export` (извън `(protected)` — layout-ът не важи за
  handlers): `z.uuid()` на `id` → иначе 404; `getCurrentAdmin()` **в handler-а** → `null` → 404;
  `adminActionLimit(admin.id)` → 429 с `Retry-After`; партида няма → 404. Headers: `Content-Type:
text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="cards-<id>.csv"`,
  `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`. `force-dynamic`.

### 3.5 Пазач и лимит на админа

- `requireAdmin(): Promise<Admin>` — `getCurrentAdmin()` → `null` → `redirect('/admin/login')`.
  Всяка страница и action го викат САМИ (AUTH-7).
- `adminActionLimit(adminId)` — същата политика и ключ `RATE_POLICY.actionUser`.
- Ред в action: Zod → `requireAdmin()` (извън `try`) → лимит → сервиз в `try` с `CardError` →
  съобщение; неочаквано → лог само `cause` (DAT-6) + общо съобщение; `revalidatePath`.

### 3.6 Екрани (`zadanie.md` § 7.3)

- `/admin/batches` — `DataTable`: име (линк), брой, записани/брой, активни, дата; „CSV" (`<a
download>`) и „Маркирай записаните" (форма; деактивиран при записани = брой). Празно →
  `ListState` с бутон „Нова партида".
- `/admin/batches/new` — клиентска форма (име, брой); успех → `redirect` към детайла.
- `/admin/batches/[id]` — `z.uuid()` иначе `notFound()`; шапка; `DataTable` с id (линк към
  `/admin/cards?id=…`), код, статус (`Badge`: blank neutral · written info · assigned warning ·
  active success · disabled danger), организация, профил.
- `/admin/cards` — `SearchFilter paramKey="id"`; `?id=` → `cardIdSchema`; невалиден/липсващ →
  `ListState`; намерена → детайл + „Откачи от профила" (само при `profile_id`), „Деактивирай"
  (само при статус ≠ `disabled`, с потвърждение).
- Всички страници са server components, викат `requireAdmin()` първо.

## 4. Какво НЕ се пипа

- `/c/{id}`, активация с код, `/app/cards`, `scans` — CRD-2.
- `orders`, `order_id`, статус `assigned` като преход — етап 3.
- Двете съществуващи копия на `isUniqueViolation`.
- `RATE_POLICY` — без нова политика; `userActionLimit` не се мести.
- `getCurrentAdmin`, layout-ът на `/admin` — пазачът се ДОБАВЯ в страниците, не се заменя.
- `APP_URL` default в `env.ts`.
- Връщане на карта от `disabled`, редакция на `card_id`/`activation_code` (правило 9), изтриване
  на партида или карта — не съществуват като действия.
- Ръчно маркиране „записана" по отделни карти — отделен цикъл. Сайдбарът и `nav-tree.ts`.

## 5. Приемни критерии

- [ ] `pnpm db:migrate` от чиста база създава `card_batches`, `cards`, enum, 4 индекса,
      уникалността `(batch_id, activation_code)` и двата CHECK-а; миграцията е `0002_*`.
- [ ] Партида „Тест", 50 → точно 50 карти `blank`, `id` от 8 знака само от азбуката, код 6 цифри,
      уникален в партидата; една транзакция.
- [ ] Брой 0, 1001, нецяло или празно име → отказ, нищо не се записва.
- [ ] Инжектиран генератор с повторен `id` → повторен опит и уникални id; генератор с постоянен
      → грешка след 3 опита и нулев остатък.
- [ ] „Маркирай записаните" сменя само `blank` → `written` с `written_at`; повторно — без промяна.
- [ ] `GET /admin/api/batches/{id}/export` без админ → 404; с админ → 200, `text/csv`,
      `attachment`, `no-store`, заглавие, CRLF, URL = base + `/c/` + id, код с водещи нули.
- [ ] Липсващ `CARD_URL_BASE` → `APP_URL`; зададен → от него.
- [ ] Admin страниците без сесия → `/admin/login`; с клиентска сесия → също, `/app` остава.
- [ ] Admin action/handler → съобщение/429 след 60 извиквания в минута.
- [ ] `/admin/cards?id=abcd2345` намира `ABCD2345`; `?id=O1234567` → „Няма карта", без заявка.
- [ ] „Откачи" нулира `profile_id`; „Деактивирай" дава `disabled`, `org_id`/`profile_id` остават;
      бутоните липсват, когато са безсмислени.
- [ ] Изтриване на профил от `/app` не се проваля заради карта; картата остава с `profile_id = null`.
- [ ] Нито един файл над 300 реда; `pnpm verify` минава.

## 6. Как се проверява

**Машинно:** `pnpm verify`. Тестове: node `card-id.test.ts` (10 000 id без `0/O/1/I`, без дубли;
padding; `cardIdSchema`), `card-csv.test.ts`, `env.test.ts` (`CARD_URL_BASE`); db
`batch.service.db.test.ts` (създаване, граници, retry с инжектиран генератор, 3 провала без
остатък, „записани" идемпотентно, FK `set null`/`restrict`), `card.service.db.test.ts`; node
`batches/actions.test.ts`, `cards/actions.test.ts`, `export/route.test.ts`; dom
`new-batch-form.test.tsx`.

**Ръчно:** 1. вход като админ. 2. „Нова партида" „Първа", 20 → детайл с 20 `blank`. 3. „CSV" →
`cards-<id>.csv`, 21 реда, URL с `APP_URL/c/`. 4. `CARD_URL_BASE` в `.env` → URL-ите се сменят. 5. „Маркирай записаните" → 20/20; пак → без промяна. 6. `/admin/cards` с малки букви → детайл;
„Деактивирай". 7. частен прозорец: `/admin/batches` → login; export → 404. 8. клиент →
`/admin/batches` → login; `/app` работи.

**Регресия:** изтриване на профил (FK `set null`); `/admin` табло и layout; seed скриптове; db
тестовете с новата миграция; `/api/qr`, `/api/vcard`, `/{slug}`.

## 7. Блокиращи въпроси

Няма.
