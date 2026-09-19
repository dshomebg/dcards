# `PLT-5` — Редактор на профил в `/app/profiles/{id}`

**Тежест:** голяма — Server Actions пишат и трият по `id` от URL (IDOR), пипат
`profiles`/`profile_links`, плюс промяна в споделения `ProfileView`.
**Заявено:** 2026-09-19
**Сверено с кода:** 2026-09-19 — всеки `файл:ред` по-долу е отворен наново, не
преписан от заявката.

## Дневник на етапите

| Етап         | Изпълнител | Кога       | Резултат                                                     |
| ------------ | ---------- | ---------- | ------------------------------------------------------------ |
| анализ       | analyzer   | 2026-09-19 | задание                                                      |
| код          | programmer | 2026-09-19 | готово; 5 отклонения приети                                  |
| ревю         | reviewer   | 2026-09-19 | готово с уговорки — `touchProfile`, `primaryColor` поправени |
| сигурност    | security   | 2026-09-19 | без експлоатируеми; 1 наблюдение затворено                   |
| тестове      | programmer | 2026-09-19 | 115 теста; Playwright вкл. rollback и изтриване              |
| документация | диригентът | 2026-09-19 | ARC-10/11, worklog, open-items, roadmap                      |

## 1. Какво не е наред

`/app/profiles/{id}` е заглушка (`profiles/[id]/page.tsx:12` — `ComingSoon`). След
„Нов профил" (само име + адрес) клиентът няма как да добави длъжност, bio, линкове,
да смени темата, да скрие или изтрие профила. Последният ред от § 7.2 за етап 1.

**Сверка с кода — разлики спрямо заявката:**

- `profile.service.ts:1` обещава „Редакция/изтриване — PLT-5"; `ProfileError.code`
  вече е замислен за редактора (`:49`). Потвърдено.
- `profile-view.tsx:1-11`: без `'use client'`, без `async`, без `server-only`; внася
  само barrel-а на `platform` и `ShareButton` (клиент). Barrel-ът вече се внася от
  клиентска форма (`new/schema.ts:3`, ARC-5) — значи `ProfileView` **може** да се
  внесе от client component. Но: коренът му е `<main>` (`:98`) — вложен в страницата
  на редактора дава два `<main>`; и `<img src="/api/qr/{slug}">` (`:82`) се зарежда и
  при затворен панел.
- `profile-theme.css:34-38` слага `min-height: 100vh` на `[data-profile-theme]` — в
  рамка на телефон трябва override. CSS-ът се внася само от `[slug]/page.tsx:4`.
- `columns.ts:21-25`: `updated_at` е с `$onUpdate` в приложението — Drizzle го
  подава при `update().set()` без изрична стойност; **db тестът го доказва**.
- `profile_links` (`profile.schema.ts:90-92`) е с `onDelete: 'cascade'` и **без**
  `org_id` — собствеността на линковете минава само през `profiles`.
- `RadioGroup` (`radio-group.tsx:7-18`) няма слот за цветна мостра; `ConfirmDialog`
  (`dialog.tsx:25`) има `pending`/`error` — готов за изтриването.
- `createProfileInputSchema` (`profile.service.ts:97-118`) не е в barrel-а;
  линковата схема е inline — трябва изваждане, за да се преизползва.

## 2. Къде

| Файл                                                                                                | Редове       | Роля                                                      |
| --------------------------------------------------------------------------------------------------- | ------------ | --------------------------------------------------------- |
| `src/modules/platform/profile.service.ts`                                                           | 29-118, край | главна: нов код `profile_not_found`, схеми, 4 сервиза     |
| `src/modules/platform/profile.repository.ts`                                                        | край         | главна: 5 нови заявки, всички с `orgId` И `id`            |
| `src/modules/platform/index.ts`                                                                     | 18-24        | съгласуване: новите сервизи, DTO типове, схемите на линка |
| `src/app/app/(protected)/profiles/[id]/page.tsx`                                                    | 1-13         | главна: замества заглушката                               |
| `src/app/app/(protected)/profiles/[id]/{actions,schema}.ts`                                         | нови         | главна                                                    |
| `.../profiles/[id]/{profile-editor,profile-fields,links-fields,profile-preview,delete-profile}.tsx` | нови         | главна: под 300 реда всеки (COD-1)                        |
| `src/app/[slug]/profile-view.tsx`                                                                   | 93-143       | съгласуване: корен `<div>`, без друга промяна             |
| `src/app/[slug]/page.tsx`                                                                           | 64           | съгласуване: обвива в `<main>`                            |
| `src/app/[slug]/profile-theme.css`                                                                  | 34-38        | само за контекст (override е в редактора)                 |
| `src/app/app/(protected)/profiles/new/{actions,new-profile-form}.tsx`                               | —            | само за контекст: образец за action/форма                 |

