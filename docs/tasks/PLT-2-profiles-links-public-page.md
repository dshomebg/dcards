# `PLT-2` — Профили, линкове и публичната страница

**Тежест:** голяма — втора миграция (две таблици + enum), публична повърхност `/[slug]` без
auth, вход от потребител (slug). Пуска `security`.
**Заявено:** 2026-09-19
**Сверено с кода:** 2026-09-19 — всеки `файл:ред` по-долу е отворен наново, не преписан от
заявката.

## Дневник на етапите

| Етап         | Изпълнител | Кога       | Резултат                                             |
| ------------ | ---------- | ---------- | ---------------------------------------------------- |
| анализ       | analyzer   | 2026-09-19 | задание                                              |
| код          | programmer | 2026-09-19 | готово; 6 отклонения приети                          |
| ревю         | reviewer   | 2026-09-19 | готово с уговорки — `PageProps` и инициали поправени |
| сигурност    | security   | 2026-09-19 | 1 средна + 3 ниски; поправени от диригента           |
| тестове      | programmer | 2026-09-19 | 53 + 2 (диригент); Playwright снимки 3 теми          |
| документация | диригентът | 2026-09-19 | DAT-7/8, ARC-6/7, worklog, open-items                |

## 1. Какво не е наред

Има потребители и организации (PLT-1), но няма какво да се покаже на картата: няма таблици за
профил и линкове, а `/{slug}` дава 404 за всичко. Етап 1 (§ 10) не може да продължи към
vCard/QR (PLT-3) и редактора (PLT-4) без данни и без страница, която ги рисува.

**Сверка със заявката — разлики:**

