# `PLT-4` — Клиентски вход, регистрация и рамка на dashboard-а `/app`

**Тежест:** голяма — автентикация, права, регистрация (вход от потребител, създава `users` +
`organizations`), промяна в одитирания `session.ts`.
**Заявено:** 2026-09-19
**Сверено с кода:** 2026-09-19 — всеки `файл:ред` по-долу е отворен наново, не преписан от заявката.

## Дневник на етапите

| Етап         | Изпълнител | Кога       | Резултат                                                         |
| ------------ | ---------- | ---------- | ---------------------------------------------------------------- |
| анализ       | analyzer   | 2026-09-19 | задание                                                          |
| код          | programmer | 2026-09-19 | готово; 4 отклонения приети                                      |
| ревю         | reviewer   | 2026-09-19 | готово с уговорки — spread ред поправен, останалото → open-items |
| сигурност    | security   | 2026-09-19 | 2 ниски поправени (email max, стар ключ при вход)                |
| тестове      | programmer | 2026-09-19 | 116 теста; Playwright пълен сценарий на 390 px                   |
| документация | диригентът | 2026-09-19 | AUTH-7/8, worklog, open-items                                    |

## 1. Какво не е наред

Клиент няма как да си направи акаунт, да влезе и да види профилите си. Съществува само админ вход
(`/admin/login`) и публичната страница `/{slug}`; профили се създават единствено през `seed-demo`.
Обхват: `docs/zadanie.md` § 5.1 (регистрация → лична org), § 7.2 (само редът `/app`).

**Сверка с кода — разлики спрямо заявката:**

- `src/app/[slug]/profile-view.tsx:2` — `--profile-*` не са отделна палитра, а слой в
  `profile-theme.css`, внасян само от `[slug]/page.tsx:4`. `tokens.css:2` изрично казва „публична
  част и админ на една палитра". Извод: `Button`/`Field` са ползваеми в `/app` без промяна (§ 3.5).
- `docs/tasks/ADM-1-admin-skeleton.md:140-141` вече решава: `/login` и `/admin/login` „не бива да
  делят адрес и форма". Съобразено в § 3.4.
- `src/modules/platform/profile.service.ts:1,48,83` цитира редактора като „PLT-4" — сега е PLT-5.
- `scripts/db/seed-admin.ts:45-62` вече прави „user + лична org в една транзакция" — регистрацията
  следва същия ред и **всеки потребител има лична org** (седнат админ включително).
- Няма `findProfilesByOrg`/списък в `profile.repository.ts` — нов repository+service метод.
- Няма проверка на членство в `organization.repository.ts` — helper-ът за AUTH-2 е нов.
- `current-admin.ts:25-33` **отменя сесията** при не-админ ред. При една обща cookie (§ 3.1) това
  би изхвърлило клиента от `/app`, щом отвори `/admin` — поведението се променя (§ 3.2).
- `actions.test.ts:17-30` мокира `./session`, защото `session.ts:2` носи `server-only`. Тестът на
  регистрацията в db проекта затова НЕ минава през barrel-а на `auth` (§ 3.7).

## 2. Къде

