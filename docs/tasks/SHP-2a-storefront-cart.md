# `SHP-2a` — Витрина и количка: `/`, `/products`, `/products/{slug}`, `/cart`

**Тежест:** голяма — публичен вход от гости (запис в Redis без auth), четири нови публични екрана
и формат на количката, който SHP-2b наследява. Не пипа схема, пари не се движат; етапът
„сигурност" се пуска заради входа от гости.
**Заявено:** 2026-09-20
**Сверено с кода:** 2026-09-20 — всеки `файл:ред` по-долу е отворен наново, не преписан от заявката.

## Дневник на етапите

| Етап         | Изпълнител | Кога       | Резултат                                                       |
| ------------ | ---------- | ---------- | -------------------------------------------------------------- |
| анализ       | analyzer   | 2026-09-20 | задание; SHP-2 разделен на 2a/2b                               |
| код          | programmer | 2026-09-20 | готово; 5 отклонения приети                                    |
| ревю         | reviewer   | 2026-09-20 | готово с уговорки — литерален имейл махнат, cookie преиздаване |
| сигурност    | security   | 2026-09-20 | 1 висока (Redis пълнене) + 1 средна (timeout) — поправени      |
| тестове      | programmer | 2026-09-20 | 412 + 2; Playwright витрина/количка                            |
| документация | диригентът | 2026-09-20 | ARC-12, worklog, open-items                                    |

## 0. Защо се дели

Заявеният SHP-2 (миграция `0005`, количка, 5 публични страници, checkout + транзакция със stock,
токен за `/order/{number}`, `core/mail`, `/app/orders`) е три задания по 250 реда. Разделяне:
**SHP-2a (това)** витрина + количка, без схема и пари; **SHP-2b** схема `orders`/`order_items`,
`/checkout`, `placeOrder`, `/order/{number}` с токен, `/app/orders`; **SHP-2c** имейл.
Препоръките за 2b са в § 8.

## 1. Какво не е наред

`/` е placeholder. Няма `/products`, `/products/{slug}`, `/cart` — продуктите от SHP-1 не се виждат
от никого освен админа.

**Сверка с кода — разлики спрямо заявката:**

- Няма route group `(shop)`; `src/app/page.tsx` стои в корена. Групата се създава тук и `page.tsx`
  се мести в нея.
- `RESERVED_SLUGS` вече има `products`, `cart`, `checkout`, `order` — нищо за добавяне.
- **Cookie за количката не стига:** 10 реда × (uuid + персонализация до 500 знака + JSON)
  надхвърля 4 KB. → количката е в **Redis** с id в cookie (§ 3.2), както ARC-3 позволява: загубен
  Redis = празна количка.
- `PublicProductVariant` носи само `inStock`, не `stock`. Проверка `qty ≤ stock` е възможна само
  вътре в сервиза, без числото да излиза (§ 3.3).
- `RATE_POLICY` няма лимит за публични Server Actions по IP; образецът е `registerRateLimit`.
- `RadioGroup` няма `disabled` по опция — изчерпан вариант се показва като текст „изчерпано".
- `formatPrice` иска `{currency, locale}` — страниците подават `env()`; клиентски компонент го
  получава като prop.

## 2. Къде

| Файл                                                                                        | Редове  | Роля                                                                            |
| ------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------- |
| `src/modules/shop/cart.ts` (нов)                                                            | —       | главна: чист модел — Zod схеми, `addLine/updateLine/removeLine`, лимит 10, парс |
| `src/modules/shop/cart.service.ts` (нов)                                                    | —       | главна: `priceCart(executor, cart): CartView` — цени и наличност от базата      |
| `src/modules/shop/product.repository.ts`                                                    | 112-126 | съгласуване: нова заявка варианти+продукт по `inArray(id)`                      |
| `src/modules/shop/index.ts`                                                                 | 1-45    | съгласуване: изнася cart типове/функции                                         |
| `src/modules/core/rate-limit/policy.ts`                                                     | 8-41    | съгласуване: `cartIp` политика + ключ                                           |
| `src/app/(shop)/layout.tsx` (нов)                                                           | —       | главна: публична обвивка — header (лого, Продукти, Количка + брой, Вход/Акаунт) |
| `src/app/(shop)/page.tsx` (преместен от `src/app/page.tsx`)                                 | 1-8     | главна: landing                                                                 |
| `src/app/(shop)/products/page.tsx`, `.../products/[slug]/page.tsx` (нови)                   | —       | главна                                                                          |
| `src/app/(shop)/products/[slug]/add-to-cart-form.tsx` (нов, client)                         | —       | главна: форма избор + персонализация                                            |
| `src/app/(shop)/cart/page.tsx`, `.../cart/actions.ts`, `.../cart/store.ts`, `rate-limit.ts` | —       | главна: страница, Server Actions, cookie↔Redis, лимит                           |
| `src/app/(shop)/products/[slug]/schema.ts` (нов)                                            | —       | форма-схема (обвивка на `cartLineInputSchema`)                                  |
| `src/modules/auth/session.ts`                                                               | 26-46   | само за контекст: образец за cookie + Redis ключ с TTL                          |
| `src/app/[slug]/page.tsx`                                                                   | 19-30   | само за контекст: `force-dynamic`, `cache()`, изричен `Props`                   |
| `src/app/app/(protected)/cards/claim-card-form.tsx`                                         | —       | само за контекст: образец на клиентска форма с `{ok:false,message}`             |

