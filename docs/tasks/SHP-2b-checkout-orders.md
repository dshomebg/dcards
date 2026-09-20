# `SHP-2b` — Checkout с наложен платеж, поръчки, `/order/{number}`, `/app/orders`

**Тежест:** голяма — пари (цени и stock се фиксират в транзакция), нова схема (миграция `0005`),
публичен вход от гости (Server Action без auth + токен за преглед). Всички етапи се пускат.
**Заявено:** 2026-09-20
**Сверено с кода:** 2026-09-20 — всеки `файл:ред` по-долу е отворен наново, не преписан от заявката.

## Дневник на етапите

| Етап         | Изпълнител | Кога       | Резултат                                                         |
| ------------ | ---------- | ---------- | ---------------------------------------------------------------- |
| анализ       | analyzer   | 2026-09-20 | задание                                                          |
| код          | programmer | 2026-09-20 | 438 теста, миграция 0005, HTTP поток                             |
| ревю         | reviewer   | 2026-09-20 | готово с уговорки; 4 ниски → 2 поправени, 2 в open-items         |
| сигурност    | security   | 2026-09-20 | 2 средни + 3 ниски — всички поправени; 2 наблюдения в open-items |
| тестове      | диригент   | 2026-09-20 | verify 444, build OK, Playwright: гост/клиент/изход/двоен submit |
| документация | диригент   | 2026-09-20 | worklog, MON-4, AUTH-11, open-items, handover, roadmap           |

## 1. Какво не е наред

„Към поръчката" от `/cart` води до `ComingSoon`. Няма таблица за поръчки, stock не намалява,
клиентът не може да види поръчката си, `/app/orders` е заглушка.

**Сверка с кода — разлики спрямо заявката и SHP-2a § 8:**

- **Sequence без custom SQL:** `pgSequence` съществува в drizzle-orm 0.45.2 и drizzle-kit я носи
  в `generate`. Схемата я декларира → DAT-1 е спазен.
- **Проблемът е по-широк:** `cart.ts` допуска един вариант на два реда; `priceCart` проверява
  `stock >= quantity` **по ред**, не по вариант. Два реда × 3 при stock 5 минават през `/cart`, но
  не бива да минават през `placeOrder` → агрегиране по `variantId` (§ 3.2).
- `RadioGroup` няма `disabled` по опция; `card` „скоро" се прави с native radio.
- Actor-ът **вече се сглобява** от `loadCurrent()` (`app/(protected)/current.ts`): сесия + лична
  org или `null`. Ползва се, не се пише наново.
- `lockProduct` е образецът за `FOR UPDATE`; тук заключването е върху `product_variants` с join →
  `.for('update', { of: productVariants })`.
- Чужда схема при FK е разрешена от линтера; образец `card.schema.ts` (`../auth/user.schema`).
- DAT-5 казва „само `created_at`", но SHP-3 ще сменя статус → `updated_at` влиза сега.
- `RATE_POLICY` няма checkout политики; `env.ts` няма `SHIPPING_COST_MINOR`.

## 2. Къде

| Файл                                                                                                  | Редове       | Роля                                                                                  |
| ----------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------- |
| `src/modules/shop/order.schema.ts` (нов)                                                              | —            | главна: `orders`, `order_items`, enum-и, `order_number_seq`, Zod за jsonb, DTO типове |
| `drizzle/0005_orders.sql` (генериран, `pnpm db:generate --name orders`)                               | —            | главна: sequence + enum-и + таблици + индекси                                         |
| `src/modules/core/db/schema.ts`                                                                       | 4-9          | съгласуване: `export * from '../../shop/order.schema'`                                |
| `src/modules/shop/order.repository.ts` (нов)                                                          | —            | главна: lock варианти, decrement stock, insert order/items, find by number/org        |
| `src/modules/shop/order.service.ts` (нов)                                                             | —            | главна: `placeOrder`, `getOrderForView`, `listOrdersByOrg`, `OrderError`, Zod вход    |
| `src/modules/shop/order-number.ts` (нов, чист)                                                        | —            | `formatOrderNumber(year, seq)`, `ORDER_NUMBER_PATTERN`, `orderNumberSchema`           |
| `src/modules/shop/index.ts`                                                                           | 1-71         | съгласуване: изнася новото; таблиците НЕ                                              |
| `src/modules/core/env.ts`, `.env.example`                                                             | 38-39; 40-42 | `SHIPPING_COST_MINOR` (int ≥ 0, default 590)                                          |
| `src/modules/core/rate-limit/policy.ts`                                                               | 26-30, 45-46 | `checkoutIp` 5/3600, `checkoutEmail` 3/3600 + ключове                                 |
| `src/app/(shop)/checkout/page.tsx`                                                                    | 1-14         | главна: замества `ComingSoon`                                                         |
| `src/app/(shop)/checkout/{checkout-form.tsx,schema.ts,actions.ts,rate-limit.ts,order-view.ts}` (нови) | —            | главна: форма (client), Zod на формата, `placeOrderAction`, лимити, токен             |
| `src/app/(shop)/order/[number]/page.tsx` (нов)                                                        | —            | главна: преглед по токен или org                                                      |
| `src/app/app/(protected)/orders/page.tsx`                                                             | 1-13         | главна: `DataTable` вместо `ComingSoon`                                               |
| `src/app/app/(protected)/current.ts`                                                                  | 16-26        | само за контекст: `loadCurrent()` дава actor-а                                        |
| `src/app/(shop)/cart/{store,actions,rate-limit}.ts`                                                   | —            | само за контекст                                                                      |
| `src/modules/platform/card-activation.service.ts`                                                     | 61-75        | само за контекст: транзакция + `FOR UPDATE`                                           |
| `src/modules/auth/session.ts`                                                                         | 26-46        | само за контекст: cookie + Redis ключ с TTL                                           |
| `src/app/app/(protected)/cards/page.tsx`                                                              | 24-72        | само за контекст: `DataTable`/`ListState`                                             |

