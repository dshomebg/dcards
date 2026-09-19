# `ADM-1` — Скелет на админ панела

**Тежест:** голяма — пипа автентикация и права (нов модул `auth`, сесии, пазач), добавя над 40
файла и четири зависимости.
**Заявено:** 2026-09-19
**Сверено с кода:** 2026-09-19 — всеки `файл:ред` по-долу е отворен наново, не преписан от
заявката.

## Дневник на етапите

| Етап         | Изпълнител | Кога       | Резултат                                          |
| ------------ | ---------- | ---------- | ------------------------------------------------- |
| анализ       | analyzer   | 2026-09-19 | задание                                           |
| код          | programmer | 2026-09-19 | готово; 2 отклонения приети (ARC-5, AUTH-4)       |
| ревю         | reviewer   | 2026-09-19 | готово с уговорки — уговорките поправени/записани |
| сигурност    | security   | 2026-09-19 | 3 находки, поправени от диригента (<100 реда)     |
| тестове      | диригентът | 2026-09-19 | `actions.test.ts` 6 теста + Playwright на живо    |
| документация | диригентът | 2026-09-19 | worklog, AUTH-4/5, ARC-5, open-items              |

## 1. Какво не е наред

Няма админ. `src/app/` има само корен, `page.tsx` и `api/health`; `src/modules/auth/index.ts`
е празен barrel (`export {}`). Собственикът иска работеща рамка: вход с временен акаунт,
защитен `/admin/*`, двоен страничен панел с петте секции и екрани „предстои", върху които
следващите цикли (`zadanie.md` § 7.3) слагат съдържание.

**Сверка с кода — разлики спрямо заявката:**

- Потвърдено: `core/index.ts:1-3` изнася `db`, `env`, `redis`; `env.ts:13` вече има
  `SESSION_SECRET`; `argon2` вече е зависимост (`package.json:33`).
- По-широко от заявеното: пренесените `list` и `form` дърпат три файла извън списъка —
  `hooks/query-params.ts`, `hooks/use-query-params.ts` (`cursor-pager.tsx:5-6`,
  `search-filter.tsx:7`, `select-filter.tsx:5`) и `hooks/use-first-error-focus.ts`
  (`form-layout.tsx:6`). Те са чисти и се пренасят.
- По-широко от заявеното: `list/restore-button.tsx:7` дърпа `@/lib/api` (HTTP клиент). Тук
  няма API слой — файлът НЕ се пренася, редът му в `list/index.ts:7` пада.
- Механизмът е различен: `react-hook-form` и `@hookform/resolvers` се ползват само в
  `app/login/login-form.tsx:3-7`, никъде в `components/`. Добавят се заради формата за вход.
- `@pagagal/shared/schemas` се ползва в: `(protected)/layout.tsx:1-2` (`CurrentUser`,
  `isOperatorRole`), `(protected)/page.tsx:1`, `dashboard-tiles.tsx:1-5`
  (`DashboardBackup/Counter/View`), `login/login-form.tsx:4` (`LoginInput`, `loginSchema`).
  `@pagagal/shared/constants` — в `config/site.ts:1-5`.
- Компонентите разчитат на ИМЕНАТА на токените (`bg-nav`, `rail-active`, `text-hint`,
  `gap-hint`, `wide:` — 22 срещания в 16 файла) — имената в `tokens.css` се пазят, сменят
  се само стойностите.
- `src/app/globals.css:4-10` вече обявява `--color-brand` с petrol; `tokens.css:20` го
  обявява с indigo. Два `@theme` с един ключ — последният печели мълчаливо.
- `nav-tree.test.ts` е с 78 адреса на pagagal — пренаписва се за нашата карта, не се копира.

## 2. Къде