| Файл                                                                 | Редове     | Роля в промяната                                                                    |
| -------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------- |
| `src/modules/auth/session.ts`                                        | 10, 19     | главна: cookie `admin_session` → `session`; тип `Admin` → `SessionUser`; нищо друго |
| `src/modules/auth/schema.ts`                                         | 11-15      | главна: `SessionUser`, `registerSchema`, `RegisterInput`; `Admin` остава alias      |
| `src/modules/auth/current-admin.ts`                                  | 16-34      | главна: не-админ ред → `null` БЕЗ revoke; липсващ ред → revoke                      |
| `src/modules/auth/current-user.ts`                                   | нов        | главна: `getCurrentUser()`                                                          |
| `src/modules/auth/admin-account.ts`                                  | 34-46      | съгласуване: `findAccountByEmail` (всеки user, с хеш) до `findAdminByEmail`         |
| `src/modules/auth/registration.ts`                                   | нов        | главна: `registerAccount(db, input)` — транзакцията                                 |
| `src/modules/auth/user-actions.ts`                                   | нов        | главна: `register`, `signInUser`, `signOutUser` (`'use server'`)                    |
| `src/modules/auth/index.ts`                                          | 3-12       | съгласуване: barrel                                                                 |
| `src/modules/platform/organization.repository.ts`                    | 50-66      | главна: `isOrgMember(executor, orgId, userId)`                                      |
| `src/modules/platform/profile.repository.ts`                         | 41-51      | главна: `findProfilesByOrg`                                                         |
| `src/modules/platform/profile.service.ts`                            | 1, 48      | главна: `listProfiles` + DTO `ProfileSummary`; коментари PLT-4→PLT-5                |
| `src/modules/platform/index.ts`                                      | 4-21       | съгласуване: barrel                                                                 |
| `src/app/(auth)/login/{page,login-form}.tsx`                         | нови       | главна: клиентски вход                                                              |
| `src/app/(auth)/register/{page,register-form}.tsx`                   | нови       | главна: регистрация                                                                 |
| `src/app/app/layout.tsx`                                             | нов        | metadata + `noindex`, като `admin/layout.tsx:8-12`                                  |
| `src/app/app/(protected)/{layout,page,current.ts,app-nav}.tsx`       | нови       | главна: пазач, рамка, списък, навигация                                             |
| `src/app/app/(protected)/profiles/new/{page,new-profile-form}.tsx`   | нови       | главна: „Нов профил"                                                                |
| `src/app/app/(protected)/profiles/new/actions.ts`                    | нов        | главна: `createProfileAction`                                                       |
| `src/app/app/(protected)/profiles/[id]/page.tsx`                     | нов        | заглушка „предстои" (PLT-5), не чете данни                                          |
| `src/app/app/(protected)/{cards,orders,settings}/page.tsx`           | нови       | заглушки „предстои"                                                                 |
| `src/components/coming-soon.tsx`, `src/components/logout-button.tsx` | преместени | от `admin/(protected)/`; `LogoutButton` получава проп `action`                      |
| `src/app/admin/(protected)/layout.tsx` + 7 `*/page.tsx`              | 10, 47     | съгласуване: нови import пътища; `<LogoutButton action={signOut} />`                |
| `src/app/admin/(auth)/login/login-form.tsx`                          | 1-68       | само за контекст — образец                                                          |
| `scripts/db/seed-admin.ts`                                           | 45-62      | само за контекст — образец за транзакцията                                          |

## 3. Как (посока, не готов код)

### 3.1 Сесия: ЕДНА cookie, две функции (прието)

Cookie `session` с `{ id, email, name }` на реда в `users`; `getCurrentUser()` и `getCurrentAdmin()`
четат същата сесия и **решават ролята от реда при всяка заявка** (AUTH-5). Обосновка: админът Е
ред в `users` — една идентичност, една сесия, един Redis ключ; `session.ts` се пипа на два реда.
Две cookies биха дали на един човек два живота с два TTL-а и изход, който затваря само единия.
Следствие: **админ с жива сесия отваря и `/app`** (има лична org от `seed-admin`); клиент без
`is_admin` НЕ отваря `/admin` (пренасочва към `/admin/login`, сесията му остава). AUTH-7 в
`decisions.md`. Преименуването убива текущите dev сесии — приемливо, прод няма.

### 3.2 `getCurrentUser` / `getCurrentAdmin`

Общ вътрешен път: `readSession` → `findById`. Ред няма → `revokeSession` + `null` (и двете).
Паднала база → `null` без revoke (както `current-admin.ts:20-23`). `getCurrentAdmin`: ред без
`isAdmin` → `null`, **без revoke** (промяна спрямо `current-admin.ts:25-33`; тестът се коригира).
`getCurrentUser` връща `SessionUser` от сесията (не от реда — една заявка, както досега).