## 3. Как (посока, не готов код)

### 3.1 Модел на количката (`shop/cart.ts`, чист — без Next, без Redis)

- `cartPersonalizationSchema`: `name` trim 1–80 (задължително), `title` trim ≤120 → `''`→`null`,
  `notes` trim ≤300 → `''`→`null`. `logoKey` НЕ съществува в този цикъл; hint към `notes`: „Лого
  изпратете на info@… след поръчката".
- `cartLineInputSchema`: `{ variantId: z.uuid(), quantity: z.int().min(1).max(20), personalization }`.
- `cartSchema`: `{ items: z.array(cartLineSchema).max(10) }`, `cartLineSchema = cartLineInputSchema

* { id: string }`—`id`е случаен низ от сървъра (един вариант може да е на два реда с различни
имена).`MAX_CART_LINES = 10`.

- Функции без странични ефекти: `emptyCart()`, `parseCart(raw: unknown): Cart` (лош вход → празна),
  `addLine(cart, input, id)` (11-ти ред → `CartError('cart_full')`), `updateLineQuantity(cart, id,
qty)`, `removeLine(cart, id)`, `cartCount(cart)`.
- `CartError` с кодове `cart_full | line_not_found | input_invalid`, български съобщения.

### 3.2 Съхранение (`(shop)/cart/store.ts`, app слой)

- Cookie `cart` = 32 случайни байта base64url, `httpOnly`, `sameSite: 'lax'`, `secure` в prod,
  `maxAge` 7 дни. Redis ключ `cart:<id>`, JSON на `Cart`, `EX` 7 дни при всеки запис. Една
  константа за TTL и `maxAge`.
- `readCart(): Promise<Cart>` — без cookie/ключ/паднал Redis → `emptyCart()` (никога не хвърля).
  `writeCart(cart)` — издава cookie при първи запис; празна количка → `DEL` + изтриване на cookie.
- Cookie-то не се подписва: id-то е непредвидимо, а съдържанието не носи нищо, което клиентът и
  без това не може да подаде. Цените никога не се записват в количката (MON-1/2).

### 3.3 Цени и наличност (`shop/cart.service.ts`)

- `priceCart(executor, cart): CartView` — една заявка по `inArray(productVariants.id, ids)` с join
  към `products`. Ред е `available` само ако продуктът и вариантът са активни и `stock >=
quantity`. Точният `stock` НЕ излиза; недостиг → `available: false, reason: 'out_of_stock'`;
  изчезнал/неактивен → `reason: 'unavailable'`.
- `CartView { lines, subtotal, count }`; `CartViewLine { id, variantId, productSlug, productName,
variantName, unitPrice, quantity, lineTotal, personalization, available, reason? }`. `subtotal`
  сумира само `available` редове. Всичко изрично (DAT-7).

### 3.4 Страници (server components, `force-dynamic`; палитра през `--color-*` токени)