| Файл                                                                          | Редове  | Роля                                                                            |
| ----------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------- |
| `src/modules/auth/index.ts`                                                   | 1-3     | главна: barrel — `getCurrentAdmin/signIn/signOut`                               |
| `src/modules/auth/*` (нови)                                                   | —       | главна: сесия в Redis, bootstrap акаунт, action-и                               |
| `src/modules/core/env.ts`                                                     | 5-26    | съгласуване: два нови незадължителни ключа                                      |
| `.env.example`                                                                | 20-21   | съгласуване: същите ключове, документирани                                      |
| `src/app/admin/**` (нови)                                                     | —       | главна: пазач, обвивка, вход, 8 екрана                                          |
| `src/app/globals.css`                                                         | 1-15    | съгласуване: един източник на токени                                            |
| `src/components/{nav,list,form,ui}/**`, `src/lib/cn.ts`, `src/hooks/*` (нови) | —       | главна: пренос                                                                  |
| `package.json`                                                                | 32-43   | съгласуване: `clsx`, `tailwind-merge`, `react-hook-form`, `@hookform/resolvers` |
| `src/app/layout.tsx`                                                          | 6-9     | само контекст — не се пипа                                                      |
| `eslint.config.mjs`                                                           | 131-149 | само контекст — `@/components/*` е разрешен                                     |

## 3. Как (посока, не готов код)

### 3.1 Карта на преноса `F:\01-PAGAGAL\packages\admin\src` → `F:\01DCARDS\src`

**Без промяна** (само пътят; `@/lib/cn` и `@/components/ui/*` се решават еднакво тук):
`lib/cn.ts` → `lib/cn.ts` · `hooks/{query-params,use-query-params,use-first-error-focus}.ts`
и `query-params.test.ts` → `hooks/` · `components/ui/{button,badge,checkbox,dialog,field,
field-label,select,switch,textarea,tooltip,tooltip-position,surface,radio-group,chip-group,
collapsible-section,use-collapsible,search-select}` + `dialog.test.tsx`,
`tooltip-position.test.ts` → `components/ui/` · `components/form/*` (4 файла + index) →
`components/form/` · `components/list/{card-grid-skeleton,cursor-pager,data-table,filter-bar,
list-state,page-pager,retry-button,row-action,search-filter,select-filter,table-skeleton}` →
`components/list/` · `components/nav/{sidebar,nav-column,nav-drawer}.tsx` → `components/nav/`.

**С редакция:**

| Източник                              | Цел                                             | Какво се променя                                                                                                                |
| ------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `components/list/index.ts`            | `components/list/index.ts`                      | пада `RestoreButton` (ред 7)                                                                                                    |
| `components/nav/nav-tree.ts`          | `components/nav/nav-tree.ts`                    | картата → § 3.4; `activeHref/activeSection` остават                                                                             |
| `components/nav/nav-tree.test.ts`     | същото                                          | пренаписан за нашата карта                                                                                                      |
| `components/nav/nav-icons.ts`         | същото                                          | само 6 иконки за секции + 7 за адреси; `DashboardIcon` остава                                                                   |
| `components/nav/nav-icons.test.ts`    | същото                                          | адресите → наши                                                                                                                 |
| `components/nav/nav-flags.ts` + test  | **не се пренася**                               | няма флагове; `nav-rail.tsx:10` и `nav-menu.tsx:15` четат `NAV_SECTIONS` направо; `VisibleNavSection` → `NavSection`            |
| `components/nav/nav-rail.tsx`         | същото                                          | `href="/"` и `pathname === '/'` (ред 111-115) → `/admin`; `PINNED_KEY` остава `settings`                                        |
| `components/nav/nav-menu.tsx`         | същото                                          | без `nav-flags`                                                                                                                 |
| `theme/tokens.css`                    | `src/theme/tokens.css`                          | стойности по § 3.5                                                                                                              |
| `app/globals.css`                     | `src/app/globals.css`                           | слива се с нашия: `@import` на tokens, `color-scheme`, `:focus-visible`; `@theme` от `globals.css:4-10` се маха                 |
| `app/layout.tsx`                      | `src/app/admin/layout.tsx`                      | само `metadata` (`title.template`, `robots noindex`); без `adminConfig` — името от `env().APP_NAME`                             |
| `app/(protected)/layout.tsx`          | `src/app/admin/(protected)/layout.tsx`          | § 3.3                                                                                                                           |
| `app/(protected)/logout-button.tsx`   | `src/app/admin/(protected)/logout-button.tsx`   | `api.post` → `signOut()` Server Action; редиректът е в action-а                                                                 |
| `app/(protected)/page.tsx`            | `src/app/admin/(protected)/page.tsx`            | без `serverGet/serverFetch`, без `OrdersBlock`; плочки от локален изглед                                                        |
| `app/(protected)/dashboard-tiles.tsx` | `src/app/admin/(protected)/dashboard-tiles.tsx` | локални типове `DashboardCounter { count: number \| null; href: string \| null }`, `DashboardView`; пада `BackupTile`; 5 плочки |
| `app/login/page.tsx`                  | `src/app/admin/(auth)/login/page.tsx`           | `serverGet('/auth/me')` → `getCurrentAdmin()`; влязъл → `redirect('/admin')`                                                    |
| `app/login/login-form.tsx`            | `src/app/admin/(auth)/login/login-form.tsx`     | `loginSchema/LoginInput` → от `@/modules/auth`; `api.post` → `signIn()`; `ApiError` → резултат `{ ok: false, message }`         |
| `config/site.ts`                      | **не се пренася**                               | всичко идва от `env()`                                                                                                          |