### 3.3 Регистрация

- `registerSchema` (Zod, в `schema.ts`): `name` trim 1–120, `email` `z.email()`, `password` 8–256.
- `registerAccount(db, input: RegisterInput)` в `auth/registration.ts`: `db.transaction` →
  `createUser(tx, { email, password, name })` — **`isAdmin` и `emailVerifiedAt` не се подават**;
  `RegisterInput` няма такива полета по тип → `createPersonalOrganization(tx, { ownerUserId,
name })` от `@/modules/platform` (barrel; auth → platform е нова посока, без цикъл: platform
  внася само `../auth/user.schema`). Резултат `{ status: 'created', user } | { status:
'email_taken' }`. Зает имейл се лови по уникалния индекс (код `23505`, образец
  `profile.service.ts:145-150`), не с предварителна проверка. Логва се `cause` (DAT-6).
  `email_verified_at` остава `null` — потвърждението е отделен цикъл.
- `register(input: unknown)` в `user-actions.ts`: `safeParse` → провал → `{ ok: false, message }`;
  `email_taken` → „Този имейл вече е регистриран." (издава съществуването — прието за v1; rate
  limit на `/register` и `/login` в `open-items.md`). Успех → `createSession(user)` →
  `redirect('/app')` извън `try`. Падне ли Redis след записа → `{ ok: false, message: 'Акаунтът е
създаден, но входът не мина — влез от /login.' }`.
- Хеширането става вътре в транзакцията (`user.service.ts:24`) — не се пренарежда сега.

### 3.4 Вход и изход

- `findAccountByEmail(email)` в `admin-account.ts`: като `findAdminByEmail`, но без филтъра
  `isAdmin`; двете делят преобразуването. Файлът остава с името си.
- `signInUser(input)`: копие на пътя `actions.ts:22-52` с `findAccountByEmail`, примамка
  (`decoyPasswordHash`) и същото съобщение `REJECTED`; успех → `redirect('/app')`.
  `signOutUser()`: `destroySession` → `redirect('/login')`; отказът се връща (AUTH-4).
- Форма: **отделно копие** `src/app/(auth)/login/login-form.tsx` (ADM-1 § 3.3) — същият
  react-hook-form + `signInSchema` образец, action `signInUser`, плюс връзка „Нямаш акаунт?
  Регистрирай се" → `/register`. `register-form.tsx` — същият образец с `registerSchema`
  (`autoComplete="new-password"`). Страниците: влязъл → `redirect('/app')`.
- `LogoutButton` се мести в `src/components/logout-button.tsx` с проп `action: () =>
Promise<SignOutFailure>`; админът подава `signOut`, `/app` — `signOutUser`.

### 3.5 Рамка `/app`

- `src/app/app/(protected)/layout.tsx`: `requireCurrent()` от `current.ts` → `{ user, org }`;
  `user === null` → `redirect('/login')`. `org` = `findPersonalOrganizationByOwner(db, user.id)`;
  `null` е невъзможно състояние → `throw` с ясен текст. `requireCurrent` се вика и от **всяка**
  страница и action под `/app` — layout-ът не се изпълнява при мека навигация.
- Мобилно първо: `<header>` с име на приложението (`env().APP_NAME`), `user.name`, `LogoutButton`;
  под него хоризонтална лента `app-nav.tsx` (`overflow-x-auto`) с Профили `/app`, Карти
  `/app/cards`, Поръчки `/app/orders`, Настройки `/app/settings`; активният по `usePathname`. Без
  `Sidebar`/`NavDrawer`, без `h-dvh` — обикновена страница със скрол. `Button`, `buttonStyles`,
  `Field` от `src/components/ui` се ползват директно; `--profile-*` НЕ се внася в `/app`.
- `ComingSoon` се мести в `src/components/coming-soon.tsx`; заглушки за `/app/cards`,
  `/app/orders`, `/app/settings`, `/app/profiles/[id]` (не чете нищо от базата).