## 3. Как (посока, не готов код)

### 3.1 Сервиз и хранилище (`platform`)

- Нов `ProfileErrorCode` `'profile_not_found'` → „Профилът не съществува.". Един и
  същ отговор за чужд и за несъществуващ `id` (както DAT-7 за `/{slug}`).
- Схеми (DAT-8): извади inline обекта на линка като `profileLinkInputSchema`;
  `profileLinksInputSchema = z.array(profileLinkInputSchema).max(50)`;
  `updateProfileInputSchema = createProfileInputSchema.omit({ orgId, links })` с
  `theme: profileThemeSchema` и `isPublic: z.boolean()` **задължителни** (формата
  винаги праща всичко — няма частичен update). `slug` минава през `assertSlug`.
  Излизат през barrel-а — клиентската `schema.ts` ги композира с български
  съобщения (образец `new/schema.ts:7-15`), без да ги преписва.
- `ProfileEditDto` (DAT-7, изричен): `id, slug, firstName, lastName, title, company,
bio, theme (през safeTheme), isPublic, updatedAt, links: { id, type, label, value,
isVisible, sortOrder }[]`. Без `photoKey`/`logoKey`.
- `getProfileForEdit(executor, orgId, profileId): Promise<ProfileEditDto | null>` —
  `findProfileByOrgAndId` (`where org_id = $1 and id = $2`) + `findLinksByProfile`
  (всички, `sortOrder, id` — `findVisibleLinks` филтрира видимите, не става).
- `updateProfile(executor, orgId, profileId, input): Promise<ProfileEditDto>` —
  Zod → `assertSlug` → `update profiles set … where org_id = $1 and id = $2
returning *`; 0 реда → `profile_not_found`. **Без** предварително четене и без
  `slugExists` — уникалният индекс + `isUniqueViolation` → `slug_taken`; спестява
  заявката и е без TOCTOU. `updatedAt` не се задава — `$onUpdate`.
- `replaceProfileLinks(executor, orgId, profileId, links): Promise<ProfileEditDto['links']>`
  в транзакция: `lockOrganization` (лимитът, както при create) → **`update profiles
set updated_at = now() where org_id = $1 and id = $2 returning id`** — една
  заявка е и проверка за собственост, и заключване на реда, и bump на `updated_at`
  → 0 реда → `profile_not_found` → `can(org, 'links', links.length - 1)` (същата
  аритметика като `assertLimits:141`) → `delete from profile_links where profile_id` →
  insert със `sortOrder = index`. **Delete + insert**, не diff: идентичността на линк
  няма външна стойност (няма статистика по линк).
- `deleteProfile(executor, orgId, profileId): Promise<void>` — `delete … where
org_id = $1 and id = $2 returning id`; 0 реда → `profile_not_found`; линковете
  падат по cascade.

### 3.2 Slug — редактируем (прието)

Чипът носи `/c/{card_id}` (`zadanie.md:22,49`), не slug — смяната не го чупи.
Чупи споделени линкове и **свалени/отпечатани QR** (`/api/qr/{slug}` кодира
`APP_URL/{slug}`, ARC-9). Решение: редактируем, същите проверки като при
създаване; `hint` под полето: „Чипът на картата не зависи от адреса. Споделени
линкове и вече свалени QR кодове ще спрат да работят."

### 3.3 Страница и actions

- `page.tsx`: `z.uuid()` върху `params.id` → невалиден → `notFound()` **преди**
  базата; `requireCurrent()` → `getProfileForEdit(db, org.id, id)` → `null` →
  `notFound()`; `env()` за `APP_NAME/APP_URL`; внася `profile-theme.css` (изрично
  изключение от PLT-4 § 3.5 — само тук, за превюто). Рендира
  `<ProfileEditor profile appName appUrl />`.
