# `SHP-1` — Продукти и варианти: схема, сервиз, админ CRUD

**Тежест:** голяма — нова схема (миграция `0004`), цени (MON-1), админ Server Actions;
повърхността (`shop` barrel) ще се ползва от SHP-2.
**Заявено:** 2026-09-20
**Сверено с кода:** 2026-09-20 — всеки `файл:ред` по-долу е отворен наново, не преписан от заявката.

## Дневник на етапите

| Етап         | Изпълнител | Кога       | Резултат                                                    |
| ------------ | ---------- | ---------- | ----------------------------------------------------------- |
| анализ       | analyzer   | 2026-09-20 | задание                                                     |
| код          | programmer | 2026-09-20 | готово; 5 отклонения приети                                 |
| ревю         | reviewer   | 2026-09-20 | готово с уговорки — дублиран id отхвърлен; 1–2 → open-items |
| сигурност    | security   | 2026-09-20 | 1 ниска (фалшив price_negative) поправена                   |
| тестове      | programmer | 2026-09-20 | 383 теста; Playwright пълен сценарий                        |
| документация | диригентът | 2026-09-20 | MON-2/3, worklog, open-items                                |

## 1. Какво не е наред

`/admin/products` е `ComingSoon`. Няма таблици за продукти, няма сервиз, `src/modules/shop/index.ts`
е `export {}`. Витрината (SHP-2) няма откъде да чете продукти и цени.

**Сверка с кода — разлики спрямо заявката:**

- `isUniqueViolation` съществува два пъти: `core/db/errors.ts` (изнесен през `@/modules/core`) и
  `platform/profile.service.ts:154`. `shop` ползва **core**. Нито един не връща името на
  constraint-а — тук трябва да различим `slug` от `sku` (§ 3.2).
- `RESERVED_SLUGS` вече има `products`. Продуктовият slug живее под `/products/{slug}` — отделно
  пространство, резервиран списък НЕ му трябва.
- `nav-tree.ts` и `nav-icons.ts` вече имат `/admin/products` — не се пипат.
- `env.ts` има `STORE_CURRENCY`/`STORE_LOCALE`; никъде в `src/` няма `Intl.NumberFormat` за пари.
- `core/db/schema.ts` внася схеми по файл — `shop/product.schema.ts` се добавя там.
- Таблото `admin/(protected)/page.tsx` държи `shop: { count: null }` нарочно — извън обхвата.

## 2. Къде

| Файл                                                                                     | Редове | Роля                                                                                        |
| ---------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------- |
| `src/modules/shop/money.ts` (нов)                                                        | —      | `parsePriceInput` (лева-низ → minor units), `formatPriceInput`, `formatPrice`               |
| `src/modules/shop/product.schema.ts` (нов)                                               | —      | `products`, `productVariants`, enum, `PRODUCT_SLUG_PATTERN`, публични DTO типове            |
| `src/modules/shop/product.repository.ts` (нов)                                           | —      | единственият SQL за двете таблици                                                           |
| `src/modules/shop/product.service.ts` (нов)                                              | —      | `ProductError`, Zod схеми, `createProduct`, `listProductsForAdmin`, публичните четения      |
| `src/modules/shop/product-edit.service.ts` (нов)                                         | —      | `getProductForEdit`, `updateProduct`, `replaceVariants`, `deleteProduct`                    |
| `src/modules/shop/index.ts`                                                              | 1-3    | главна промяна: barrel                                                                      |
| `src/modules/core/db/schema.ts`                                                          | 4-8    | съгласуване: регистрира `../../shop/product.schema`                                         |
| `src/modules/core/db/errors.ts`, `core/index.ts`                                         | 4-9    | `uniqueViolationConstraint(error): string \| null` (чете `cause.constraint`)                |
| `drizzle/0004_products_variants.sql` + `meta/`                                           | —      | генерирана с `drizzle-kit generate` (DAT-1)                                                 |
| `src/app/admin/(protected)/products/page.tsx`                                            | 1-10   | главна промяна: списък вместо `ComingSoon`                                                  |
| `src/app/admin/(protected)/products/{schema,actions}.ts` (нови)                          | —      | форма-схема (лева като низ), Server Actions                                                 |
| `.../products/{product-editor,product-fields,variants-fields,delete-product}.tsx` (нови) | —      | редактор, споделен от `new` и `[id]`                                                        |
| `.../products/new/page.tsx`, `.../products/[id]/page.tsx` (нови)                         | —      | създаване и редакция                                                                        |
| `src/modules/platform/profile.schema.ts`                                                 | 52-81  | само за контекст: образец за CHECK със `sql.raw`                                            |
| `src/modules/platform/profile-edit.service.ts`                                           | 92-187 | само за контекст: образец за DTO/транзакции                                                 |
| `src/app/app/(protected)/profiles/[id]/{actions.ts,links-fields.tsx,schema.ts}`          | —      | само за контекст: action в транзакция, `useFieldArray`, `toFormValues`                      |
| `src/app/admin/(protected)/batches/actions.ts`                                           | 41-69  | само за контекст: ред Zod → `requireAdmin` → `adminActionLimit` → сервиз → `revalidatePath` |