### 3.6 Списък и „Нов профил"

- `isOrgMember(executor, orgId, userId): Promise<boolean>` в `organization.repository.ts` — по PK
  на `org_members`. Helper-ът за AUTH-2; всяка Server Action в `/app` го вика след като сама е
  определила `orgId` на сървъра. `orgId` идва от `requireCurrent()`, не от формата.
- `findProfilesByOrg(executor, orgId)` (по `createdAt`/`id`) + `listProfiles(executor, orgId):
Promise<ProfileSummary[]>`; DTO с изрични полета `{ id, slug, firstName, lastName, isPublic,
updatedAt }` (DAT-7).
- `/app` (`page.tsx`): списък с име, `/{slug}` (през `profileUrl`, нов таб), „скрит" при
  `!isPublic`, връзка към `/app/profiles/{id}`; празно състояние; „Нов профил" (`buttonStyles`) →
  `/app/profiles/new`. Бутонът е винаги — лимитът го решава сървърът.
- `createProfileAction(input: unknown)`: Zod `{ slug: slugSchema, firstName, lastName }` →
  `requireCurrent()` → `isOrgMember` → `createProfile(db, { orgId, slug, firstName, lastName })` →
  `ProfileError` → `{ ok: false, message: error.message }`; друга грешка → общ текст, `cause` в
  лога; успех → `redirect('/app')`. Формата показва `message` в `role="alert"`.

### 3.7 Тестове

- **node**: `user-actions.test.ts` — непознат имейл → `REJECTED` + примамка; не-админ с вярна
  парола → `REDIRECT:/app`; админ → също; `signOutUser` → `REDIRECT:/login`, провал → съобщение;
  `register` — невалиден вход → провал без запис; `email_taken` → съобщението; успех →
  `createSession` + `REDIRECT:/app`. `current-user.test.ts` — без сесия `null` без заявка; ред има
  → сесията; ред няма → revoke + `null`. `current-admin.test.ts` — не-админ → `null`, БЕЗ revoke.
  `profiles/new/actions.test.ts` — без сесия → `REDIRECT:/login`; не член → отказ;
  `ProfileError('plan_limit_profiles')` → неговото `message`; успех → `REDIRECT:/app`.
- **db**: `registration.db.test.ts` (внася `./registration` относително): user с `isAdmin=false`,
  `emailVerifiedAt=null` и лична org с `owner`; втори опит със същия имейл в друг регистър →
  `email_taken` и **нула** нови org редове. `isOrgMember` за owner/чужд. `listProfiles` — само
  профилите на org.
- **dom**: `register-form.test.tsx` — парола под 8 → грешка от Zod без action; отказ → `role="alert"`.
  `new-profile-form.test.tsx` — същото с `message` от action-а.

### 3.8 Документация

`decisions.md`: AUTH-7. `open-items.md`: rate limit и за `/login`, `/register`; потвърждение на
имейл. `RESERVED_SLUGS` вече съдържа `app`, `login`, `register`.

## 4. Какво НЕ се пипа

- Редактор на профил, линкове, снимка/лого, тема, `updateProfile`/`deleteProfile` — PLT-5.
- Смяна на парола, забравена парола, потвърждение на имейл, `/app/settings` съдържание.
- Смяна на org, покани, членове, `/app/org`, `/app/analytics`.
- `/c/{id}`, карти, поръчки — само заглушки „предстои".
- `session.ts` извън двата реда: TTL, флагове, Redis ключ, `destroySession` (AUTH-4).
- `createUser`, `user.repository.ts`, схемата `users` и миграциите — без нова колона/миграция.
- `createProfile`, `can`, `plan.ts` — сервизът вече пази всичко.
- Админ панелът: `Sidebar`, `NavDrawer`, `nav-tree.ts`, `admin/(auth)/login/*` — само import
  пътища на преместените два компонента и пропът `action`.