- `(shop)/layout.tsx`: header с `APP_NAME` → `/`, „Продукти", „Количка (N)" (N от `readCart`),
  „Вход" или „Моят акаунт" (`getCurrentUser()`). Cart action-ите викат `revalidatePath('/',
'layout')`.
- `/`: заглавие + кратък текст, до 6 продукта от `listActiveProducts` (име, материал BG, „от
  {basePrice}"), „Как работи" — 3 стъпки, CTA към `/products`.
- `/products`: всички активни; празно → „Скоро".
- `/products/[slug]`: `productSlugSchema.safeParse` преди заявка → `notFound()`;
  `getActiveProductBySlug` през `cache()` за `generateMetadata`; описание с `whitespace-pre-line`;
  `AddToCartForm` (client): вариант (radio; изчерпан — „изчерпано", невалиден за избор), име,
  длъжност, бележки, количество 1–20, „Добави в количката". Без варианти → „Изчерпано".
- `/cart`: `readCart` → `priceCart`; редове с продукт/вариант, персонализация, единична цена,
  количество (native `<form action>` с hidden `lineId` и `<select>` 1–20 — без клиентски JS),
  „Премахни", ред-статус „не се предлага"/„няма наличност". Общо: `subtotal` + „Доставката се
  изчислява при поръчка". Бутон „Към поръчката" → `/checkout` (в 2b; тук `ComingSoon`). Празна
  количка → текст + линк към `/products`.

### 3.5 Server Actions (`(shop)/cart/actions.ts`) — гости, без сесия

- Ред: Zod → `cartActionLimit()` (IP от `headers()`, `RATE_POLICY.cartIp` = 60/мин, ключ
  `rl:cart:ip:<ip>`) → `readCart` → за add: вариантът съществува и е активен (една заявка) →
  мутация → `writeCart` → `revalidatePath('/', 'layout')` → `redirect('/cart')` (add) или
  `{ok:false,message}`.
- `addToCartAction(input)`, `updateCartLineAction(formData)`, `removeCartLineAction(formData)`.
  Не хвърлят към клиента; `redirect` е извън `try`. Непознат `lineId` → тихо `redirect('/cart')`.
- Логът е само `cause` (DAT-6).

### 3.6 Тестове

- `cart.test.ts` (node): лош JSON → празна; 11-ти ред → `cart_full`; два реда с един вариант и
  различни имена; update/remove по id; `''`→`null`; `quantity` 0/21 падат.
- `cart.service.db.test.ts`: цената е `basePrice + priceDelta`, неактивен → `unavailable`, `stock <
qty` → `out_of_stock`, `subtotal` без тях; `stock` не присъства в DTO.
- `actions.test.ts`: лимит → съобщение; невалиден вход → без Redis запис; непознат вариант →
  съобщение.
- `add-to-cart-form.test.tsx` (dom): изчерпан вариант не се изпраща; грешката се показва.

## 4. Какво НЕ се пипа

- Схема, миграция `0005`, `orders`/`order_items`, `cards.order_id` — SHP-2b.
- `/checkout`, `/order/[number]`, `/app/orders`, `placeOrder`, stock намаляване — SHP-2b.
- `core/mail`, nodemailer, `MAIL_*` — SHP-2b/2c. `env.ts` — никакви нови променливи.
- `src/app/[slug]/**`, `platform/slug.ts`, `RESERVED_SLUGS`.
- `shop/product.*` сервизи и схема — само нова заявка в репозитория; `PublicProduct*` DTO не се
  променят.
- Сливане на количка при вход — количката е по cookie, независима от сесията.
- Качване на лого, купони, ДДС, снимки (`images` остава `[]`). Админ екраните, nav дървото.

## 5. Приемни критерии

- [ ] `/`, `/products`, `/products/{slug}`, `/cart` се отварят без сесия; `/{slug}` профилите работят.
- [ ] `/products/{slug}` за неактивен, непознат или невалиден slug → 404; невалидният — без заявка.
- [ ] „Добави в количката" с име, вариант и количество 3 → `/cart` показва реда с цена от базата
      и общо `3 × цена`; в header-а „Количка (3)".
- [ ] Същият вариант с друго име → втори ред; 11-ият ред е отказан, количката остава с 10.
- [ ] Промяна на количество и „Премахни" от `/cart` работят без JavaScript.
- [ ] Деактивиран вариант или `stock` под количеството → редът е недостъпен, не е в сумата; точното
      число на наличността не е в HTML.
- [ ] Празно име, `quantity` 0 или 21, `notes` > 300 → съобщение, нищо не се записва.
- [ ] Cookie `cart` е `httpOnly`, `sameSite=lax`, 7 дни; `cart:<id>` в Redis има TTL; ръчно
      подменена стойност дава празна количка, не грешка.
- [ ] Спрян Redis → витрината се отваря (количката е празна), без 500.
- [ ] 61-ви cart action за минута от един IP → „Твърде много опити".
- [ ] `pnpm lint`: нищо в `shop` не внася `platform`/`auth`; `cart.ts` без `next/*`; ≤ 300 реда.

## 6. Как се проверява

**Машинно:** `pnpm verify`.

**Ръчно:** 1. админ: `pvc-classic` с `Бяла` (stock 5) и `Черна` (+2.50, stock 0). 2. инкогнито
`/` и `/products/pvc-classic` → `Черна` „изчерпано". 3. „Иван Петров", „CEO", 2 → `/cart`: 1 ред,
`2 × 19,90`, общо `39,80`, header „Количка (2)". 4. пак с „Мария" → 2 реда; количество 4 →
преизчислено; „Премахни". 5. админ: `Бяла` stock 1 → `/cart` „няма наличност", общо `0,00`. 6. cookie `cart` = `abc` → празна без грешка. 7. `/products/Ab` и `/products/nqma` → 404.

**Регресия:** `/{slug}`, `/c/{id}`, `/login`, `/register`, `/app`, `/admin`; `/admin/products`
CRUD; сесията (`session` cookie) не се пипа.

## 7. Блокиращи въпроси

Няма. Redis-вместо-cookie е прието.

## 8. Препоръки за SHP-2b

- `number`: `DC-YYYY-NNNNNN` от Postgres `SEQUENCE order_number_seq` (custom SQL в `0005`).
- `cards.order_id`: към SHP-3 — `platform/card.schema` внасящ `shop/order.schema` обръща ARC-2.
- Stock: намалява се в транзакцията с `FOR UPDATE` по вариант, в ред по `variantId`.
- `/order/{number}`: cookie `order_view` (Redis `order-view:<token>` → номер, TTL 24 ч) за гост;
  логнат — WHERE `org_id`; иначе 404.
- Shipping: `SHIPPING_COST_MINOR` в env. Checkout лимит: 5/час по IP + 3/час по имейл.
- Предпопълване: `users` има само `name`/`email` — телефон винаги се въвежда.
- Имейл: `MAIL_HOST` липсва → `console.info`; след commit, fire-and-forget; HTML само през escaping.
