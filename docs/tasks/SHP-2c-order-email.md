# `SHP-2c` — Имейл за потвърждение на поръчка

**Тежест:** средна — нов модул `core/mail`, env ключ, излизащ SMTP трафик; без схема/пари/права.
**Заявено:** 2026-09-20
**Сверено с кода:** 2026-09-20.

## Дневник на етапите

| Етап         | Изпълнител | Кога       | Резултат                                                                 |
| ------------ | ---------- | ---------- | ------------------------------------------------------------------------ |
| анализ       | analyzer   | 2026-09-20 | задание, без блокиращи                                                   |
| код          | диригент   | 2026-09-20 | core/mail, шаблон, after()                                               |
| ревю         | reviewer   | 2026-09-20 | готово с уговорки; паралелни писма, останалото в open-items              |
| сигурност    | security   | 2026-09-20 | 1 средна + 2 ниски — after(), 5 s, кавички в bootstrap, MAIL_FROM refine |
| тестове      | диригент   | 2026-09-20 | verify 453, build OK, реално писмо през Hestia                           |
| документация | диригент   | 2026-09-20 | worklog, INF-7, open-items, go-live                                      |

## 1. Какво не е наред

След „Поръчай" клиентът има номера само в браузъра; гостът губи достъпа след 24 ч (AUTH-11).
Собственикът не разбира за новата поръчка — `/admin/orders` още го няма.

## 2. Къде

| Файл                                             | Роля                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------ |
| `src/modules/core/mail/{transport,send}.ts`      | главна: `sendMail({to,subject,text,html?})` → `boolean`, не хвърля |
| `src/modules/core/{env,index}.ts`                | `MAIL_ADMIN_TO` optional; изнася `sendMail`                        |
| `src/modules/shop/order-mail.ts`                 | главна: чист шаблон `orderConfirmationMail(order, opts)`           |
| `src/modules/shop/order.{service,repository}.ts` | `PlacedOrder` носи `createdAt`, items, суми                        |
| `src/app/(shop)/checkout/actions.ts`             | праща в `afterCommit`, след токена, преди `writeCart`              |
| `.env.example`                                   | `MAIL_ADMIN_TO=`, коментар за dev без SMTP                         |

Сверка: `nodemailer 9.1.0` вече е в `package.json`, неползван. `MAIL_*` са в env (465/TLS).
`placeOrder` връща само `{id, number}` — писмото иска заключените цени (MON-4) → връщат се.

## 3. Как

1. `core/mail`: ленив transport от `MAIL_*`, timeouts ~10 s (default 2 min стои преди redirect).
   `sendMail` логва само `name`/`code`, без адрес. Празен `MAIL_HOST`: dev → печата в конзолата,
   `true`; prod → предупреждение, `false`. 587 = `MAIL_SECURE=false` + `requireTLS`.
2. `PlacedOrder` += `createdAt`, `items`, `subtotal`, `shippingCost`, `total` — без втора заявка.
3. Шаблон без I/O (ARC-2): номер, дата, редове „qty × цена = сума", три суми, „Плащане при
   доставка", линк `APP_URL/order/{number}` + „отваря се в браузъра, от който поръчахте; ако не —
   отговорете на този имейл". **Без** име, телефон, адрес, офис, бележка, персонализация — имейлът
   е непроверен вход. Текстът е водещ; HTML — една таблица, inline стилове.
4. Адресът е `parsed.data.email` (без lowercase). При `MAIL_ADMIN_TO` — второ писмо, същият
   шаблон, тема с `[Нова поръчка]`.

## 4. Какво НЕ се пипа

Схемата; транзакцията на `placeOrder`; токенът (линкът не носи токен); `/order/[number]`;
лимити; compose/nginx/прод `.env` (само се предлага `MAIL_ADMIN_TO`).

## 5. Приемни критерии

- [ ] Поръчка → едно писмо с номер, дата, редове, суми, COD, линк, изречението за браузъра.
- [ ] Text и HTML без лични данни за доставка/персонализация.
- [ ] SMTP отказ/timeout → поръчката е записана, количката празна, redirect; лог без адрес.
- [ ] Празен `MAIL_HOST` → dev конзола / prod предупреждение, без хвърляне.
- [ ] `MAIL_ADMIN_TO` → второ писмо; иначе едно. Сумите = `/order/{number}`.
- [ ] `pnpm verify` без предупреждения.

## 6. Как се проверява

Тестове: `order-mail.test.ts` (редове, суми, линк, няма телефон/адрес/име); `actions.test.ts`
(`sendMail` отказ → пак redirect; веднъж с `to`; с админ — два пъти); `send.test.ts` (без host).
Ръчно: dev поръчка → писмото в конзолата на `pnpm dev`; прод (собственикът) → реално писмо от
`info@dcards-bg.com`, `docker logs dcards-app-prod` без `EAUTH`/`ECONNECTION`.
