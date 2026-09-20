# `SHP-4` — Качване на лого при персонализация на продукта

**Тежест:** голяма — нов публичен вход без auth (файл от гост), нова повърхност (`core/storage`,
`/api/uploads`), native зависимост (`sharp`) в образа.
**Заявено:** 2026-09-20 (zadanie § 6.3 т. 1, § 6.4 т. 1)
**Сверено с кода:** 2026-09-20.

## Дневник на етапите

| Етап         | Изпълнител | Кога       | Резултат                                                             |
| ------------ | ---------- | ---------- | -------------------------------------------------------------------- |
| анализ       | analyzer   | 2026-09-20 | задание                                                              |
| код          | programmer | 2026-09-20 | 556 теста, docker build + sharp OK                                   |
| ревю         | reviewer   | 2026-09-20 | блокер `.gitignore` → поправен; тест за стара количка, цветови токен |
| сигурност    | security   | 2026-09-20 | 2 средни (pixel flood, fail-open) — поправени; сирачета в open-items |
| тестове      | диригент   | 2026-09-20 | verify 561, build; Playwright пълен поток + отказани файлове         |
| документация | диригент   | 2026-09-20 | worklog, ARC-13, open-items, handover                                |

## 1. Какво не е наред

Формата казва „Логото ще ви поискаме по имейл след поръчката" (`add-to-cart-form.tsx:110`) — ръчна
стъпка за всяка поръчка. `personalization` е без `logoKey`, `core/storage` не съществува, `sharp` не е
зависимост (само optional на `next`).

Сверка: Server Actions имат таван 1 MB на body → `serverActions.bodySizeLimit: '3mb'` в
`next.config.ts`. Volume, права (`nextjs` user), `.dockerignore`, `.gitignore`, `backup.sh` вече покриват
`UPLOADS_DIR` — **не се пипат**. Образът се строи в Alpine → `pnpm install` дърпа `linuxmusl-x64`
sharp сам; standalone копира `node_modules/sharp` + `@img/*` както `argon2`. `orderPersonalizationSchema
= cartPersonalizationSchema` → едно поле стига; `placeOrder` копира обекта цял.

## 2. Къде

| Файл                                                           | Роля                                                             |
| -------------------------------------------------------------- | ---------------------------------------------------------------- |
| `src/modules/core/storage/{local,index}.ts` (нови)             | главна: `putObject`/`readObject`/`deleteObject`, ключ регекс     |
| `src/modules/core/image/logo.ts` (нов)                         | главна: sharp pipeline (metadata → resize 256 inside → webp)     |
| `src/modules/core/index.ts`, `rate-limit/policy.ts`            | barrel; `uploadIp` 10/3600 + ключ                                |
| `src/modules/shop/cart.ts`, `order.service.ts`                 | `logoKey` nullable с регекс, default `null`; fallback            |
| `src/app/(shop)/cart/upload-actions.ts` (нов), `rate-limit.ts` | главна: `uploadLogoAction(formData)`                             |
| `src/app/(shop)/products/[slug]/{add-to-cart-form,schema}.tsx` | file input (onChange → качване → `logoKey` в стойностите), превю |
| `src/app/api/uploads/logos/[key]/route.ts` (нов)               | главна: сервира WebP; образец `api/qr/[slug]/route.ts`           |
| `src/app/(shop)/cart/page.tsx`, `checkout/checkout-form.tsx`   | `<img>` превю до реда                                            |
| `src/app/admin/(protected)/orders/[id]/order-sections.tsx`     | `<img>` + „Свали" (`download`)                                   |
| `next.config.ts`, `package.json`                               | `bodySizeLimit`; `sharp` в dependencies                          |

## 3. Как

1. **`core/storage`** (ARC-4): локално под `env().UPLOADS_DIR`; ключът се генерира само на сървъра —
   `logos/<uuid>.webp`; при четене/триене се приема само `^logos/[0-9a-f-]{36}\.webp$` (никакъв path
   join с клиентски вход). Тесен интерфейс, сменяем към S3. `mkdir -p` при първи запис.
2. **Качване:** отделен `uploadLogoAction(formData)`; клиентът избира файл → качва веднага → получава
   `logoKey` → скрит в react-hook-form → `addToCartAction` го получава в `personalization`. Ред:
   размер ≤ 2 MB → `uploadIp` → `sharp(buffer).metadata()` за реалния формат — **само png/jpeg/webp**,
   SVG/GIF отказани → resize 256 `fit: inside`, `withoutEnlargement` → WebP → `putObject`. Всяка грешка е
   съобщение. Файлът е незадължителен; „Премахни" нулира `logoKey`.
3. **Схема:** `cartPersonalizationSchema.logoKey` — `z.string().regex(KEY).nullable().default(null)`;
   старите колички без полето минават `parseCart`.
4. **Сервиране:** `GET /api/uploads/logos/[key]` — регекс, `publicApiLimit`, `image/webp`,
   `Cache-Control: public, max-age=31536000, immutable`, 404 при липса. Публичен по ключ-uuid, без листване.
5. **Поръчка/админ:** нищо в `placeOrder`; админ детайлът показва `<img>` + `<a download>`.
6. **Сирачета:** нищо във v1 (обемът е малък) — ред в open-items (решение на диригента по § 7 на анализа).

## 4. Какво НЕ се пипа

`docker-compose.prod.yml`, `app.Dockerfile`, `.dockerignore`, `backup.sh`; профилните
`photo_key`/`logo_key` и dashboard качване (отделен цикъл); схемата на базата (jsonb → без миграция);
`addToCartAction` сигнатура; cart TTL/cookie; лимитите на количка/checkout; `POST /api/upload` (§ 9,
отменен от ARC-4); `next/image`.

## 5. Приемни критерии

- [ ] Гост избира PNG/JPEG/WebP до 2 MB, вижда превю, добавя; `/cart` и `/checkout` показват логото.
- [ ] Файлът е WebP, най-дългата страна ≤ 256 px; малък вход не се увеличава.
- [ ] SVG, GIF, `.png` с HTML вътре, > 2 MB → съобщение, нищо на диска. 11-то качване/час → лимит.
- [ ] Ключ от клиента (`../x`, uuid без файл) → 404 от route-а и невалиден ред в количката; без 500.
- [ ] Поръчката пази `logoKey`; `/admin/orders/{id}` показва логото и „Свали" сваля `.webp`.
- [ ] Стара количка без `logoKey` се чете; линия без лого работи както днес.
- [ ] `docker build` минава и `sharp` се зарежда в контейнера (Alpine/musl).
- [ ] `pnpm verify` без предупреждения.

## 6. Как се проверява

Тестове: `storage.test.ts` (tmp dir, лош ключ), `logo.test.ts` (PNG през sharp → размер/формат; SVG/
текст → отказ), `upload-actions.test.ts` (лимит, лош тип, голям файл, mock storage), `cart.test.ts`,
`order.service.db.test.ts` (logoKey до `order_items`). Ръчно/Playwright `setInputFiles`: png 1200×800
→ превю → количка → `/api/uploads/logos/<uuid>.webp` е `image/webp` ≤ 256 px; svg и 3 MB → отказ;
checkout → админ „Свали". `docker build -f docker/app.Dockerfile` + `docker run … node -e "require('sharp')"`.

## 7. Решено (диригент, 2026-09-20)

Без автоматично чистене на сирачета във v1 (open-items); `bodySizeLimit` 3 MB глобално; `uploadIp` 10/h.
