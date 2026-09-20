# `SHP-3` — Админ на поръчките: списък, детайл, статуси, карти от партида, писмо „изпратена"

**Тежест:** голяма — миграция `0006` (`cards.order_id`), пари/stock (отказ връща наличност),
права (само админ), две таблици от два модула в една транзакция. Всички етапи се пускат.
**Заявено:** 2026-09-20
**Сверено с кода:** 2026-09-20 — всеки `файл:ред` по-долу е отворен наново.

## Дневник на етапите

| Етап         | Изпълнител | Кога       | Резултат                                                                                              |
| ------------ | ---------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| анализ       | analyzer   | 2026-09-20 | задание                                                                                               |
| код          | programmer | 2026-09-20 | 480 теста, миграция 0006                                                                              |
| ревю         | reviewer   | 2026-09-20 | готово с уговорки; courier fallback поправен, откачане на не-assigned → решено с org при shipped      |
| сигурност    | security   | 2026-09-20 | 1 средна + 4 наблюдения — disabled извън квотата, org_id при shipped, писмо извън try, tracking regex |
| тестове      | диригент   | 2026-09-20 | verify 485, build OK, Playwright пълен сценарий                                                       |
| документация | диригент   | 2026-09-20 | worklog, DAT-11, MON-5, open-items, roadmap, handover                                                 |

## 1. Какво не е наред

`/admin/orders` е `ComingSoon` (`orders/page.tsx:8`). Админът не вижда поръчки, не сменя статус,
не връзва карти към поръчка, клиентът не получава номер на пратка. Zadanie § 6.4 (ред 137-143).

**Сверка с кода — разлики спрямо заявката:**

- Статусите на картите са `blank|written|assigned|active|disabled` (`card.schema.ts:23-29`) —
  `assigned` съществува; `claimCardRow`/`activateCardRow` приемат `assigned` с `org_id null`
  (`card-activation.repository.ts:47-48, 68-69`) → карта от гостова поръчка се активира без промяна.
- `orders.trackingNumber`, `updatedAt` (`$onUpdate` в приложението, `columns.ts:21-25`) и enum-ът
  със седемте статуса вече са там (`order.schema.ts:25-35, 131-134`). Днес се записва само `cod`.
- Линтерът (`eslint.config.mjs:156-166`) пуска чужда `*.schema` от всеки модул, но `shop/index.ts:2`
  и ARC-2 забраняват `shop` ⇄ `platform`. Съставянето става в app-слоя — образец
  `checkout/actions.ts:10-18` (внася `auth`+`platform` през `loadCurrent` и `shop`).
- `listBatches` брои `written` като „≠ blank" (`batch.service.ts:115`) — не е броят на свободните.
- `core/db/errors.ts` има само 23505; `deleteProductById`/`deleteVariantsByIds`
  (`product.repository.ts:199-225`) при `restrict` дават „опитай пак" (open-items ред 57).
- AUTH-11: гостовият токен е 24 ч → линк към `/order/{number}` в писмо след дни дава 404 за гост.
- Навигацията вече има `/admin/orders` (`nav-tree.ts:27`, `nav-icons.ts:47`) — нищо за пипане.

## 2. Къде