`components/ui/index.ts` няма и не се въвежда — pagagal внася по файл.

### 3.2 Модул `src/modules/auth`

Barrel изнася **само**: `getCurrentAdmin(): Promise<Admin | null>`, `signIn(input)`,
`signOut()`, `signInSchema` + `SignInInput` (Zod, имейл + парола — заместител на
`loginSchema`), тип `Admin { id; email; name }`. Server Action-ите са в отделен файл с
`'use server'`; barrel-ът го реекспортира.

- **Сесия** (AUTH-1, ARC-3): id — криптографски случаен, `crypto.randomBytes` през base64url;
  Redis ключ `session:<id>` с JSON на `Admin`; cookie `HttpOnly`, `SameSite=Lax`, `Path=/`,
  `Secure` при `NODE_ENV=production`. Срокът е една константа в модула, TTL-ът на ключа и
  `maxAge` на cookie-то се четат от нея; при всяко `getCurrentAdmin()` се подновява (плъзгащ).
  Стойността се записва в `decisions.md` (AUTH-4) — не се разпилява по файловете.
- **Временен акаунт:** `env.ts` получава `ADMIN_BOOTSTRAP_EMAIL` (`z.email().optional()`) и
  `ADMIN_BOOTSTRAP_PASSWORD` (`z.string().min(...).optional()`). Липсва ли някой — `signIn`
  отказва с общо съобщение, приложението не пада. Паролата от env се хешира с argon2id
  **веднъж при първо ползване** и се сверява с `argon2.verify` — така пътят „намери акаунт →
  провери хеш → отвори сесия" е същият, който етап 1 ще ползва с базата.
- **Смяната после:** единственото вътрешно място, което знае откъде идва акаунтът, е една
  функция `findAdminByEmail(email)`. Етап 1 я насочва към `users` (`is_admin`,
  `zadanie.md:194`) и маха двата env ключа; `layout.tsx`, формата и `LogoutButton` не се пипат.
- Грешна парола и непознат имейл връщат **едно и също** съобщение — не се издава кой имейл
  съществува. `signIn` не хвърля — връща резултат; при успех сам вика `redirect('/admin')`.
- `SESSION_SECRET` (`env.ts:13`) не се ползва в този цикъл — id-то е случайно, не подписано.
  Оставя се; премахването му е отделно решение.

### 3.3 Пазачът

