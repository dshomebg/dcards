# `CRD-2` — Маршрутизатор `/c/{id}`, активация през чип и код, `/app/cards`

**Тежест:** голяма — публична повърхност без auth с вход от потребител (card id, код), пише
собственост (`org_id`/`profile_id`), права (AUTH-2), нова таблица `scans` (миграция `0003`), пипа
`auth` (`?next=`) и `RATE_POLICY`.
**Заявено:** 2026-09-20
**Сверено с кода:** 2026-09-20 — всеки `файл:ред` по-долу е отворен наново, не преписан от заявката.

## Дневник на етапите

| Етап         | Изпълнител | Кога       | Резултат                                                        |
| ------------ | ---------- | ---------- | --------------------------------------------------------------- |
| анализ       | analyzer   | 2026-09-20 | готово                                                          |
| код          | programmer | 2026-09-20 | готово; 6 отклонения приети                                     |
| ревю         | reviewer   | 2026-09-20 | готово с уговорки — BG съобщение за card id поправено           |
| сигурност    | security   | 2026-09-20 | 1 средна поправена (scan лимит, IPv6 /64); 1 ниска → open-items |
| тестове      | programmer | 2026-09-20 | 332 + 5; Playwright пълен поток от чипа                         |
| документация | диригентът | 2026-09-20 | DAT-10, worklog, open-items, roadmap                            |

## 1. Какво не е наред

Записана карта, допряна до телефон, отваря `/c/{id}` — маршрут, който не съществува (404 за
всяка карта). Клиентът няма как да активира карта нито през чипа, нито с код, а `/app/cards` е
`ComingSoon`. Сканирания не се записват (§ 5.4). Етап 2 не е завършен.

**Сверка с кода — разлики спрямо заявката:**

- `signInUser`/`register` (`user-actions.ts:62,122`) пренасочват твърдо към `/app`;
  `login/page.tsx:19` също. `?next=` не съществува никъде — трябва да се въведе (§ 3.6).
- `userActionLimit` връща **съобщение**, `adminActionLimit` — **секунди**. Тук се следва
  клиентският договор.
- `requireCurrent` винаги `redirect('/login')` — за `/c/{id}` (публична) трябва вариант, който
  връща `null` (§ 3.4).
- `clearCardProfile` (`card.repository.ts:175`) оставя `status='active'` с `profile_id=null` —
  единственият източник на състоянието „unlinked" (§ 3.3).
- `RESERVED_SLUGS` пази `c`. `CardErrorCode` е затворен union — разширява се.

## 2. Къде

| Файл                                                                   | Редове            | Роля в промяната                                             |
| ---------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------ |
| `src/modules/platform/scan.schema.ts`                                  | нов               | главна: `scans` + enums (§ 3.1)                              |
| `src/modules/platform/scan.repository.ts`                              | нов               | `insertScan`                                                 |
| `src/modules/platform/scan-device.ts`                                  | нов               | чиста `classifyDevice(ua)`                                   |
| `src/modules/platform/card-router.ts`                                  | нов               | чиста `resolveCard(row)` (§ 3.2)                             |
| `src/modules/platform/card-activation.service.ts`                      | нов               | главна: активация, claim, org-действия (§ 3.3)               |
| `src/modules/platform/card.repository.ts`                              | 174-198           | нови заявки: route row, `lockCard`, org-scoped update/list   |
| `src/modules/platform/card.service.ts`                                 | 13-19             | нови `CardErrorCode` + съобщения                             |
| `src/modules/platform/index.ts`                                        | 14-30             | съгласуване: изнася новото                                   |
| `src/modules/core/db/schema.ts`                                        | 4-7               | регистрира `scan.schema`                                     |
| `src/modules/core/rate-limit/policy.ts`                                | 8-32              | `claimUser`, `claimCard` политика + ключове (§ 3.5)          |
| `drizzle/0003_*.sql`                                                   | нов               | само от `drizzle-kit generate` (DAT-1)                       |
| `src/modules/auth/schema.ts`, `user-actions.ts`, `index.ts`            | 1-42 / 47,87 / 29 | `safeNextPath`, `next` параметър на вход/регистрация (§ 3.6) |
| `src/app/(auth)/login/{page,login-form}.tsx`, `register/{…}`           | 15-19 / 27        | четат `?next=`, подават го на action-а                       |
| `src/app/c/[id]/page.tsx`, `activate-form.tsx`, `rate-limit.ts`        | нов               | главна: маршрутизаторът (§ 3.4)                              |
| `src/app/app/(protected)/current.ts`                                   | 20-30             | `loadCurrent(): Current \| null`; `requireCurrent` го ползва |
| `src/app/app/(protected)/rate-limit.ts`                                | 8-17              | `claimLimit(userId, cardId)`                                 |
| `src/app/app/(protected)/cards/{page,actions,schema}.ts(x)`            | замяна            | списък + Server Actions (§ 3.7)                              |
| `src/app/app/(protected)/cards/{claim-card-form,card-row}.tsx`         | нов               | клиентски форми                                              |
| `src/app/app/(protected)/profiles/new/{page,new-profile-form,actions}` | 9-22 / 27 / 27-56 | `?card=` пренасяне (§ 3.4)                                   |