- `actions.ts` (`'use server'`), образец `new/actions.ts`: Zod (клиентската схема,
  `input: unknown`) → `requireCurrent()` → `isOrgMember` → сервиз с `org.id` →
  `ProfileError` → `{ ok: false, message }`; друга грешка → общ текст, `cause` в лога
  (DAT-6). `profileId` идва като отделен аргумент и минава през `z.uuid()`.
  - **Един `saveProfileAction(profileId, input)`** (прието) =
    `db.transaction(tx => updateProfile(tx, …) + replaceProfileLinks(tx, …))` →
    успех `{ ok: true, profile: ProfileEditDto }`. Две отделни action-и от един бутон
    „Запази" дават полузаписан профил при втори отказ.
  - `deleteProfileAction(profileId)` → успех → `redirect('/app')` (хвърля, извън
    `try`, както `new/actions.ts:34`).
- **Освежаване след запис:** action-ът връща DTO и формата прави
  `reset(toFormValues(dto))`. Без `router.refresh()`.

### 3.4 Форма (client), разделена по секции

- `profile-editor.tsx` — `useForm` + `zodResolver(profileFormSchema)`,
  `defaultValues` от DTO, submit, обща грешка (`role="alert"`), разположение:
  колона форма + колона превю (на мобилно превюто отдолу). Обвивка `FormLayout`/
  `FormSection` от `@/components/form` (FormLayout има `<main>` — коренът на
  страницата тогава е `<div>`).