- `tokens.css`, `globals.css`, `profile-theme.css`; публичната страница `/{slug}`.
- `scripts/db/seed-admin.ts` — не се пренаписва върху `registerAccount`.
- Без `middleware.ts` — пазачът е сървърен layout + `requireCurrent()`.

## 5. Приемни критерии

- [ ] `/register` с валидни имейл, парола (≥ 8) и име създава ред в `users` с `is_admin=false`,
      `email_verified_at=null`, лична org с `owner` в `org_members`, отваря сесия и води към `/app`.
- [ ] Регистрация със зает имейл (в друг регистър) показва „Този имейл вече е регистриран." и не
      оставя нов ред в `organizations`.
- [ ] Парола под 8 знака се спира от формата преди action-а; action-ът също я отказва директно.
- [ ] `/login` с вярна парола → `/app`; грешна парола и непознат имейл → едно и също съобщение;
      примамката се изпълнява и за непознат имейл.
- [ ] Всеки `/app/*` без сесия → `/login`; `/login` и `/register` с жива сесия → `/app`.
- [ ] Клиент без `is_admin` с жива сесия: `/admin` → `/admin/login`, а `/app` работи (сесията не
      е отменена).
- [ ] Админ с жива сесия отваря `/app` и вижда профилите на личната си org.
- [ ] Изтрит ред в `users` при жива сесия → следващата заявка към `/app` пренасочва към `/login`.
- [ ] „Изход" от `/app` трие Redis ключа и cookie-то → `/login`; при паднал Redis — отказ.
- [ ] „Нов профил" със slug, име, фамилия създава профила; `/{slug}` се показва веднага; списъкът на
      `/app` го съдържа с връзки към `/{slug}` и `/app/profiles/{id}`.
- [ ] Втори профил във Free org → „Планът Free позволява един профил."; зает/запазен/невалиден
      slug → съответното съобщение.
- [ ] `createProfileAction` с подправен `orgId` във входа го игнорира — org-ът е само от сървъра.
- [ ] Никоя Server Action не хвърля към клиента — връща `{ ok: false, message }` или пренасочва.
- [ ] Рамката на `/app` е ползваема под 64rem без страничен панел; навигацията е хоризонтална.

## 6. Как се проверява

**Машинно:** `pnpm verify`.

**Ръчно** (`pnpm infra:up`, `pnpm dev`, http://localhost:3100):

1. `/register` → име, `k@x.bg`, парола 8+ → `/app` с празен списък и името горе.
2. `/register` пак с `K@X.BG` → зает имейл; в studio няма втора org.
3. „Нов профил": slug `demo` → „вече е зает"; `app` → „запазен"; `kiril` → в списъка; `/kiril` се
   отваря в нов таб.
4. Втори „Нов профил" → „Планът Free позволява един профил."
5. `/admin` → `/admin/login`; обратно на `/app` — още вътре.
6. „Изход" → `/login`; `/app` → `/login`; `/app/cards` → `/login`.
7. `/admin/login` като админ → `/admin`; после `/app` → dashboard с профилите на админската org.
8. Под 64rem: лентата се превърта, няма панел.

**Регресия — какво НЕ трябва да се счупи:**

- `/admin/login` → вход → `/admin` → „Изход" → `/admin/login`.
- Не-админ през `/admin/login` получава същото съобщение като непознат имейл.
- `/{slug}` и `/api/{vcard,qr}/{slug}` — недокоснати; `/demo` след `seed-demo` се показва.
- `pnpm db:seed:admin`, `pnpm db:seed:demo` — минават (barrel-ът на `platform` НЕ внася
  `@/modules/auth`, иначе `server-only` спира скриптовете).
- `current-admin.test.ts`, `actions.test.ts`, `profile.service.db.test.ts` — зелени.

## 7. Блокиращи въпроси

Няма. Приети: една cookie (AUTH-7); регистрацията издава зает имейл (v1).
