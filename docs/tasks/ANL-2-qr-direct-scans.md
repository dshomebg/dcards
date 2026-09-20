# `ANL-2` — QR и директни посещения като сканирания + „по източник"

**Тежест:** голяма — миграция `0007` (`scans`), нов публичен запис без auth на `/{slug}`, промяна
на redirect-а от `/c/{id}` → `security` задължителен.
**Заявено:** 2026-09-20
**Сверено с кода:** 2026-09-20.

## Дневник на етапите

| Етап         | Изпълнител | Кога       | Резултат                                                                               |
| ------------ | ---------- | ---------- | -------------------------------------------------------------------------------------- |
| анализ       | analyzer   | 2026-09-20 | задание                                                                                |
| код          | programmer | 2026-09-20 | 499 теста, миграция 0007                                                               |
| ревю         | reviewer   | 2026-09-20 | готово с уговорки; масив `s`, лог етикет; `?s=nfc` в лентата → open-items              |
| сигурност    | security   | 2026-09-20 | 1 средна (адрес с `?s=nfc`) → open-items; fail-closed за записа, isBot граници + Viber |
| тестове      | диригент   | 2026-09-20 | verify 504, build OK, curl/Playwright: чип/QR/линк/бот/prefetch                        |
| документация | диригент   | 2026-09-20 | worklog, DAT-13, open-items, handover, roadmap                                         |

## 1. Какво не е наред

Статистиката брои само чипа. QR-ът (`/api/qr/{slug}` → `/{slug}`) и споделеният линк не оставят
ред в `scans`. Сверка: enum-ът е `nfc | qr | direct` (не `link`) — без промяна; `/[slug]` е
`force-dynamic` → сървърен запис е възможен; `PublicProfile` няма `id`/`orgId`; `/c/[id]` пренасочва
към `/{slug}` без маркер → NFC би се броил втори път като `direct`; освободена `disabled` карта
губи org-а → при препродажба join-ът по `cards.org_id` би показал чужди стари сканове.

## 2. Къде

| Файл                                                   | Роля                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `src/modules/platform/scan.schema.ts` + `drizzle/0007` | главна: `card_id` nullable, нов `org_id`, CHECK, индекс `(org_id, scanned_at)` |
| `src/modules/platform/scan.repository.ts`              | `ofOrg` по `scans.org_id` (join `cards` пада); `countScansBySource`            |
| `src/modules/platform/scan-analytics.service.ts`       | `bySource` в Pro DTO                                                           |
| `src/modules/platform/scan-device.ts`                  | чиста `isBot(ua)`                                                              |
| `src/modules/platform/profile.service.ts`              | `findPublicProfileBySlug` връща и `id`, `orgId` (само за сървъра)              |
| `src/app/[slug]/page.tsx` + нов `rate-limit.ts`        | главна: `searchParams.s`, запис `qr`/`direct`, лимит по профил                 |
| `src/app/c/[id]/page.tsx`                              | `orgId` в записа, `isBot` пропуска, redirect към `/{slug}?s=nfc`               |
| `src/modules/core/rate-limit/policy.ts`                | `scanProfile` 30/60 s + ключ                                                   |
| `src/app/api/qr/[slug]/route.ts`                       | QR кодира `profileUrl(...) + '?s=qr'`; `profileUrl` не се пипа                 |
| `src/app/app/(protected)/analytics/page.tsx`           | четвърта `Breakdown` „По източник" (Pro)                                       |

## 3. Как

1. **Схема.** `card_id` nullable; CHECK `(source = 'nfc') = (card_id IS NOT NULL)` — без условие за
   `profile_id` (FK е `set null`). `scans.org_id uuid NULL → organizations`, индекс
   `(org_id, scanned_at)`, backfill `FROM cards` в същата миграция (ръчен UPDATE в генерирания SQL е
   допустим като data migration — само той). Org-ът се фиксира в момента на скана.
2. **Запис на `/{slug}`** само в `ProfilePage` (не в `generateMetadata`). `s=qr` → `qr`; без `s` →
   `direct`; `s=nfc` → нищо. Пропуска се при `isBot(ua)`/липсващ UA, `Next-Router-Prefetch`,
   `Purpose: prefetch`, `Sec-Purpose: prefetch*`, и при лимит `scanProfile` (30/60 s по `profile.id`).
   Грешка при INSERT → лог (DAT-6), страницата се вижда. `id`/`orgId` не стигат до `ShareButton`.
3. **`isBot`** — регекс (`bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|twitterbot|
linkedinbot|preview|headless|curl|wget|python`); прилага се и в `/c`.
4. **Beacon `/api/scans` — не** (нова повърхност без полза); ред в open-items.
5. **Dashboard.** `bySource` за Pro (прозорец 30 дни), етикети „Чип / QR / Линк"; Free непроменен.
   `countScansByCard` филтрира `card_id IS NOT NULL`.

## 4. Какво НЕ се пипа

`profileUrl` (vCard, OG, `/app` линкове без `?s`); `resolveCard` и шестте изхода (DAT-10); enum-ите;
`country`; `classifyDevice`; `apiIp` и `/api/qr` кешът; Free изгледът; `scan-days.ts`; `ProfileView`/
`ShareButton`; клиентските полета на `PublicProfile`; никакъв клиентски JS.

## 5. Приемни критерии

- [ ] `/{slug}?s=qr` → ред `qr`, `card_id NULL`, `profile_id`, `org_id` на профила, `device`, без IP/UA.
- [ ] `/{slug}` без `s` → `direct`; `?s=nfc` → без ред; `/c/{id}` → точно един ред и 307 към `?s=nfc`.
- [ ] Бот UA, липсващ UA или prefetch header → рендер без ред (и на `/c`). 31-во за минута → без ред.
- [ ] Скрит/непознат slug → 404 без ред. Грешка в INSERT → страницата пак се вижда.
- [ ] Pro: „По източник" с три реда; Σ = „30 дни"; Free: HTML без „По източник".
- [ ] Чужда org не вижда чужди `qr`/`direct`; изтрит профил → редът остава.
- [ ] Миграцията минава върху база със съществуващи `nfc` редове; CHECK отхвърля `nfc` без карта и
      `qr` с карта. `pnpm verify` без предупреждения.

## 6. Как се проверява

Тестове: `scan-analytics.service.db.test.ts` (смесени източници, две org-ове, `card_id NULL`,
изтрит профил), `scan-device.test.ts` (`isBot`), `scan.repository` CHECK тест, тест на записа за
`/[slug]` (бот/prefetch/лимит). Ръчно/Playwright: `?s=qr` +1 QR; линк +1; `/c/{id}` +1 чип (не +2);
`-A Googlebot` → без промяна. Регресия: `/c/{id}` шестте изхода, скрит профил 404, OG без `?s`.

## 7. Решено

Вариант А + `org_id` (аналайзърът); beacon не; „Линк" брои и собствените отваряния — приемливо.