## 3. Как (посока, не готов код)

### 3.1 Схема (`product.schema.ts`, миграция `0004`)

- `products`: `id` (`primaryId`), `slug text not null`, `name text not null`, `description text`
  (nullable, plain text с нови редове; НЕ markdown), `material product_material not null`
  (`PRODUCT_MATERIALS = ['pvc','metal','wood']`), `basePrice integer not null` (minor units,
  MON-1), `isActive boolean not null default true`, `images jsonb not null default '[]'` с
  `$type<readonly string[]>()` — storage още няма; този цикъл винаги пише `[]`; четенето минава
  през `safeParse` с fallback `[]`; `createdAt`, `updatedAt`.
  Ограничения: `uniqueIndex('products_slug_idx')`, `check('products_slug_format', slug ~
PRODUCT_SLUG_PATTERN)` през `sql.raw`, `check('products_base_price_nonneg', base_price >= 0)`.
- `PRODUCT_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/` (3–60) + `productSlugSchema`
  (Zod, българско съобщение). Отделен от `platform/slug.ts` — `shop` не внася `platform`.
- `product_variants`: `id`, `productId → products.id onDelete cascade`, `name text not null`,
  `priceDelta integer not null default 0` (може отрицателен), `sku text` (nullable), `stock
integer not null default 0`, `isActive boolean not null default true`, `sortOrder integer not
null default 0`. Индекси: `product_variants_product_idx (productId, sortOrder)`,
  `uniqueIndex('product_variants_sku_idx')` on `sku` (NULL се пропуска),
  `check('product_variants_stock_nonneg', stock >= 0)`.
- `base_price + price_delta >= 0` е междутаблично — пази се в сервиза (§ 3.3).
- `order_items.variant_id` (SHP-2) ще сочи варианти с `restrict`; засега няма FK. Коментар в
  схемата + § 4.

### 3.2 Пари (`money.ts`) и грешки

- Цените са цели числа в **minor units**; валутата е `STORE_CURRENCY`, кодът не я знае.
- `parsePriceInput(raw, {allowNegative}): number | null` — низ по `^-?\d{1,7}([.,]\d{1,2})?$`,
  разделител точка ИЛИ запетая, смята с цели числа (`whole*100 + fraction`), **без float**.
  Невалиден → `null`. `formatPriceInput(minor)` → `'12.50'` (обратната, без `Intl`).
- `formatPrice(minor, {currency, locale})` — `Intl.NumberFormat(locale, {style:'currency',
currency})` върху `minor/100` (само за показване). Чиста функция: страниците подават `env()`;
  клиентските компоненти го получават като prop.
- `ProductError` с кодове: `input_invalid`, `slug_invalid`, `slug_taken`, `sku_taken`,
  `sku_duplicate`, `price_negative`, `variant_foreign`, `product_not_found`. Български съобщения.
- Уникално нарушение: `uniqueViolationConstraint(error)` от core → `products_slug_idx` →
  `slug_taken`, `product_variants_sku_idx` → `sku_taken`, друго → рехвърля.

### 3.3 Сервиз (DAT-8 — Zod за целия вход; входът е в minor units)