- `profile-fields.tsx` — Основни (`Field` ×4, `Textarea` за bio), Адрес (slug +
  hint от 3.2), Тема (`RadioGroup` с „Светла/Тъмна/Пясък" — **без** цветни мостри:
  живото превю Е мострата), Видимост (`Switch` `isPublic`, hint „Скритият профил
  дава 404 на `/{slug}`").
- `links-fields.tsx` — `useFieldArray('links')`; ред: `Select` тип
  (`PROFILE_LINK_TYPES` + `LINK_LABELS`), `Field` етикет (placeholder = подразбирания
  по тип), `Field` стойност, `Switch` видим, бутони ↑/↓ (`aria-label`, `swap(i, i±1)`,
  disabled в краищата), „Премахни"; „Добави линк" винаги активен — лимитът го казва
  сървърът. Без drag-and-drop в v1.
- `profile-preview.tsx` — **вариант (в)** (прието): `useWatch` → `PublicProfile` →
  `<ProfileView>` от `@/app/[slug]/profile-view` в рамка на телефон. Правила: `slug`
  в превюто е **записаният** (от DTO), не живият — иначе всеки клавиш в „Адрес" дърпа
  `/api/qr/{нов-slug}` (404); линкове = само `isVisible`, в реда на формата, `label:
'' → null`; `theme = { preset, primaryColor: null, layout: 'default' }`. Рамката е с
  `inert` („Сподели" и vCard в превю не бива да работят) и локален override
  `min-height: 100%`.
- `delete-profile.tsx` — „Опасна зона": `Button variant="danger"` → `ConfirmDialog`
  (`pending`, `error` от action-а).
- `ProfileView`: корен `<main>` → `<div>`; `[slug]/page.tsx:64` го обвива в
  `<main>`. Единствената промяна в публичната страница.

## 4. Какво НЕ се пипа

- Снимка/лого (`photoKey`, `logoKey`, `core/storage`) — отделен цикъл.
- `theme.primaryColor` и `layout` — остават без UI; схемата ги приема, формата
  праща `null`/`'default'`. Pro теми — `can(org, 'customTheme')` не се вика.
- Drag-and-drop подредба; покани/членове; карти (`/c/{id}`).
- Кеш/`updated_at`-ключ на `/{slug}` (ARC-6, open-items).
- `createProfile`, `findPublicProfileBySlug`, `listProfiles` — без промяна в
  поведението; извадената линкова схема трябва да валидира еднакво.
- `RadioGroup`, `Switch`, `Select`, `Field`, `ConfirmDialog` — не се разширяват.
- `profile-theme.css` — override-ът е в редактора, не там.
- `requireCurrent` и `isOrgMember` — ползват се, не се променят.
- Rate limit на Server Actions — open-items, преди прод.

## 5. Приемни критерии

- [ ] `/app/profiles/{id}` показва всички полета и линкове на профил от моята org;
      чужд `id`, несъществуващ `id` и не-UUID дават 404, неразличими.
- [ ] Запис променя име, фамилия, длъжност, фирма, bio, тема, видимост и адрес;
      след запис формата показва записаните стойности без презареждане.
- [ ] Адрес зает/резервиран/невалиден → съобщение във формата, нищо не се записва.
- [ ] Линкове: добавяне, премахване, ↑/↓, скриване; след запис `/{slug}` показва
      само видимите в новия ред.
- [ ] Free org със 7 линка → „Планът Free позволява до 6 линка.", старите линкове
      остават непокътнати (транзакция).
- [ ] Подправен `profileId` на чужда org в action → съобщение „Профилът не
      съществува.", нулеви промени в чуждия ред.
- [ ] Изтриване иска потвърждение; след него `/app` е без профила, `/{slug}` е 404,
      линковете са изтрити.
- [ ] Превюто се обновява при всяко въвеждане (име, bio, тема, линкове, скрит линк
      изчезва), без заявки към `/api/qr` при писане в „Адрес".
- [ ] `updated_at` на профила се променя и при запис на полета, и при запис само на
      линкове.
- [ ] `/{slug}` изглежда както преди (`<main>` е пак коренът на страницата).
- [ ] Всеки нов `.tsx` е под 300 реда; функция под 120 (COD-1).

## 6. Как се проверява

**Машинно:** `pnpm verify`.

Тестове:

- **db** (`profile.service.db.test.ts`): `getProfileForEdit` — своя org: всички
  линкове вкл. скритите по `sortOrder`; чужда org → `null`. `updateProfile` — чужда
  org → `profile_not_found` и редът е байт-за-байт същият; свой → `updatedAt >`
  предишния; slug на друг профил → `slug_taken`; резервиран → `slug_reserved`.
  `replaceProfileLinks` — нов ред и `sortOrder = index`; Free със 7 → `plan_limit_links`
  и старите линкове на място; чужда org → `profile_not_found` без изтриване;
  `updatedAt` се променя. `deleteProfile` — cascade на линковете; чужда org → грешка,
  редът остава.
- **node** (`profiles/[id]/actions.test.ts`, образец `new/actions.test.ts`): не-UUID
  `profileId` → отказ без сесия; без сесия → `REDIRECT:/login`; не член → отказ;
  `ProfileError('profile_not_found')` от сервиза → неговото `message` (не
  `notFound`); успех → `{ ok: true, profile }`; delete → `REDIRECT:/app`;
  `orgId` в input се игнорира. Mock на `db` с `transaction: (fn) => fn({})`.
- **dom** (`profile-editor.test.tsx`, `links-fields.test.tsx`): рендира петте
  секции с данните на DTO; „Добави линк" добавя ред, „Премахни" го маха; ↓ на
  първия ред разменя двата; празно име → грешка от Zod без action; отказ от action →
  `role="alert"`. `profile-preview.test.tsx`: скрит линк не е в превюто;
  `data-profile-theme` следва избора.

**Ръчно:**

1. `pnpm db:seed:demo`, вход, `/app` → клик на профила → редакторът с полетата на
   демото и превю вдясно (на телефон: отдолу).
2. Смени bio и темата на „Тъмна" → превюто се сменя веднага; „Запази" → отвори
   `/demo` в нов таб → същото.
3. Добави 7-и линк (Free) → „Запази" → съобщението за лимита; в `/demo` нищо ново.
4. Скрий линк, качи друг с ↑, „Запази" → `/demo` без скрития, в новия ред.
5. Смени адреса на `demo-2`, „Запази" → превюто и списъкът в `/app` сочат `/demo-2`;
   `/demo` → 404.
6. Отвори `/app/profiles/<uuid от друга org>` и `/app/profiles/abc` → 404 и двете.
7. „Изтрий" → диалог → потвърди → `/app` празен; `/demo-2` → 404.

**Регресия — какво НЕ трябва да се счупи:**

- `/{slug}`: рендер, `data-profile-theme`, „Запази контакт", QR панел, „Сподели".
- „Нов профил" и лимитът на профили (`createProfile` ползва извадената схема).
- `pnpm db:seed:demo` (вика `createProfile`).

## 7. Блокиращи въпроси

Няма. Приети: един `saveProfileAction`; slug редактируем; превю през `ProfileView`;
↑/↓ без drag-and-drop; `ConfirmDialog` за изтриване.