**Вариант Б** (приет от диригента): `src/app/admin/layout.tsx` е само `metadata`; пазачът е в
`src/app/admin/(protected)/layout.tsx`, а входът в `src/app/admin/(auth)/login/page.tsx`.
Вариант А (пазач в `admin/layout.tsx`) затваря кръг — входът е зад пазача.
Адресът остава `/admin/login`; и двата се индексират `noindex`. Пазачът е сървърен async
layout: `getCurrentAdmin()` → `null` → `redirect('/admin/login')`. Обвивката от
`(protected)/layout.tsx:57-86` се пази без `StorefrontLink`, `NotificationsButton`,
`isOperatorRole` и заявката за `seo` (`ред 46`); в лентата остават drawer, име на панела
(`env().APP_NAME`), имейлът на влезлия и „Изход".

`/admin/login` вместо `/login`: клиентският dashboard (`src/app/app/`) ще има свой вход на
`/login` за организации — двата не бива да делят адрес и форма.

### 3.4 Картата (`nav-tree.ts`)

Ключове и редове (`as const satisfies`, както в оригинала `nav-tree.ts:23-26`):
`orders` „Поръчки" → `/admin/orders` · `cards` „Карти" → `/admin/batches` „Партиди",
`/admin/cards` „Карти" · `customers` „Клиенти" → `/admin/users` „Потребители", `/admin/orgs`
„Организации" · `shop` „Магазин" → `/admin/products` „Продукти" · `settings` „Настройки" →
`/admin/settings` „Настройки" (закачена долу, `PINNED_KEY`). Таблото е `/admin`, извън
картата, както в `nav-rail.tsx:110-122`.

**„Предстои":** един сървърен компонент `src/app/admin/(protected)/coming-soon.tsx`
(`{ title }` → заглавие + едно изречение). Седем `page.tsx` (`orders`, `batches`, `cards`,
`users`, `orgs`, `products`, `settings`) са по няколко реда: `metadata.title` + `<ComingSoon>`.
Не пет копия на разметката.

### 3.5 Токените

`src/theme/tokens.css` пази **всички имена** от pagagal (компонентите ги ползват), а
стойностите се насочват към `docs/design.md`: `brand` → `#4E6E7A`, `text` → `#2F4A54`,
`page` → `#F4F6F5`, `border`/`nav-hover`/`surface-muted` — от `sand`, `rail-active` →
`brand` (не червено), `rail-active-ink` → `ink`. Добавят се и днешните `--color-bg`,
`--color-ink`, `--color-sand`, `--color-brass` (публичната част ги ползва). Смисловите
тонове (`success/warning/danger/info`) не са марка — остават. Числата в коментара за контраст
(`tokens.css:47-52, 61-72`) са мерени за indigo — програмистът ги **маха**, не ги преписва;
нови не се измислят без измерване. `brass` не се ползва за дребен текст (`design.md:19-20`).

### 3.6 Ред на работа

1. зависимости + `cn.ts` + `tokens.css` + `globals.css` · 2. `ui`, `hooks`, `form`, `list` (без
   промени, `pnpm typecheck` след всяка група) · 3. `auth` модул + env · 4. `nav` с новата карта +
   тестове · 5. `admin/` екрани · 6. проверки по пипнатите модули.

## 4. Какво НЕ се пипа

- `src/modules/platform`, `src/modules/shop` — нито barrel, нито файл.
- Схемата на базата: **няма миграции, няма `*.schema.ts`, няма таблица `users`** (етап 1).
- `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/api/health/*`.
- `src/modules/core/{db,redis}/*` — Redis клиентът се ползва през barrel-а, не се променя.
- `deploy/`, `scripts/`, `docker-compose*.yml`, nginx, прод `.env` (правило 5 в `CLAUDE.md`).
- `eslint.config.mjs`, `tsconfig.json`, `vitest.config.ts` — пренесените файлове се
  съобразяват с линтера, не обратното. Никакъв `eslint-disable`.
- Непренасяните части на pagagal: `rich-text-*`, `color-chip`, `media/`, `markets`, `seo`,
  `ai`, `faq`, `restore-button`, `lib/api`, `lib/server-api`, `config/site`, `nav-flags`.