Всеки файл под 300 реда (COD-1).

## 3. Как (посока, не готов код)

### 3.1 Схема `scans` (§ 5.4, DAT-4)

- `id` `primaryId()`; `card_id text not null → cards.id restrict`; `profile_id uuid null → profiles
set null`; `scanned_at timestamptz not null default now()`; `source` enum `scan_source`
  `nfc|qr|direct`; `device` enum `scan_device` `ios|android|other`; `country text null` + CHECK
  `^[A-Z]{2}$`. Без IP, без UA, без `updated_at`.
- Индекси: `scans_card_time_idx (card_id, scanned_at)`, `scans_profile_time_idx (profile_id, scanned_at)`.
- `classifyDevice(ua: string | null)`: `/iPhone|iPad|iPod/i` → `ios`, `/Android/i` → `android`,
  иначе `other`. Суровият UA не напуска функцията.
- `country` — винаги `null` в този цикъл (няма CF proxy, INF-4).

### 3.2 `resolveCard` (чиста, `card-router.ts`)

Вход: `null` или `{ id, status, orgId, profileId, profileSlug }` (нова заявка `findCardForRoute`,
LEFT JOIN profiles, изрични полета — DAT-7). Изход, дискриминиран по `kind`:

| ред                           | kind        | страницата прави                                                 |
| ----------------------------- | ----------- | ---------------------------------------------------------------- |
| `null`                        | `not_found` | `notFound()`                                                     |
| `blank`                       | `not_found` | 404 — картата не е минала през писача; сервизите също я отказват |
| `disabled`                    | `inactive`  | „Картата не е активна", 200 + `robots: noindex`                  |
| `active` + `profileSlug`      | `redirect`  | insert в `scans` → `redirect('/{slug}')` (307)                   |
| `active` + `profileId = null` | `unlinked`  | „Картата не е свързана с профил" + линк `/app/cards`             |
| `written` \| `assigned`       | `activate`  | екранът за активация (§ 3.4), носи `orgId`                       |

- Скрит профил → пак `redirect`; 404-ът идва от `/{slug}` (DAT-7). Сканирането се записва.
- 307, не 308 — профилът се сменя от dashboard-а (DAT-3).
- `blank` → 404 (прието): при забравено „Маркирай записаните" админът го оправя от `/admin/batches`.

### 3.3 Активация и claim (`card-activation.service.ts`, DAT-8, AUTH-2)