| Файл                                                                                      | Редове        | Роля                                                                                                                                   |
| ----------------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/platform/card.schema.ts`                                                     | 56-88         | главна: `orderId: uuid('order_id')` null, БЕЗ FK; `index('cards_order_idx')`                                                           |
| `drizzle/0006_cards_order.sql` (генериран)                                                | —             | главна: `ALTER TABLE cards ADD COLUMN order_id uuid` + индекс                                                                          |
| `src/modules/platform/card.repository.ts`                                                 | 116-127, 228+ | главна: `lockWrittenCardsByBatch` (SKIP LOCKED), `assignCardsToOrder`, `releaseCardsByOrder`, `releaseCard`, `findCardsByOrder`, count |
| `src/modules/platform/card-fulfillment.service.ts` (нов)                                  | —             | главна: `assignCardsFromBatch`, `releaseOrderCards`, `releaseOrderCard`, `listCardsByOrder`; нови `CardErrorCode`                      |
| `src/modules/platform/batch.service.ts`, `index.ts`                                       | 95-126; 3-23  | съгласуване: `BatchSummary.available` (= `written`); изнася новия сервиз                                                               |
| `src/modules/shop/order.repository.ts`                                                    | 88-139        | главна: `findOrdersForAdmin(status?)`, `findOrderById`, `lockOrder`, `updateOrderStatus` (условен WHERE), `incrementVariantStock`      |
| `src/modules/shop/order-admin.service.ts` (нов)                                           | —             | главна: `listOrdersForAdmin`, `getOrderForAdmin`, `transitionOrder`, `lockOrderForCards`, `ORDER_TRANSITIONS`; нови `OrderErrorCode`   |
| `src/modules/shop/order-shipped-mail.ts` (нов), `order-mail.ts`                           | —; 24-29      | главна: `orderShippedMail`; `escapeHtml` се изнася в общ файл на `shop`                                                                |
| `src/modules/shop/order.service.ts`, `order.schema.ts`                                    | 245-258; 195+ | съгласуване: `OrderViewDto.trackingNumber`; `PlacedOrder*` може да се изнесе (файлът е 294 реда)                                       |
| `src/modules/shop/product-edit.service.ts`, `product.service.ts`                          | 139-205; 132  | съгласуване: `restrict` → `ProductError('has_orders')`                                                                                 |
| `src/modules/core/db/errors.ts`, `core/index.ts`                                          | 16-26; 5      | `isForeignKeyViolation` (23503)                                                                                                        |
| `src/modules/shop/index.ts`                                                               | 54-70         | съгласуване: изнася новото                                                                                                             |
| `src/app/admin/(protected)/orders/{page,[id]/page,actions,schema,order-status-badge}.tsx` | —             | главна: списък с `SelectFilter`, детайл, action-и                                                                                      |
| `src/app/admin/(protected)/orders/{status-form,assign-cards-form,tracking-form}.tsx`      | —             | главна: клиентски форми; образец `batches/mark-written-form.tsx`                                                                       |
| `src/app/(shop)/order/[number]/page.tsx`                                                  | —             | съгласуване: ред „Пратка: {trackingNumber}" при `shipped`/`delivered`                                                                  |
| `src/app/admin/(protected)/products/actions.ts`, `cards/actions.ts`                       | 39-79; 25-63  | само за контекст: `guard`, `logUnexpected`, `runCardAction`                                                                            |
| `src/app/(shop)/checkout/actions.ts`                                                      | 58-110        | само за контекст: `notify`/`afterCommit` — писмо през `after()`, не хвърля                                                             |

## 3. Как (посока, не готов код)

### 3.1 `cards.order_id` — без FK, в `platform` (решение)

Колона `uuid null`, без `references`. FK към `../shop/order.schema` обръща посоката на ARC-2
(„магазинът може да липсва"); `orders` няма изтриване, така че висящ id не възниква. Целостта е в
app-слоя: action-ът отваря `db.transaction`, `shop.lockOrderForCards(tx, id)` (`FOR UPDATE`, връща
`status`, `orgId`, `quota` = Σ `order_items.quantity`), после `platform.assignCardsFromBatch(tx,
{ batchId, quantity, orderId, orgId, quota })`. `platform` пази тавана сам (`countCardsByOrder +
quantity ≤ quota` → `CardError('order_quota')`).

### 3.2 Преходи (`ORDER_TRANSITIONS` в `shop`, единствен източник)

| От              | Към                          | Странични ефекти в същата транзакция                                                                                                            |
| --------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `new`, `paid`   | `in_production`, `cancelled` | —                                                                                                                                               |
| `cod`           | `in_production`, `cancelled` | —                                                                                                                                               |
| `in_production` | `shipped`, `cancelled`       | `shipped`: изисква `trackingNumber` (trim, 1–60); писмото е СЛЕД commit                                                                         |
| `shipped`       | `delivered`                  | `paymentMethod='cod'` → `paymentStatus='paid'`                                                                                                  |
| → `cancelled`   |                              | `stock += quantity` по вариант (агрегирано, `ORDER BY variant_id`), `assigned` карти → `written`, `order_id/org_id = null`; `active` не се пипа |

`updateOrderStatus` е `UPDATE … WHERE id=? AND status=<от>` с `returning` — без ред →
`OrderError('transition_invalid')`; така отказът връща stock точно веднъж дори при двоен submit.
Ред на заключване: първо `orders` (`FOR UPDATE`), после `product_variants` по `id`, после `cards`.
Смяна на номера след `shipped` е отделна форма (`setTrackingNumber`, без писмо).

### 3.3 Присвояване и откачане (`platform/card-fulfillment.service.ts`)

- `assignCardsFromBatch`: Zod (`batchId` uuid, `quantity` 1–1000, `orderId` uuid, `orgId` uuid|null,
  `quota` int); `SELECT id FROM cards WHERE batch_id=? AND status='written' ORDER BY id LIMIT n FOR
