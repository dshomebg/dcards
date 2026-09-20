# `AUTH-12` — Потвърждение на имейл при регистрация

**Тежест:** голяма — пипа автентикация и добавя публична повърхност (`/verify-email`); схемата не се
променя (`email_verified_at` съществува).
**Заявено:** 2026-09-20
**Сверено с кода:** 2026-09-20.

## Дневник на етапите

| Етап         | Изпълнител | Кога       | Резултат                                                                       |
| ------------ | ---------- | ---------- | ------------------------------------------------------------------------------ |
| анализ       | analyzer   | 2026-09-20 | задание                                                                        |
| код          | programmer | 2026-09-20 | 532 теста, ръчен сценарий                                                      |
| ревю         | reviewer   | 2026-09-20 | готово с уговорки; ред на записите → атомарен SET GET                          |
| сигурност    | security   | 2026-09-20 | 2 ниски (race при resend, токен в лога) — поправени; вече потвърден за влезлия |
| тестове      | диригент   | 2026-09-20 | verify 536, build OK, Playwright пълен поток                                   |
| документация | диригент   | 2026-09-20 | worklog, AUTH-12, open-items, handover                                         |

## 1. Какво не е наред

`users.email_verified_at` остава `null` за всеки регистриран. Писмото „Добре дошли" няма линк, няма
страница, която да го приеме, и потребителят не вижда статуса. `zadanie.md` не изисква блокиране →
само индикатор + повторно изпращане.

Сверка: `SessionUser` носи `{id,email,name}` (AUTH-7) — settings чете реда наново
(`loadCurrentRow` в `current-user.ts` има целия `User`, не е в barrel-а). `welcomeMail` тръгва в
`after()` в `register` — токенът се издава вътре в същия `after()`. `seed-admin.ts` ражда админа
потвърден — не се пипа. `/verify-email` НЕ пренасочва влезлия. `apiIp` лимитът има локални обвивки
(`c/[id]/rate-limit.ts`, `api/rate-limit.ts`) — трета за `/verify-email` е приемлива.

## 2. Къде

| Файл                                              | Роля                                                                    |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| `src/modules/auth/email-verification.ts` (нов)    | главна: издаване/консумиране на токен в Redis (образец `order-view.ts`) |
| `src/modules/auth/user.repository.ts`             | `markEmailVerified` до `updatePasswordHash`                             |
| `src/modules/auth/user.service.ts`                | `verifyEmailByToken`, `findUserById` → `PublicUser`                     |
| `src/modules/auth/account-mail.ts`                | `welcomeMail` приема `verifyUrl?`; нов `verifyEmailMail`                |
| `src/modules/auth/user-actions.ts`, `index.ts`    | токен + URL вътре в `after()`; barrel                                   |
| `src/modules/core/rate-limit/policy.ts`           | `verifyResendUser: 3/3600` + ключ                                       |
| `src/app/(auth)/verify-email/page.tsx` (нов)      | главна: GET страница, лимит `apiIp`, `noindex`                          |
| `src/app/app/(protected)/settings/{page,actions}` | главна: индикатор + Server Action „Изпрати отново"                      |
| `src/app/app/(protected)/rate-limit.ts`           | `verifyResendLimit` по образец на `passwordChangeLimit`                 |
| `src/modules/auth/current-user.ts`                | `getCurrentPublicUser()` върху `loadCurrentRow`                         |

## 3. Как

1. **Токен** — `randomBytes(32)` base64url, формат `^[A-Za-z0-9_-]{43}$`. `email-verify:<token>` →
   userId, TTL 24 h; `email-verify-user:<userId>` → token (при повторно изпращане старият се трие —
   един жив токен). Консумирането трие двата. Паднал Redis: издаване → писмо без линк; консумиране →
   екран „невалиден"; никога 500.
2. **`markEmailVerified`** — `UPDATE … SET email_verified_at = now() WHERE id AND email_verified_at
IS NULL RETURNING id`; 0 реда → `findById` различава `already` от `not_found`.
   `verifyEmailByToken(db, token)` = формат → Redis → mark → del → `verified|already|invalid`.
3. **Писма** — `welcomeMail(name, {appName, appUrl, verifyUrl?})`; `verifyEmailMail({appName,
verifyUrl})` без име/имейл. `verifyUrl = ${APP_URL}/verify-email?token=…`.
4. **`/verify-email`** — Server Component в `(auth)`; `apiIp` лимит по `headers()`; `verified|already`
   → „Имейлът е потвърден" + линк `/app`; иначе „Линкът е невалиден или изтекъл" + линк към
   `/app/settings` (ако е влязъл) или `/login`. Лог без имейл/токен.
5. **Settings** — „Потвърден на …" или „Непотвърден" + бутон. `resendVerificationAction()`:
   `requireCurrent` → `userActionLimit` → `verifyResendLimit` → вече потвърден → съобщение без писмо →
   токен → `after(sendMail)` → `{ok:true}`. Провал на Redis → съобщение.
6. **Сигурност** — токенът е капабилност; GET, който променя състояние, е прието за verify линкове.

## 4. Какво НЕ се пипа

Схема/миграции; `SessionUser`/cookie (AUTH-7); никакво блокиране за непотвърден; `seed-admin.ts`,
`registration.ts`, `registerRateLimit`, `loginRateLimit`; `passwordChangedMail`; `order-view.ts` (не
се обобщава в общ token store); смяна на имейл/покани.

## 5. Приемни критерии

- [ ] Регистрация → писмо с линк; отварянето попълва `email_verified_at`, показва „Потвърдено" + `/app`.
- [ ] Втори клик / стар токен след повторно изпращане → „невалиден", без 500, без промяна.
- [ ] Вече потвърден с валиден токен → „Потвърдено" идемпотентно; датата не се презаписва.
- [ ] Линкът работи без вход и в друг браузър. `/verify-email` без/с лош `token` → „невалиден", 200.
- [ ] Settings: „Непотвърден" + бутон или дата без бутон; 4-то натискане/час → лимит; потвърден → без писмо.
- [ ] Паднал Redis: регистрацията минава (писмо без линк), никъде 500. Логове без имейл/токен.
- [ ] `pnpm verify` без предупреждения.

## 6. Как се проверява

Тестове: `email-verification.test.ts` (node, redis mock по `session.test.ts`), `user.repository`
db тест за `markEmailVerified`, `account-mail.test.ts`, `user-actions.test.ts` (линк в писмото),
`settings/actions.test.ts` (лимит, потвърден, Redis провал), dom за формата. Ръчно: регистрация →
линк от писмото в incognito → „Потвърдено" → settings показва датата; ×4 „Изпрати отново" → лимит.