Всяка функция валидира целия вход със Zod (`cardIdSchema`, `z.uuid()`, `^\d{6}$`). Всяка пише
`org_id` **в WHERE**, никога само в SET. Нови `CardErrorCode`: `card_unclaimable` („Картата или
кодът не съвпадат."), `card_foreign_org` („Картата принадлежи на друга организация."),
`card_already_active` („Картата вече е активирана."), `card_disabled` („Картата не е активна."),
`profile_not_found` („Профилът не е в тази организация.").

- **`activateCard(executor, { cardId, orgId, profileId })`** — транзакция: `lockCard` (`FOR
UPDATE`) → класификация: няма/`blank` → `card_unclaimable`; `disabled` → `card_disabled`; `active`
  → `card_already_active`; `org_id` зададен и ≠ `orgId` → `card_foreign_org`. После `UPDATE cards
SET status='active', org_id, profile_id, activated_at=now() WHERE id AND status IN
('written','assigned') AND (org_id IS NULL OR org_id=$org) AND EXISTS (SELECT 1 FROM profiles
WHERE id=$p AND org_id=$org)` → 0 реда → `profile_not_found`. Guard-овете са и в WHERE нарочно.
- **`claimCardByCode(executor, { cardId, activationCode, orgId })`** (§ 6.2) — същата
  транзакция; кодът се сравнява с `timingSafeEqual` (6 ASCII байта); грешен код, непозната карта
  и `blank` дават **едно** съобщение `card_unclaimable`. `org_id` ≠ `orgId` → `card_foreign_org`;
  `active` → `card_already_active`. Успех: `status='assigned', org_id=$org`. Повторен claim в
  същата org → успех без промяна.
- **`assignCardProfile(executor, { cardId, orgId, profileId })`** — един `UPDATE … SET
profile_id, status='active', activated_at=coalesce(activated_at, now()) WHERE id AND org_id=$org
AND status IN ('assigned','active') AND EXISTS(профил в org)` → 0 реда → `card_not_found`.
- **`unassignCardProfile(executor, { cardId, orgId })`** — `SET profile_id=null,
status='assigned' WHERE id AND org_id AND status='active'`. Различава се от админския
  `detachCardProfile` (оставя `active`) съзнателно.
- **`disableCardByOrg(executor, { cardId, orgId })`** — `SET status='disabled' WHERE id AND org_id
AND status <> 'disabled'`. Терминално.
- **`listCardsByOrg(executor, orgId)`** → `{ id, status, profile: {id, name, slug} | null,
activatedAt }[]`, изрични полета, ред по `activated_at desc, id`.

### 3.4 `/c/[id]/page.tsx` (публична, `force-dynamic`, образец `[slug]/page.tsx`)

1. Лимит по IP (§ 3.5) — преди всякаква заявка; отказ → страница „Твърде много заявки", без db.
2. `cardIdSchema` → невалиден → `notFound()` без заявка.
3. `findCardForRoute` → `resolveCard`. При `redirect`: `insertScan({ cardId, profileId, source:
'nfc', device: classifyDevice(headers['user-agent']), country: null })` в `try/catch` с `await`;
   провалът се логва (DAT-6) и НЕ спира redirect-а. `redirect()` — СЛЕД `try`.
4. При `activate`: `loadCurrent()` (нов в `current.ts`: `null` без сесия).
   - Без сесия: „Вход" → `/login?next=/c/{id}` и „Регистрация" → `/register?next=/c/{id}`.
   - Със сесия: `listProfiles(db, org.id)`; ако `row.orgId !== null && row.orgId !== org.id` →
     текст „Картата принадлежи на друга организация" без форма. Иначе `ActivateForm` (клиентска):
     `Select` от профилите + „Активирай" → `activateFromChipAction(cardId, profileId)`; при успех
     `redirect('/{slug}')`. Под формата: „Нов профил" → `/app/profiles/new?card={id}`.
5. `?card=` в `/app/profiles/new`: формата го подава на `createProfileAction(input, card)`;
   action-ът го парсва с `cardIdSchema` (невалиден → игнорира), при успех `redirect(card ? '/c/' +
card : '/app')`.
6. `metadata`: `robots: { index: false }` за всички изходи освен redirect.

### 3.5 Rate limit (AUTH-9)

- `/c/{id}`: `rateKey.apiIp(clientIpFrom(await headers()))` с `RATE_POLICY.apiIp` — в
  `src/app/c/[id]/rate-limit.ts`.
- Нови политики: `claimUser: { 10, 3600 }`, `claimCard: { 5, 3600 }`; ключове
  `rl:claim:user:<id>`, `rl:claim:card:<cardId>`. `claimLimit(userId, cardId)` брои и двата преди
  сервиза. 5/час на карта прави 6-те цифри непреодолими.
- Fail-open при паднал Redis — за 6-цифрен код е известен риск; `open-items.md`.
- Останалите action-и: `userActionLimit`.

### 3.6 `?next=` без open redirect (`auth`)

- `safeNextPath(raw: unknown): string | null` в `auth/schema.ts`: приема САМО низ по
  `^/c/[A-Za-z0-9]{6,8}$`; всичко друго → `null`. Изнася се през barrel-а.
- `signInUser(input, next?)`, `register(input, next?)`: `redirect(safeNextPath(next) ?? '/app')`.
  `login/page.tsx` при вече влязъл → същото. Формите получават `next` от `searchParams` и го
  подават на action-а; action-ът валидира сам.

### 3.7 `/app/cards` и Server Actions (§ 7.2)

- Страница: `requireCurrent()` → `listCardsByOrg`. Празно → `ListState` + „Добави карта". Иначе
  `DataTable`: id (mono), статус (`Badge`), профил (име + `/slug` или „—"), активирана. Действия в
  ред (`card-row.tsx`): `Select` профил + „Свържи"/„Смени" (при `assigned|active`), „Откачи" (при
  `active`), „Деактивирай" с `ConfirmDialog` (при ≠ `disabled`).
- `actions.ts`: `claimCardAction`, `assignCardProfileAction`, `unassignCardAction`,
  `disableCardAction`, `activateFromChipAction`. Ред: Zod → `requireCurrent()` (извън `try`) →
  лимит → `isOrgMember` → сервиз с `org.id` → `revalidatePath('/app/cards')`. `CardError` →
  `message`; друго → лог само код/constraint.
- `schema.ts`: `claimSchema = { cardId: cardIdSchema, code: z.string().trim().regex(/^\d{6}$/) }`.

## 4. Какво НЕ се пипа

- `POST /api/scans` beacon, `source: qr|direct`, `country`, `/app/analytics` — етап 4.
- `orders`, `order_id`, задаване на `org_id` от поръчка — етап 3.
- Админските `detachCardProfile`/`disableCard` и техните action-и (CRD-1).
- Връщане от `disabled`; смяна на org на карта; покани/членове; CSV.
- `RATE_POLICY.apiIp/actionUser` стойности; `publicApiLimit`.
- `/{slug}`, `findPublicProfileBySlug`, `ProfileView`; кеш на `/{slug}`.
- `requireCurrent` договорът (redirect) — само се стъпва върху `loadCurrent`.
- `signInSchema`/`registerSchema`; лимитите на входа. Админският вход — без `next`.
- `card.schema.ts` — без нови колони. Сайдбарът и `nav-tree.ts`.

## 5. Приемни критерии

- [ ] `pnpm db:migrate` от чиста база създава `scans`, двата enum-а, CHECK-а и 2 индекса; `0003_*`.
- [ ] `/c/abcd2345` намира `ABCD2345`; `/c/O1234567` и `/c/x` → 404 без заявка.
- [ ] `active` карта с профил → 307 към `/{slug}` и точно един ред в `scans` (`nfc`, device от UA,
      `country null`); скрит профил → 307 → 404; паднал insert → пак 307.
- [ ] `disabled` → „Картата не е активна" (200, noindex); `active` без профил → „не е свързана" с
      линк `/app/cards`; `blank` → 404.
- [ ] `written` без сесия → „Вход"/„Регистрация" с `?next=/c/{ID}`; след вход/регистрация →
      `/c/{ID}`. `?next=https://evil`, `//evil`, `/app`, `/c/x` → `/app`.
- [ ] `written` със сесия → форма с профилите на личната org; „Активирай" → `active`, `org_id`,
      `profile_id`, `activated_at`, после `/{slug}`. Профил от чужда org → отказ.
- [ ] `assigned` с `org_id` на друга org → текст без форма; action-ът също отказва.
- [ ] `activateCard`/`claimCardByCode` върху `blank` → `card_unclaimable`; `active` → „вече е
      активирана"; `disabled` → „не е активна"; два паралелни `activateCard` → точно един успех.
- [ ] „Добави карта" с верен код → `assigned` + `org_id`; грешен код и непознат id → едно и също
      съобщение; повторно в същата org → успех без промяна; в друга org → `card_foreign_org`.
- [ ] Claim: 6-и опит за една карта в час → „Твърде много опити"; 11-и за потребител → също.
- [ ] „Свържи"/„Смени" → `active` + профил; чужд `cardId`/`profileId` → „Няма такава карта", нищо
      не се пише. „Откачи" → `assigned`, `profile_id null`. „Деактивирай" → `disabled`.
- [ ] `/app/profiles/new?card=ID` след създаване → `/c/ID`; невалиден `?card=` → `/app`.
- [ ] `classifyDevice`: iPhone/iPad → ios, Android → android, `null`/desktop → other.
- [ ] Нито един файл над 300 реда; `pnpm verify` минава.

## 6. Как се проверява

**Машинно:** `pnpm verify`. Тестове: node `scan-device.test.ts`, `card-router.test.ts` (6 изхода),
`auth/schema.test.ts` (`safeNextPath`), `policy` ключове; db `card-activation.service.db.test.ts`
(FOR UPDATE конкурентност, org mismatch, wrong code, всеки status guard, профил от чужда org,
unassign/disable org-scoped, `set null` при изтрит профил в `scans`); node `cards/actions.test.ts`,
`user-actions.test.ts` (`next`), `profiles/new/actions.test.ts` (`card`); dom
`claim-card-form.test.tsx`, `activate-form.test.tsx`.

**Ръчно** (без NFC — `curl -i` и браузър): 1. Партида, „Маркирай записаните", `ID` от
`/admin/cards`. 2. `curl -i /c/id` → 200 „Активирай"; `curl -i /c/O1234567` → 404. 3. Частен
прозорец → `/c/ID` → „Регистрация" → връща на `/c/ID` → „Нов профил" → `/c/ID` с формата →
„Активирай" → `/{slug}`. 4. `curl -i -A "iPhone" /c/ID` → 307 `Location: /{slug}`; ред в `scans` с
`ios`. 5. `/app/cards`: „Смени" → curl показва новия slug; „Откачи" → формата пак; „Деактивирай"
→ „не е активна". 6. Втора карта: грешен код ×5 → 6-ият „Твърде много"; верен → `assigned`. 7. `/login?next=https://example.com` → след вход `/app`.

**Регресия:** `/{slug}`, `/api/qr`, `/api/vcard`; вход/регистрация без `?next=` → `/app`;
`/app/profiles/new` без `?card=` → `/app`; `/admin/cards` „Откачи"/„Деактивирай"; изтриване на
профил (`cards.profile_id` и `scans.profile_id` → null); CRD-1 db тестове с миграция `0003`.

## 7. Блокиращи въпроси

Няма.