## 3. Как (посока, не готов код)

### 3.1 Схема (`order.schema.ts`) и миграция `0005`

- `orderNumberSeq = pgSequence('order_number_seq', { startWith: 1 })` — в схемата. Номерът се
  формира в приложението: в транзакцията `SELECT nextval('order_number_seq')` →
  `formatOrderNumber(year, seq)` = `DC-YYYY-NNNNNN` (`lpad` 6). Sequence-ът е глобален и не се
  нулира по година — дупки при rollback са приемливи; уникалността я пази индексът.
- `orders`: `id`, `number text notNull` + `uniqueIndex`, `userId uuid null → users.id set null`,
  `orgId uuid null → organizations.id set null`, `status` `pgEnum('order_status',
['new','cod','paid','in_production','shipped','delivered','cancelled'])`, `customer jsonb`,
  `shipping jsonb`, `paymentMethod` enum `('cod','card')`, `paymentStatus` enum
  `('pending','paid','refunded')`, `subtotal`, `shippingCost`, `total` integer, `trackingNumber
text null`, `createdAt`, `updatedAt`. CHECK: трите суми `>= 0`, `total = subtotal +
shipping_cost`. Индекси: `user_id`, `org_id`, `status`, `created_at`.
- `order_items`: `id`, `orderId → orders cascade`, `variantId → product_variants restrict`
  (MON-3), `quantity` (CHECK `>= 1`), `unitPrice` (CHECK `>= 0`), `productName`, `variantName`
  (снимка към момента), `personalization jsonb`. Индекси: `order_id`, `variant_id`.
- Zod за jsonb (четене през `safeParse`, DAT-7): `orderCustomerSchema` {name trim 1–120, phone
  `^\+?[0-9 ()-]{6,20}$`, email `z.email().max(254)`}; `orderShippingSchema` {courier enum
  `econt|speedy`, address ≤300 nullable, office ≤120 nullable, note ≤300 nullable} + `refine`:
  точно едно от address/office непразно. `orderPersonalizationSchema` = `cartPersonalizationSchema`.
  Лош jsonb в базата → DTO с празни низове, не 500.

### 3.2 `placeOrder(executor, input)` (`order.service.ts`)

Вход `{ cart, customer, shipping, actor: { userId, orgId } | null }` — целият вход през Zod
(DAT-8); лош → `OrderError('input_invalid')`. Празна количка → `cart_empty`.

Транзакция:

1. Агрегира количеството **по `variantId`**. Сортира id-тата възходящо (deadlock ред).
2. Една заявка: варианти + продукт по `inArray` `ORDER BY product_variants.id` `FOR UPDATE OF
product_variants`. Липсващ или неактивен продукт/вариант → `unavailable` (с име); `stock <
агрегирано qty` → `out_of_stock` (с име).
3. Цена = `basePrice + priceDelta` от **заключения** ред (MON-1) — никога от `CartView`.
4. Decrement: `UPDATE product_variants SET stock = stock - $qty WHERE id = $id AND stock >= $qty
RETURNING id` — без ред → `out_of_stock`.
5. `subtotal` = Σ `unitPrice × quantity`; `shippingCost = env().SHIPPING_COST_MINOR`; `total`.
   `nextval` → номер. Insert `orders` (`status: 'cod'`, `paymentMethod: 'cod'`,
   `paymentStatus: 'pending'`, `userId/orgId` от actor или null) + `order_items`.
6. Връща `{ id, number }`. Нищо не се логва с лични данни (DAT-6).