- Цветовете **вътре** в компонентите — само стойностите на токените се менят.
- Роли, права по секции, rate limit на входа, „забравена парола" — етап 1 (виж § 7 бележка).

## 5. Приемни критерии

- [ ] `/admin/login` с непознат имейл или грешна парола показва едно и също съобщение за
      грешка, без да казва кое от двете е сгрешено; адресът не се променя.
- [ ] `/admin/login` с имейла и паролата от `.env` води до `/admin` (таблото) и в браузъра има
      само една сесийна cookie — `HttpOnly`, без стойност на четене от JS.
- [ ] `/admin/orders` (и всеки друг `/admin/*`) без сесия пренасочва към `/admin/login`, без
      да е изпратил разметката на защитения екран.
- [ ] Влязъл потребител на `/admin/login` бива пренасочен към `/admin`.
- [ ] „Изход" изтрива сесията: след него `/admin` пренасочва към входа, а старата cookie не
      отваря нищо, дори да бъде върната ръчно.
- [ ] Липсват ли `ADMIN_BOOTSTRAP_*` в `.env` — приложението стартира, входът отказва.
- [ ] Широк екран: лента с „Табло", петте секции и „Настройки" долу; колоната показва
      подсекциите на избраната секция; на `/admin/cards` свети „Карти" в лентата и „Карти" в
      колоната; на `/admin` нищо в секциите не свети.
- [ ] Тесен екран (под прага `wide`): панелът го няма, бутон „Меню" отваря чекмедже със същата
      навигация; избор на подсекция го затваря; `Esc` го затваря.
- [ ] Всяка от седемте подсекции показва екран „предстои" със своето заглавие; таблото показва
      плочки към петте секции.
- [ ] Палитрата е на dcards: фон off-white, акцент petrol, активната клетка в лентата не е
      червена.
- [ ] `pnpm verify` минава с нула предупреждения — включително за пренесените файлове.
- [ ] `/admin/*` отговаря с `noindex` в `<meta name="robots">`.

## 6. Как се проверява

**Машинно:**

```bash
pnpm verify
pnpm build
```

**Ръчно** (`pnpm infra:up`, `.env` с `ADMIN_BOOTSTRAP_EMAIL/PASSWORD`, `pnpm dev`, :3100):

1. Отвори `http://localhost:3100/admin/orders` без вход → адресът става `/admin/login`.
2. Въведи верния имейл и грешна парола → съобщение за грешка; после непознат имейл → същият
   текст.
3. Въведи верните данни → `/admin` с таблото; DevTools → Application → Cookies: една сесийна
   cookie с отметка HttpOnly.
4. Щракни „Карти" в лентата → колоната показва „Партиди", „Карти"; отвори „Партиди" →
   екран „предстои", „Карти" свети в лентата, „Партиди" в колоната.
5. Обиколи седемте подсекции — всяка е „предстои" със свое заглавие; „Настройки" е долу.
6. Стесни прозореца под прага → лентата изчезва, „Меню" отваря чекмеджето; избери
   „Поръчки" → чекмеджето се затваря и екранът е `/admin/orders`.
7. Отвори `/admin/login` докато си влязъл → връща те на `/admin`.
8. „Изход" → `/admin/login`; отвори `/admin` → пак вход.
9. Спри Redis → `/admin` не показва stack trace, а води към входа (ARC-3: загубен Redis =
   излизане).

**Регресия — какво НЕ трябва да се счупи:**

- `/` (публичната страница) изглежда както преди: `--color-bg/ink` продължават да съществуват
  след сливането на `@theme`.
- `/api/health/ready` отговаря както преди.
- `pnpm test` — `env.test.ts` минава: новите ключове са незадължителни.
- `pnpm build` минава.

## 7. Блокиращи въпроси

Няма. Бележка за етап „сигурност" (не блокира): входът няма ограничение на опитите. ARC-3
предвижда rate limit в Redis; препоръката е отделен малък цикъл преди прод деплой на админа,
а не разширяване на този.