UPDATE SKIP LOCKED`; по-малко от n → `CardError('batch_short')` (нищо не се пише); `UPDATE …
SET status='assigned', order_id, org_id` (само ако `orgId` не е null). Таван = квота; повече от
  една стъпка е позволено. Непозната партида → `batch_not_found`.
- `releaseOrderCard(tx, { cardId, orderId })`: `assigned` + този `order_id` → `written`,
  `order_id/org_id = null`; иначе `card_not_found`. Action-ът го допуска само преди `shipped`.
- `listCardsByOrder(db, orderId)` → `{ id, status, batchName }[]` за детайла.

### 3.4 Писмо `orderShippedMail(order, options)` (`shop`, чиста функция)

Вход `{ number, courier, trackingNumber, hasAccount: boolean }`. Съдържание: номер, куриер
(`COURIER_LABELS`), номер на пратка, инструкция „Картите се активират от `{appUrl}/app/cards` с
кода на гърба или с докосване на чипа при вход", линк към `/order/{number}` **само при `hasAccount`**
(AUTH-11). Без адрес и лични данни. Пращане: в action-а през `after()` след commit, до
`orders.customer.email` през `orderCustomerSchema.safeParse`; лош jsonb → без писмо + съобщение
в резултата; `sendMail` не хвърля. Образец `checkout/actions.ts` (`notify`).

### 3.5 Екрани и action-и (`admin/(protected)/orders/`)

- `page.tsx`: `requireAdmin`; `searchParams.status` през `z.enum(ORDER_STATUSES)` — невалидно →
  всички; `SelectFilter paramKey="status"`; `DataTable`: номер (`Link` към `/admin/orders/{id}`),
  дата, клиент (име), статус (`OrderStatusBadge`), плащане, общо. Без прелистване.
- `[id]/page.tsx`: не-UUID → 404 без заявка (образец `batches/[id]/page.tsx:55-62`). Блокове:
  клиент (име/телефон/имейл), доставка (куриер, адрес/офис, бележка), редове с персонализация,
  суми, статус + разрешени преходи като бутони, товарителница, карти (таблица + „откачи"), форма
  „партида + брой" с `available` на партида (`listBatches`).
- `actions.ts`: Zod → `requireAdmin` (извън `try`) → `adminActionLimit` → `db.transaction` →
  `OrderError`/`CardError` → `{ok:false,message}`; друго → `logUnexpected` (код + constraint, DAT-6).
  Action-и: `transitionOrderAction(id, to, trackingNumber?)`, `assignCardsAction(id, batchId, n)`,
  `releaseCardAction(id, cardId)`, `setTrackingNumberAction(id, value)`. `revalidatePath` на
  `/admin/orders`, `/admin/orders/{id}`, `/admin/batches`, `/order/{number}`, `/app/orders`.

### 3.6 `restrict` при изтриване

`isForeignKeyViolation` в `core/db/errors.ts`. `deleteProduct` и `replaceVariants` (в `catch`, до
`rethrowUnique`) → `ProductError('has_orders')`: „Има поръчки с този продукт/вариант — маркирай
го неактивен вместо да го изтриваш." Ясно съобщение, не мълчаливо `isActive=false`.

### 3.7 Тестове

| Файл                                           | Какво                                                                                                                                                                                                                             |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `order-admin.service.db.test.ts`               | всяка клетка от матрицата + забранени (`delivered→cod`, `shipped→cancelled`); `shipped` без номер → грешка; `delivered` при cod → `paid`; отказ връща stock веднъж (втори отказ → грешка, stock непроменен); `updatedAt` се движи |
| `card-fulfillment.service.db.test.ts`          | N от партида → `assigned` + `order_id` (+ `org_id` при org, null при гост); недостиг → нищо; квота (3+3 при Σ=5 → грешка); чужда/непозната партида; освобождаване; отказ връща картите в `written`                                |
| `order-shipped-mail.test.ts` (node)            | номер, куриер, тракинг, инструкция; линк само при `hasAccount`; без адрес                                                                                                                                                         |
| `orders/actions.test.ts` (node)                | невалиден id → без база; лимит; `OrderError` → `{ok:false}`; писмо след успех, не при провал                                                                                                                                      |
| `product-edit.service.db.test.ts` (допълва се) | вариант с поръчка → `has_orders`, продуктът остава                                                                                                                                                                                |
| `errors.test.ts`                               | 23503 → `true`                                                                                                                                                                                                                    |

## 4. Какво НЕ се пипа

- `placeOrder`, `getOrderForView` (освен `trackingNumber`), `/checkout`, `/cart`, лимитите на
  checkout, `order-view.ts`, AUTH-11 токенът (не се удължава).
- `card_id`/`activation_code` (правило 9); `claimCardByCode`, `activateCard`, `resolveCard`
  (DAT-10); `/c/{id}`; `/app/cards`.
- `orders`/`order_items` схема — без нови колони; `card_batches`; `createBatch`, CSV, `markBatchWritten`.
- Картово плащане (`new`/`paid` са само в матрицата), куриерски API, `refunded`, частична
  доставка, изтриване на поръчка, прелистване, броячи в таблото, навигация, `RESERVED_SLUGS`.
- `orderConfirmationMail` — само `escapeHtml` се изнася. Лимитът по имейл, годината по UTC.

## 5. Приемни критерии

- [ ] `/admin/orders` показва всички поръчки, най-новите първо; `?status=shipped` филтрира;
      `?status=xyz` показва всички; без сесия → `/admin/login`.
- [ ] `/admin/orders/{id}` показва клиент, доставка, редове с персонализация, суми, статус,
      карти и форма за партида; `/admin/orders/abc` → 404 без заявка; чужд uuid → 404.
- [ ] Само разрешените преходи са бутони; `cod→shipped` през ръчно извикан action → грешка.
- [ ] `shipped` без номер на пратка → грешка; с номер → `tracking_number` записан, писмо до
      `customer.email` с номер, куриер и инструкция; линк към поръчката само при поръчка с org.
- [ ] `delivered` при COD → `payment_status = paid`.
- [ ] `cancelled` от `cod`/`in_production` → stock на всеки вариант се увеличава с поръчаното
      (агрегирано); втори опит → грешка и stock непроменен; картите на поръчката → `written`,
      без `order_id`/`org_id`.
- [ ] „Партида X, брой 3" → 3 карти `written` от X стават `assigned` с `order_id`; при поръчка с
      org и `org_id`; при гост `org_id` остава null.
- [ ] Партида с 2 свободни при заявени 3 → грешка, нито една карта не се пипа.
- [ ] Общо присвоени карти над Σ quantity → грешка; 2 + 3 при Σ 5 → успех.
- [ ] „Откачи" преди `shipped` → картата е `written`; след `shipped` бутонът липсва и action-ът отказва.
- [ ] `/app/cards` с кода на гърба и `/c/{id}` при вход активират карта от гостова поръчка;
      карта с `org_id` от поръчка се вижда в `/app/cards` на същата организация.
- [ ] `/order/{number}` показва номера на пратката при `shipped`/`delivered`.
- [ ] Изтриване на продукт/вариант с поръчки → ясно съобщение, без 500, продуктът остава.
- [ ] `updated_at` се променя при всяка смяна на статус. Логовете носят само код и constraint.
- [ ] `drizzle/0006_*.sql` съдържа само `order_id` + индекс. `shop` не внася `platform` и обратно;
      файлове ≤ 300 реда; `pnpm verify` без предупреждения.

## 6. Как се проверява

**Машинно:** `pnpm verify`; `pnpm db:generate --name cards_order` дава точно един нов файл.

**Ръчно (Playwright, диригентът):**

1. Партида „P1" × 5, „Записани" → 5 `written`. Гост поръчва 2 × Бяла (stock ↓) → `DC-…`.
2. `/admin/orders` → редът е `наложен платеж`; филтър `shipped` → празно с `ListState`.
3. Детайл: „В производство". „Партида P1, брой 3" → грешка за квотата. „Брой 2" → 2 `assigned`;
   `/admin/batches/{P1}` ги показва разпределени, org „—".
4. „Откачи" една → `written`; „брой 1" → 2 присвоени.
5. „Изпратена" без номер → грешка; с `1234567890` → писмо с номер, „Еконт", `/app/cards`, без
   линк към `/order/`. `/order/{number}` (същия браузър) показва пратката.
6. „Доставена" → `payment_status = paid`. Бутоните за преход изчезват.
7. Поръчка от логнат клиент → „В производство" → „Отказана": stock се връща; картите →
   `written`; `/app/orders` показва „отказана".
8. Логнат: `/app/cards` + код на карта от стъпка 3 → влиза; `/c/{id}` → активация.
9. `/admin/products` → изтрий Бяла → ясното съобщение, продуктът остава.

**Регресия:** `/checkout` от край до край; `/order/{number}` за гост; `/app/orders`;
`/admin/batches/{id}`, CSV, „Записани"; `/c/{id}` за `blank`/`disabled`/`active` (DAT-10);
`/admin/products` запис/изтриване без поръчки.

## 7. Решени в заданието (диригентът потвърждава)

(а) без FK от `cards` към `orders` (§ 3.1); (б) таван на картите = Σ quantity (§ 3.3);
(в) `has_orders` е съобщение, не мълчаливо `isActive=false` (§ 3.6); (г) линк в писмото само за
поръчки с org (§ 3.4). Потвърдени от диригента 2026-09-20.