`OrderError` кодове: `cart_empty | out_of_stock | unavailable | input_invalid`; съобщенията са
български и носят името на реда. Недостъпен ред **не се пропуска мълчаливо** — поръчката се
отказва; клиентът го маха от `/cart`.

### 3.3 Четене

- `getOrderForView(executor, { number, orgId: string | null, viaToken: boolean }): OrderViewDto |
null` — една заявка `WHERE number = ? AND (viaToken OR org_id = ?)`; `viaToken=false` и
  `orgId=null` → винаги `null`. DTO изричен: `{ number, status, createdAt, customer, shipping,
paymentMethod, subtotal, shippingCost, total, items: [{ productName, variantName, quantity,
unitPrice, lineTotal, personalization }] }` — без `id`, `userId`, `orgId`, `variantId`.
- `listOrdersByOrg(executor, orgId): OrderSummaryDto[]` — `{ number, status, total, createdAt }`.
- `ORDER_STATUS_LABELS` (BG) в `shop`.

### 3.4 `/checkout` (`(shop)/checkout/`)

- `page.tsx` (`force-dynamic`, `noindex`): `readCart` → `priceCart(db)`; **нито един** достъпен
  ред → `redirect('/cart')`; има недостъпен ред → бележка „Премахни недостъпните редове" и без
  форма. `loadCurrent()` → `defaultValues` name/email. Подава `CartView`, `format`, `shippingCost`.
- `schema.ts`: `checkoutFormSchema` — customer + `courier`, `deliveryKind: 'address'|'office'`,
  `address`, `office`, `note`, `paymentMethod: z.literal('cod')`; `superRefine` за
  адрес/офис. `toPlaceOrderInput(values)` → `{ customer, shipping }`. Цени/суми **не са** във
  формата.
- `checkout-form.tsx` (client): полета име/телефон/имейл, куриер (`RadioGroup`), „до адрес"/„до
  офис" + условно поле, бележка, плащане — native radios: `cod` checked, `card` `disabled` +
  „скоро". Преглед на редовете и суми (само показвани). „Поръчай"; `{ok:false,message}` →
  `role="alert"`.
- `actions.ts` (`'use server'`): actor-ът идва от `loadCurrent()` в
  `src/app/app/(protected)/current.ts` (внася `auth` + `platform`; `shop` не ги вижда — ARC-2).
  Ред: Zod → `checkoutLimit(email)` (IP първо, после имейл, и двете се броят и при успех) →
  `readCart` → `loadCurrent()` → `placeOrder(db, {...})` → **коментар `// SHP-2c:
sendOrderConfirmation(number) — след commit, преди redirect`** → `issueOrderViewToken(number)`
  → `writeCart(emptyCart())` → `revalidatePath('/', 'layout')` → `redirect('/order/${number}')`
  извън `try`. `OrderError` → `{ok:false, message}`; друго → лог `cause` + общо съобщение.
  Провал на Redis след commit (токен/количка) не проваля поръчката: try/catch, redirect все пак.
- `rate-limit.ts`: `checkoutLimit(email)` по образец `claimLimit` — `checkoutIp` 5/час,
  `checkoutEmail` 3/час (ключ с `toLowerCase()`).

### 3.5 Токен за преглед (`(shop)/checkout/order-view.ts`, `server-only`)

`randomBytes(32).toString('base64url')`; Redis `order-view:<token>` = номер, `EX` 24 ч; cookie
`order_view` httpOnly, lax, secure в prod, `maxAge` = същата константа. Един токен → един номер.
`readOrderViewNumber(): string | null` — без cookie, лош формат (43 знака) или паднал Redis →
`null`, никога не хвърля.

### 3.6 `/order/[number]`

`force-dynamic`, `noindex`, изричен `Props`. `orderNumberSchema.safeParse` → иначе `notFound()`
без заявка. `viaToken = readOrderViewNumber() === number`; `orgId = (await
loadCurrent())?.org.id ?? null`; `getOrderForView(db, { number, orgId, viaToken })` → `null` →
`notFound()`. Показва номер, статус, редове, суми, куриер + адрес/офис + бележка, данни на
клиента, „Ще се свържем с вас за потвърждение. Плащане при доставка."

### 3.7 `/app/orders`

`requireCurrent()` → `listOrdersByOrg(db, org.id)`; `DataTable`: номер (`Link` към
`/order/{number}`), дата, статус (`Badge`), общо. Празно → `ListState`.

### 3.8 Тестове