- `next.config.ts:3-9` — **по-широко от заявеното**: `cacheComponents` НЕ е включен, т.е.
  `use cache`/`cacheTag` не са налични без промяна на целия проект; `unstable_cache` е обявен
  за заменен (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unstable_cache.md:6-8`).
  Изборът за кеша е в § 3.6.
- `src/modules/core/db/columns.ts:14-17` — има само `createdAt()`; `updatedAt()` се добавя тук.
- `src/modules/platform/index.ts:3-4` — barrel-ът изнася два символа, без `server-only`.
- `src/theme/tokens.css:1-13` + `src/app/globals.css:2` — палитрата вече е глобална за всички
  маршрути; трите теми са **слой върху нея**, не нова палитра.
- `docs/design.md:24-26` — темите са именувани, но за sand не е казано кой е текстът и
  акцентът — предписано в § 3.5.
- `src/modules/core/env.ts:10` — `APP_URL` по подразбиране е `:3000`, а dev е на `:3100`:
  `og:url` локално ще е грешен, освен ако `.env` не го задава (виж § 6).
- `src/app/` — няма `not-found.tsx`; непознат slug ще показва английската страница на Next.
- `drizzle/meta/_journal.json:9` — единствена миграция `0000_init_users_orgs`; новата е `0001_*`.

## 2. Къде

| Файл                                                      | Редове | Роля в промяната                                              |
| --------------------------------------------------------- | ------ | ------------------------------------------------------------- |
| `src/modules/core/db/columns.ts`                          | 14-17  | съгласуване: `updatedAt()` с `$onUpdate`                      |
| `src/modules/core/db/schema.ts`                           | 4-5    | регистър: `export * from '../../platform/profile.schema'`     |
| `src/modules/platform/profile.schema.ts`                  | нов    | `profile_link_type` enum, `profiles`, `profile_links`, типове |
| `src/modules/platform/slug.ts`                            | нов    | `RESERVED_SLUGS`, `slugSchema` (zod), `isReservedSlug`        |
| `src/modules/platform/plan.ts`                            | нов    | таблица Free/Pro + `can(org, feature, used?)`                 |
| `src/modules/platform/link-href.ts`                       | нов    | `linkHref(type, value)` → `string \| null`, `LINK_LABELS`     |
| `src/modules/platform/profile.repository.ts`              | нов    | единственият SQL за двете таблици                             |
| `src/modules/platform/profile.service.ts`                 | нов    | `createProfile`, `findPublicProfileBySlug`, `ProfileError`    |
| `src/modules/platform/index.ts`                           | 3-4    | barrel: изнася изброеното в § 3.2                             |
| `src/app/[slug]/page.tsx`                                 | нов    | SSR страница: `generateMetadata`, `notFound`, `dynamic`       |
| `src/app/[slug]/profile-view.tsx`                         | нов    | чист презентационен компонент (тестваем без база)             |
| `src/app/[slug]/profile-theme.css`                        | нов    | токените на трите теми                                        |
| `src/app/not-found.tsx`                                   | нов    | 404 на български, ≤ 20 реда                                   |
| `scripts/db/seed-demo.ts`, `package.json`                 | нов/29 | `pnpm db:seed:demo` — демо профил за ръчна проверка           |
| `drizzle/0001_*.sql`, `drizzle/meta/*`                    | генер. | само през `pnpm db:generate`                                  |
| `src/modules/platform/organization.schema.ts`             | 29-47  | само за контекст: FK и `Organization` за `can()`              |
| `src/modules/auth/user.schema.ts`                         | 39-60  | само за контекст: образец за `PublicX` + `toPublicX`          |
| `src/modules/platform/organization.repository.db.test.ts` | 1-22   | само за контекст: образец за db тест                          |

## 3. Как (посока, не готов код)

### 3.1 Схема (`profile.schema.ts`)

- `profileLinkTypeEnum = pgEnum('profile_link_type', [...13 типа по § 5.2 в същия ред])`.
- `profiles`: `id primaryId()` · `orgId uuid → organizations.id, onDelete: 'cascade'`
  (организацията е собственик, AUTH-2) · `slug text notNull` · `firstName`, `lastName text
notNull` · `title`, `company`, `bio`, `photoKey`, `logoKey text` nullable · `theme jsonb
notNull` с `$type<ProfileTheme>()` · `isPublic boolean notNull default true` · `createdAt()`,
  `updatedAt()`. Индекси: `uniqueIndex('profiles_slug_idx').on(slug)`;
  `index('profiles_org_idx').on(orgId)`. CHECK `profiles_slug_format` със същия regex като
  § 3.3 — пази и от редакция през `db:studio` (Drizzle `check()`).
- `profile_links`: `id primaryId()` · `profileId uuid → profiles.id, onDelete: 'cascade'` ·
  `type` enum notNull · `label text` nullable (празно → подразбиран етикет от `LINK_LABELS`) ·
  `value text notNull` · `sortOrder integer notNull default 0` · `isVisible boolean notNull
default true`. Индекс `profile_links_profile_idx` on `(profileId, sortOrder)`.
- `ProfileTheme = { preset: 'light' | 'dark' | 'sand'; primaryColor: string | null; layout:
'default' }` — `layout` има една стойност сега, за да не иска миграция после; `primaryColor`
  се пази, но тази страница НЕ го прилага (Pro теми са отделен цикъл).
- `PublicProfile` и `PublicProfileLink` — изрични интерфейси по образеца `PublicUser`: без
  `orgId`, без `isPublic`, без id-та; линковете само `type`, `label`, `value`.
- `updatedAt()` в `columns.ts`: `timestamp('updated_at', { withTimezone: true, mode: 'date'
}).notNull().defaultNow().$onUpdate(() => new Date())`.
- Миграция: `pnpm db:generate -- --name profiles_links` → `drizzle/0001_profiles_links.sql`.
  Проверява се, че SQL-ът съдържа enum-а, двата FK с `cascade`, двата индекса, CHECK-а.

### 3.2 Barrel (`index.ts`)

Изнася: `createProfile`, `findPublicProfileBySlug`, `ProfileError`, типове `PublicProfile`,
`PublicProfileLink`, `ProfileLinkType`, `ProfileTheme`, константи `PROFILE_LINK_TYPES`,
`RESERVED_SLUGS`, `slugSchema`, `linkHref`, `LINK_LABELS`, `can`, тип `Feature`. Нищо от
`profile.repository.ts` не излиза навън.

### 3.3 Slug (`slug.ts`)

- Regex: `^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$` — `[a-z0-9-]`, 3–30, без водещо/крайно тире.
  `slugSchema = z.string().regex(..., 'Адресът може да съдържа само малки латински букви,
цифри и тире (3–30 знака).')`. Главни букви НЕ се нормализират — отхвърлят се (чипът носи
  точния URL).
- `RESERVED_SLUGS` като `ReadonlySet`: `admin, app, api, c, login, register, logout, products,
cart, checkout, order, orders, account, settings, help, support, about, contact, terms,
privacy, static, assets, public, www, mail, dcards`. Next дава предимство на статичните
  сегменти пред `[slug]`, така че сблъсъкът не чупи маршрута — но резервацията пази клиент да
  не заеме адрес, който утре става страница (§ 11). Списъкът се допълва при всеки нов публичен
  маршрут. Защитата от squatting на фирмени имена е извън обхвата.

### 3.4 Сервиз и репозиторий

- `can(org, feature, used = 0)` в `plan.ts`: `PLAN_LIMITS` по § 8 — `profiles: 1|null`,
  `links: 6|null`, `customTheme`, `analytics`, `members: 1|null`, `noBranding` (`null` = без
  лимит). Логика само за `profiles` и `links` (числови: `used < limit`); булевите връщат
  стойността от таблицата. Ефективен план: `pro` с `planExpiresAt` в миналото се брои за
  `free` — единственото място, което тълкува двете полета (AUTH-3). Приема
  `Pick<Organization, 'plan' | 'planExpiresAt'>`.
- `createProfile(executor, { orgId, slug, firstName, lastName, title?, company?, bio?, theme?,
isPublic?, links? })` в транзакция: (1) `slugSchema` + резервиран → `ProfileError('slug_invalid'
| 'slug_reserved')`; (2) `SELECT … FROM organizations WHERE id = $1 FOR UPDATE` — сериализира
  две паралелни създавания в една org, иначе Free лимитът се прескача; (3) `can(org,
'profiles', count)` → `'plan_limit_profiles'`; (4) `links.length` срещу `can(org, 'links', 0)`
  → `'plan_limit_links'`; (5) предварителна проверка за зает slug → `'slug_taken'`; уникалният
  индекс остава последна защита — нарушение (`cause.code === '23505'`) се превежда в същия код,
  не изтича като Drizzle обвивка (DAT-6); (6) insert профил + линкове с `sortOrder` по позиция
  в масива. Съобщенията в `ProfileError.message` са на български; `code` е за тестовете и за
  PLT-4.
- `findPublicProfileBySlug(executor, slug)`: `null` при непознат ИЛИ `isPublic = false` —
  страницата не различава двата случая. Линкове: само `isVisible`, подредени по `sortOrder,
id`. Връща `PublicProfile`.
- Редактиране, изтриване, смяна на видимост — НЕ тук (PLT-4).

### 3.5 Публичната страница

- `src/app/[slug]/page.tsx`: `export const dynamic = 'force-dynamic'` (§ 3.6);
  `generateMetadata` и `Page` типизирани с `PageProps<'/[slug]'>`
  (`…/03-file-conventions/page.md:123-140`); slug-ът се валидира със `slugSchema` ПРЕДИ базата
  — невалиден → `notFound()` без заявка; `null` от сервиза → `notFound()`
  (`…/04-functions/not-found.md:11-15`; извиква се в тялото на страницата, не в `Suspense`, за
  да е истински 404 статус — `not-found.md:193`). Двойното четене между `generateMetadata` и
  страницата се обединява с `React.cache` (`generate-metadata.md:113`).
- Метаданни (`generate-metadata.md:466-524`): `title: "Име Фамилия – Длъжност"`,
  `description: bio || "Длъжност, Фирма"`, `openGraph: { type: 'profile', locale: 'bg_BG',
siteName: APP_NAME, url: \`${APP_URL}/${slug}\`, title, description }`— без`images`.
`robots` по подразбиране (индексира се).
- `profile-view.tsx` е чист компонент `({ profile }) => JSX`: `<main
data-profile-theme={preset}>` · кръг с инициали вместо снимка (винаги — `photoKey`/`logoKey`
  се игнорират до цикъла за качване) · име, длъжност, фирма, bio · списък линкове: `<a
href={linkHref(...)}>` с етикет `label ?? LINK_LABELS[type]`; `https` линкове с
  `target="_blank" rel="noopener noreferrer"`, `tel:`/`mailto:`/`viber:` без target; `linkHref`
  върнал `null` → редът се пропуска · долу ред „брандинг на платформата" (текст + линк към `/`)
  — Pro премахването му е по-късен цикъл. **Без „Запази контакт" и „Сподели"/QR** (прието):
  не се рисуват бутони без действие на страница, която живее на раздадени карти; PLT-3 добавя
  реда с действия над списъка с линкове (място, отбелязано с коментар, не с празен елемент).
  Без `'use client'` в `src/app/[slug]/`.
- Теми: `profile-theme.css` (импортиран от `page.tsx`) дефинира `--profile-bg`,
  `--profile-ink`, `--profile-muted`, `--profile-accent`, `--profile-surface` за
  `[data-profile-theme='light' | 'dark' | 'sand']` само чрез `var(--color-*)` от `tokens.css`:
  light = bg/ink/brand/surface; dark = ink/bg/sand/brand-hover; sand = sand/ink/brand/surface.
  Brass — само за икони/бордюри (`design.md:19-20`). Компонентът ползва само `--profile-*`;
  никакви hex литерали.
- `not-found.tsx` в корена: заглавие „Няма такава страница", ред текст, линк към `/`.

### 3.6 Кеш — вариант C (прието)

`dynamic = 'force-dynamic'` (`…/02-guides/caching-without-cache-components.md:82-104`): една
заявка по уникален индекс + една по `(profileId, sortOrder)` на визита; винаги свежо. Обемът е
малък, редакция се вижда веднага, PLT-4 няма нужда да инвалидира нищо. `updated_at` се пази
като бъдещ ключ. Дали кешът е нужен, се решава с измерване (LCP на прод) — `open-items.md`.
Отхвърлени: A `unstable_cache` (обявен за заменен в 16); B `cacheComponents: true` (включва се
за ЦЕЛИЯ проект — отделен цикъл).

### 3.7 Линкове по тип (`link-href.ts`)

`linkHref(type, value)` е чиста функция; `digits(v)` маха всичко освен цифри, `handle(v)` маха
водещо `@` и празни места; `url(v)` приема само `http(s)://` (иначе `null`) — **никога** не
пропуска друга схема (`javascript:`, `data:`), за да не мине в `href`.

| Тип             | Формат                                                                         |
| --------------- | ------------------------------------------------------------------------------ |
| phone           | `tel:` + стойност без интервали/тирета/скоби (водещ `+` остава)                |
| email           | `mailto:` + стойност                                                           |
| website, custom | `url(v)`; без схема → `https://` + v; резултатът пак минава през `url()`       |
| linkedin        | пълен URL → както е; иначе `https://www.linkedin.com/in/{handle}`              |
| facebook        | пълен URL → както е; иначе `https://www.facebook.com/{handle}`                 |
| instagram       | `https://www.instagram.com/{handle}`                                           |
| tiktok          | `https://www.tiktok.com/@{handle}`                                             |
| youtube         | пълен URL → както е; иначе `https://www.youtube.com/@{handle}`                 |
| whatsapp        | `https://wa.me/{digits}` (без `+`)                                             |
| viber           | `viber://chat?number=%2B{digits}` — няма универсален https еквивалент          |
| telegram        | `https://t.me/{handle}` (прието) — отваря приложението, а без него не е мъртъв |
| address         | `https://www.google.com/maps/search/?api=1&query={encodeURIComponent(v)}`      |

`LINK_LABELS`: български етикет по тип („Телефон", „Имейл", „Уебсайт", „LinkedIn", … „Адрес",
„Линк").

### 3.8 Демо данни

`scripts/db/seed-demo.ts` + `"db:seed:demo": "tsx --env-file-if-exists=.env
scripts/db/seed-demo.ts"` по образеца на `seed-admin.ts` (аргументи, `describeError`, изход на
английски): `--email <съществуващ потребител>` → в личната му организация създава профил `demo`
(публичен, тема `sand`) с по един линк от 6-те най-чести типа (лимитът Free е 6). Идемпотентен
по slug. Цялата логика е `createProfile` — скриптът е ≤ 60 реда. Отделен `db:seed:demo`, не
разширение на `seed-admin` — админът не иска профил.

### 3.9 Тестове

- node: `slug.test.ts` (граници 3/30, тирета, главни букви, резервирани); `plan.test.ts`
  (Free 0→ok/1→не; Pro без лимит; изтекъл Pro = Free; булеви от таблицата);
  `link-href.test.ts` (по един случай на тип + `javascript:`/`data:` → `null` за
  website/custom/linkedin/facebook/youtube).
- db: `profile.service.db.test.ts` — създава профил + линкове; втори профил във Free org →
  `plan_limit_profiles`; 7 линка → `plan_limit_links`; зает slug → `slug_taken`; резервиран →
  `slug_reserved`; `findPublicProfileBySlug` връща подредени видими линкове, пропуска скрит
  линк, `null` за `isPublic=false` и за непознат; Pro org — два профила; изтриване на org трие
  профилите (cascade).
- dom (`*.test.tsx`): `profile-view.test.tsx` с `renderToStaticMarkup` — `data-profile-theme`,
  `href` за `phone`/`whatsapp`/`custom`, `rel="noopener noreferrer"` само на https, пропуснат
  ред при `null` href, инициали при липса на снимка.

## 4. Какво НЕ се пипа

- `organizations`/`org_members`/`users` схеми и миграция `0000_*` — нищо не се променя;
  `plan_expires_at` се чете, не се пише.
- `src/modules/auth/*`, `src/app/admin/*`, сесии, `current-admin.ts`.
- `next.config.ts` — `cacheComponents` НЕ се включва.
- `src/theme/tokens.css` стойности и `globals.css` — темите са нов файл със свои `--profile-*`.
- `scripts/db/seed-admin.ts` — не се разширява.
- Качване на снимка/лого, `core/storage`, `sharp`, `<img>` на страницата — отделен цикъл.
- „Запази контакт", „Сподели", QR, `/api/vcard`, `/api/qr`, `/api/scans` — PLT-3.
- Редактор, `/app/*`, `/login`, `/register`, редакция/изтриване на профил — PLT-4.
- Pro теми (`primary_color`, лого на фон), премахване на брандинга, статистика — етап 4.
- Squatting на фирмени имена (§ 11) — `open-items.md`.
- `/c/[id]` card router — етап 2.

## 5. Приемни критерии

- [ ] `pnpm db:migrate` на празна база минава `0000` и `0001`; `pnpm db:generate` след това не
      произвежда нова миграция.
- [ ] Free организация: първи профил се създава; втори — грешка с код `plan_limit_profiles` и
      българско съобщение; седми линк — `plan_limit_links`. Pro (без изтичане) — без лимит;
      Pro с `plan_expires_at` в миналото — като Free.
- [ ] Slug `Ab`, `ab`, `-abc`, `abc-`, `a b`, 31 знака, `admin` — отказ с код и съобщение на
      български; `ivan-petrov` — приет. Зает slug → `slug_taken`, без изтичане на SQL/параметри.
- [ ] `GET /{slug}` на публичен профил: HTTP 200, HTML съдържа име, длъжност, фирма, bio,
      всички видими линкове в реда на `sort_order`, скритите липсват; `<title>`, `og:title`,
      `og:description`, `og:url`, `og:type=profile` присъстват.
- [ ] `GET /{slug}` на профил с `is_public=false` и на непознат slug → HTTP 404 с българската
      `not-found` страница; отговорът не различава двата случая.
- [ ] Всеки от 13-те типа дава `href` по таблицата в § 3.7; `website`/`custom` със стойност
      `javascript:alert(1)` не произвежда `<a>`.
- [ ] Трите теми сменят фон/текст/акцент чрез `data-profile-theme`; в `src/app/[slug]/` няма
      hex литерал и няма `'use client'`.
- [ ] `pnpm db:seed:demo -- --email <admin>` създава `/demo`; второ пускане печата, че
      съществува, без промяна.
- [ ] Няма бутони без действие на страницата.

## 6. Как се проверява

**Машинно:**

```bash
pnpm verify
pnpm db:generate -- --name profiles_links      # веднъж; после без нова миграция
grep -rn "use client" "src/app/[slug]/"        # празно
grep -rnE "#[0-9a-fA-F]{3,6}\b" "src/app/[slug]/"   # празно
```

**Ръчно** (dev на `:3100`, `APP_URL=http://localhost:3100` в `.env`):

1. `pnpm db:migrate` → `pnpm db:seed:demo -- --email a@x.bg` → печата `profile created: /demo`.
2. `http://localhost:3100/demo` — име, длъжност, фирма, инициали в кръг, 6 линка; телефонът е
   `tel:`, WhatsApp — `https://wa.me/…`; view-source показва `og:*` и `<title>`.
3. `curl -sI http://localhost:3100/nqma-takyv` → 404; `curl -sI http://localhost:3100/Demo` → 404.
4. `is_public = false` за `demo` → 404 с български текст; обратно → 200 веднага (без кеш).
5. `theme.preset` → `dark`, после `light` — фон и текст се обръщат; няма бял body при скрол.

**Регресия — какво НЕ трябва да се счупи:**

- `/admin`, `/admin/login`, `/api/health/ready` и `/` продължават да работят — статичните
  сегменти имат предимство пред `[slug]`.
- Съществуващите db тестове минават върху образеца с двете миграции.
- `pnpm db:seed:admin` — непроменен изход. Цветовете на админа — непроменени.

## 7. Блокиращи въпроси

Няма. Препоръките (кеш C; `t.me`; без мъртви бутони; `layout: 'default'`) са приети от
диригента.