- `productFieldsInputSchema`: `slug`, `name` trim 1–120, `description` trim ≤ 2000 nullish,
  `material` enum, `basePrice` `z.int().min(0).max(10_000_000)`, `isActive` boolean.
- `variantInputSchema`: `id: z.uuid().optional()`, `name` 1–80, `priceDelta` `z.int()` в
  `[-10_000_000, 10_000_000]`, `sku` trim ≤ 64 nullish (празно → `null`), `stock`
  `z.int().min(0).max(1_000_000)`, `isActive`. `variantsInputSchema = z.array(...).max(50)` +
  `refine`: без дублирани не-null SKU → `sku_duplicate`.
- `createProduct(executor, {fields, variants?})` — една транзакция: insert продукт, insert
  варианти (`sortOrder` = индекс), проверка `basePrice + priceDelta >= 0` преди insert.
- `updateProduct(executor, id, fields)` — `UPDATE ... RETURNING`; `null` → `product_not_found`.
  После `SELECT min(price_delta)`; `base + min < 0` → `price_negative`.
- `replaceVariants(executor, productId, variants[])` — **upsert по `id`, НЕ delete+insert**:
  identity на варианта има външна стойност (SHP-2 `order_items`). В транзакция: (1) `FOR UPDATE`
  на продукта (взима `basePrice`; липсва → `product_not_found`); (2) чете съществуващите id; вход
  с чужд `id` → `variant_foreign`; (3) `basePrice + delta >= 0` за всички; (4) `DELETE`
  липсващите; (5) `UPDATE` по `(id, productId)`; (6) `INSERT` новите; `sortOrder` = индекс.
  Коментар: при `restrict` от SHP-2 (4) ще пада за варианти с поръчки — тогава `isActive=false`.
- `deleteProduct(executor, id)` — cascade; `false` → `product_not_found`.
- `listProductsForAdmin` → `{id, slug, name, material, basePrice, variantCount, isActive,
updatedAt}` по `createdAt, id`.
- `getProductForEdit(executor, id): ProductEditDto | null` — всички полета + всички варианти.
- Публични DTO (за SHP-2; DAT-7): `PublicProductSummary {slug, name, material, basePrice}` от
  `listActiveProducts`; `PublicProduct {slug, name, description, material, basePrice, variants:
{id, name, price, inStock}[]}` от `getActiveProductBySlug` — `null` за неактивен и непознат;
  само активни варианти; точният `stock` НЕ излиза. `id` на варианта е публичен — количката го
  праща обратно, цената се преизчислява на сървъра (MON-1).

### 3.4 Barrel (`shop/index.ts`)

Изнася: константи, `productSlugSchema`, `parsePriceInput`, `formatPriceInput`, `formatPrice`,
`ProductError`, Zod схемите, сервизните функции и DTO типове. Таблиците НЕ се изнасят. `shop` не
внася `@/modules/platform` и обратно.

### 3.5 Админ (`/admin/products`)

- Всяка страница и action: `requireAdmin()`, `adminActionLimit`; `logUnexpected` само
  code/constraint (DAT-6).
- `products/page.tsx`: `DataTable` — име (линк), материал (BG етикет от `MATERIAL_LABELS` в
  app-слоя), базова цена (`formatPrice` с `env()`), варианти (брой), `Badge` активен/неактивен.
  `ListState` при празно + „Нов продукт".