- `order-number.test.ts` (node): формат, `lpad`, regex.
- `order.service.db.test.ts`: цената е от базата; stock намалява; два реда на един вариант с
  обща бройка > stock → `out_of_stock`, stock непроменен; неактивен → `unavailable`; празна →
  `cart_empty`; **race**: два паралелни `placeOrder` за последната бройка → точно един успех,
  stock = 0; две поръчки → различни `number`; actor null → null колони; `getOrderForView` с чужд
  `orgId` → `null`, с `viaToken` → DTO без `orgId`/`variantId`; лош jsonb → без хвърляне;
  `listOrdersByOrg` не връща чужди.
- `checkout/actions.test.ts` (node): невалиден вход → без лимит/база; лимит → съобщение;
  `OrderError` → `{ok:false}`; успех → cookie + празна количка + redirect.
- `checkout-form.test.tsx` (dom): „до адрес" без адрес → грешка; `card` е disabled; съобщение.

## 4. Какво НЕ се пипа

- `cards.order_id`, admin поръчки, смяна на статус, отказ и връщане на stock, `tracking_number`
  UI — SHP-3. Колоните се създават, но никой не ги променя.
- `core/mail`, nodemailer — SHP-2c. Само коментарът-кука.
- Картово плащане, куриерски API, купони, ДДС, лого, снимки.
- `cart.ts`, `cart.service.ts`, `priceCart`; `product.*`; `RadioGroup`.
- `session.ts`, `loadCurrent`/`requireCurrent` — само се извикват.
- Сливане на количка при вход; стари поръчки на гост след нов токен. `RESERVED_SLUGS`.

## 5. Приемни критерии

- [ ] Гост с 2 реда попълва `/checkout` (име, телефон, имейл, Еконт до офис, COD) →
      `/order/DC-2026-000001` показва редовете, `subtotal`, доставка `5,90`, `total`; количката е
      празна, header „Количка (0)".
- [ ] `order_items.unit_price` е `basePrice + priceDelta` към момента; промяна на цената после не я
      променя.
- [ ] `product_variants.stock` намалява с поръчаното; при два реда на един вариант — с общата бройка.
- [ ] Два реда на един вариант над stock → съобщение с името, нищо не се записва.
- [ ] Два едновременни checkout-а за последната бройка → една поръчка, един отказ; stock = 0.
- [ ] Вариант, деактивиран между `/cart` и „Поръчай" → отказ с име, без поръчка.
- [ ] Логнат клиент → `orders.user_id`/`org_id` са неговите; `/app/orders` показва поръчката;
      чужд логнат отваря `/order/{number}` → 404.
- [ ] Гост без cookie `order_view` → 404, неразличимо; `/order/abc` → 404 без заявка.
- [ ] Cookie `order_view` httpOnly, lax, 24 ч; Redis ключ с TTL 24 ч.
- [ ] Формата: адрес/офис задължителни според избора; телефон `abc` → грешка; `card` не може да
      се избере; суми не се пращат от клиента.
- [ ] 6-ти checkout за час от един IP или 4-ти с един имейл → „Твърде много опити".
- [ ] `/checkout` с празна/изцяло недостъпна количка → `/cart`; с един недостъпен ред → бележка.
- [ ] `order_number_seq` и таблиците са в `drizzle/0005_orders.sql`, генериран; `SHIPPING_COST_MINOR`
      липсва → 590.
- [ ] `pnpm lint`: `shop` не внася `auth`/`platform` освен `*.schema` при FK; файлове ≤ 300 реда.

## 6. Как се проверява

**Машинно:** `pnpm verify`; `pnpm db:generate --name orders` дава точно един нов файл.

**Ръчно:** 1. Админ: `Бяла` (19,90; stock 3), `Черна` (+2,50; stock 1). Инкогнито: „Иван" × 2
Бяла, „Мария" × 1 Черна → `/cart` → „Към поръчката". 2. `/checkout`: празен телефон → грешка;
„до адрес" без адрес → грешка; Еконт, офис, COD → „Поръчай" → `/order/DC-2026-000001`: 2 реда,
`39,80 + 22,40 = 62,20`, доставка `5,90`, общо `68,10`; header „Количка (0)". 3. Админ: `Бяла`
stock 1, `Черна` 0. Друг браузър → 404. 4. Логнат: поръчай → `/app/orders`; излез → 404. 5. Два
таба за последната бройка → един успех, един „няма наличност". 6. 6-ти опит → лимит.

**Регресия:** `/cart` без JS; header броячът; `/admin/products` — изтриване на вариант с
поръчка при `restrict` не бива да дава 500 (MON-3 → `isActive=false`; ако пада — open-items);
`/{slug}`, `/c/{id}`, `/login`, `/app/cards`.

## 7. Блокиращи въпроси

Няма. За open-items след цикъла: лимитът по имейл позволява чужд да блокира checkout за даден
имейл за час; паднал Redis след commit оставя гост без страница (имейлът в SHP-2c я покрива);
`deleteProduct` при `restrict`.