- `products/schema.ts`: формата държи низове; `basePrice` и `variants[].priceDelta` са низове в
  лева → `z.string().transform` през `parsePriceInput` с `ctx.addIssue` („Цена като 12.50");
  `stock` число; `sku`/`description` `''` → `null`. `toFormValues(dto)` през `formatPriceInput`.
- `product-editor.tsx` (client): `FormLayout` + `FormActions`, `mode: 'create' | 'edit'`; при
  `edit` успехът връща DTO и `reset(toFormValues(...))`; при `create` action-ът `redirect`-ва.
  `product-fields.tsx`: slug, име, описание (`Textarea`), материал (`Select`), базова цена
  (`inputMode="decimal"`), активен (`Switch`). `variants-fields.tsx`: `useFieldArray` — име,
  delta, SKU, наличност, активен, ↑/↓, „Премахни", „Добави вариант"; скрито поле `id`.
  `delete-product.tsx`: `ConfirmDialog`.
- `actions.ts`: `createProductAction(input)` → `revalidatePath` → `redirect`;
  `saveProductAction(id, input)` → **една** `db.transaction` с `updateProduct` +
  `replaceVariants`, връща `{ok, product}`; `deleteProductAction(id)` → `redirect`.
- `[id]/page.tsx`: `z.uuid()`, `notFound()` при `null`.

## 4. Какво НЕ се пипа

- Витрина: `/products`, `/products/[slug]`, `/`, количка, checkout, `orders` — SHP-2.
- Качване/показване на снимки, `core/storage` — `images` остава `[]` без UI.
- Категории, търсене, филтри, пагинация.
- `platform/slug.ts`, `RESERVED_SLUGS`, `profile.service.ts:154`.
- `nav-tree.ts`, `nav-icons.ts`, таблото.
- `env.ts` — нови променливи не се добавят.
- `replaceProfileLinks` (ARC-10) — delete+insert остава за линковете.
- Soft-delete на варианти при `restrict` — идва със SHP-2.

## 5. Приемни критерии

- [ ] `pnpm db:migrate` върху чиста база минава през `0000`–`0004`; `drizzle-kit generate` после
      не произвежда нова миграция.
- [ ] Slug `Ab`/`-abc` пада на CHECK; `base_price = -1` и `stock = -1` падат на CHECK.
- [ ] Един slug два пъти → `slug_taken`; един SKU в два продукта → `sku_taken`; два еднакви SKU
      в един вход → `sku_duplicate` без заявка; няколко варианта с `sku = null` се записват.
- [ ] `replaceVariants` запазва `id` на подадените съществуващи, трие липсващите, вмъква новите,
      пренарежда по входа; чужд `id` → `variant_foreign`, нищо не се записва.
- [ ] `updateProduct`/`replaceVariants` с ефективна цена < 0 → `price_negative`.
- [ ] `deleteProduct` трие и вариантите; несъществуващ id → `product_not_found`.
- [ ] `getActiveProductBySlug` → `null` за неактивен; без неактивни варианти, без `stock` число,
      `price = basePrice + priceDelta`.
- [ ] `parsePriceInput('12,50')`/`('12.50')` → `1250`; `('0')` → `0`; `('1.999')`, `('abc')`,
      `('')` → `null`; `('-2.00')` → `-200` само с `allowNegative`; `formatPriceInput(1250)` →
      `'12.50'`; `formatPrice(1250, {BGN, bg-BG})` съдържа `12,50`.
- [ ] Трите action-а: невалиден вход → `{ok:false}` без сервиз; без админ → `/admin/login`; лимит →
      съобщение; `ProductError` → неговото съобщение; друго → общо съобщение.
- [ ] `saveProductAction` при грешка във вариантите не оставя променени полета (една транзакция).
- [ ] `pnpm lint` — нищо в `shop` не внася `@/modules/platform` и обратно; нов файл ≤ 300 реда.

## 6. Как се проверява

**Машинно:** `pnpm verify` (node: money, slug, форма-схема, actions · dom: variants-fields,
product-editor · db: product.service, product-edit.service).

**Ръчно:** 1. `/admin/products` без сесия → login; като админ → празно + „Нов продукт". 2. Нов
продукт `pvc-classic`, PVC, `19,90`, варианти `Бяла` 0 / `Черна` 2.50 SKU `PVC-B`/`PVC-C`,
наличност 10/5 → редирект към редактора с `19.90`/`2.50`. 3. delta на `Черна` `-25.00` → Запази →
`price_negative`, нищо не е променено. 4. ↑/↓, трети вариант без SKU, Запази → редът е нов,
id-тата на първите два са същите. 5. Втори продукт със същия slug → „зает"; SKU `PVC-B` → „зает". 6. Списъкът показва материал, цена, 3 варианта, „Активен"; изключи → „Неактивен". 7. Изтрий.

**Регресия:** `/app/profiles/[id]` записът на линкове; `/admin/batches`, `/admin/cards`;
миграции `0000`–`0003` непроменени; `isUniqueViolation` запазва сигнатурата.

## 7. Блокиращи въпроси

Няма.
