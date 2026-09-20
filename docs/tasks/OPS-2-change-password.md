# `OPS-2` — Смяна на парола в `/app/settings`

**Тежест:** голяма — пише `password_hash` (auth), добавя ключове в Redis за сесиите и нова
политика за rate limit; повърхността (`@/modules/auth` barrel) се ползва от `/app` и `/admin`.
**Заявено:** 2026-09-20
**Сверено с кода:** 2026-09-20 — всеки `файл:ред` по-долу е отворен наново, не преписан от заявката.

## Дневник на етапите

| Етап         | Изпълнител | Кога       | Резултат                                |
| ------------ | ---------- | ---------- | --------------------------------------- |
| анализ       | analyzer   | 2026-09-20 | готово                                  |
| код          | programmer | 2026-09-20 | готово, без отклонения                  |
| ревю         | reviewer   | 2026-09-20 | готово с уговорки — контрастът поправен |
| сигурност    | security   | 2026-09-20 | без критични; 2 ниски → open-items      |
| тестове      | programmer | 2026-09-20 | 244 теста; Playwright с два браузъра    |
| документация | диригентът | 2026-09-20 | AUTH-10, worklog, open-items            |

## 1. Какво не е наред

Прод е на живо, първият админ е с генерирана парола и няма никакъв път да я смени.
`/app/settings` е заглушка `ComingSoon` (`settings/page.tsx:11`). Записано в `open-items.md`.

**Сверка с кода — разлики спрямо заявката:**

- `findById` (`user.repository.ts:27-38`) връща целия ред `User`, **включително `passwordHash`**.
- `updatePasswordHash` не съществува.
- Сесиите са само `session:<id>` (`session.ts:21`), без индекс по потребител. `readSession` парсва
  `SessionUser` с `id` — индексът може да се поддържа евтино (§ 3.5).
- `userActionLimit` живее в `profiles/rate-limit.ts` — **по-широко от заявеното**: файлът се
  мести едно ниво нагоре (§ 3.3).
- `verifyPassword` е в `password.ts:19`; сервизът внася от `./password`, не от `admin-account`.

## 2. Къде

| Файл                                                        | Редове | Роля в промяната                                               |
| ----------------------------------------------------------- | ------ | -------------------------------------------------------------- |
| `src/modules/auth/user.repository.ts`                       | 40-52  | главна: `updatePasswordHash` след `insert`                     |
| `src/modules/auth/user.service.ts`                          | 1-38   | главна: `changePassword`                                       |
| `src/modules/auth/schema.ts`                                | 11-20  | главна: `changePasswordInputSchema` (DAT-8)                    |
| `src/modules/auth/session.ts`                               | 21-58  | главна: индекс `user-sessions:<userId>`, `revokeOtherSessions` |
| `src/modules/auth/index.ts`                                 | 19-26  | съгласуване: barrel (ARC-2)                                    |
| `src/modules/core/rate-limit/policy.ts`                     | 8-28   | съгласуване: `passwordChangeUser` политика + ключ              |
| `src/app/app/(protected)/profiles/rate-limit.ts`            | 1-17   | мести се в `src/app/app/(protected)/rate-limit.ts`             |
| `src/app/app/(protected)/profiles/new/actions.ts`           | 10     | съгласуване: път на импорта                                    |
| `src/app/app/(protected)/profiles/[id]/actions.ts`          | 19     | съгласуване: път на импорта                                    |
| `src/app/app/(protected)/settings/page.tsx`                 | 1-12   | главна: страница с две секции                                  |
| `src/app/app/(protected)/settings/{schema,actions}.ts`      | нови   | главна: Zod на формата + `changePasswordAction`                |
| `src/app/app/(protected)/settings/change-password-form.tsx` | нов    | главна: формата                                                |
| `src/app/(auth)/register/register-form.tsx`                 | 11-75  | само за контекст: образец за формата                           |
| `src/app/app/(protected)/profiles/new/actions.test.ts`      | 1-31   | само за контекст: образец за моковете                          |

## 3. Как (посока, не готов код)

### 3.1 Схема (една дефиниция, DAT-8)

В `auth/schema.ts`, до `registerSchema`, `changePasswordInputSchema`: `currentPassword:
z.string().min(1, 'Въведи текущата парола.').max(256)`, `newPassword` — същите граници и
съобщения като `registerSchema.password` (8–256). Сервизът валидира с нея. Формата
(`settings/schema.ts`) я разширява с `confirmPassword` и два `refine`: повторението съвпада
(„Паролите не съвпадат.", path `confirmPassword`) и `newPassword !== currentPassword` („Новата
парола трябва да е различна от текущата.", path `newPassword`).

### 3.2 Repository + сервиз (в `auth`, хешът не излиза — DAT-6)

- `updatePasswordHash(executor, userId, passwordHash): Promise<boolean>` — `update ... where id =
$1`, връща дали е засегнат ред (`.returning({ id })`).
- `changePassword(executor, userId, input): Promise<ChangePasswordResult>` в `user.service.ts`,
  `ChangePasswordResult = 'ok' | 'wrong_current' | 'not_found'`. Стъпки: Zod → `findById` →
  `null` ⇒ `'not_found'` → `verifyPassword(user.passwordHash, currentPassword)` ⇒ `false` ⇒
  `'wrong_current'` → `hashPassword(newPassword)` (AUTH-6) → `updatePasswordHash`. Примамка не
  трябва: потребителят е влязъл. Без транзакция — една заявка за запис.

### 3.3 Rate limit (AUTH-9)

- `RATE_POLICY.passwordChangeUser: { limit: 5, windowSec: 900 }`, `rateKey.passwordChangeUser:
(userId) => 'rl:password:user:<id>'`. Сесия в чужди ръце не бива да познава текущата парола с
  60 опита/мин. Брои се **всеки** опит, и успешният.
- `profiles/rate-limit.ts` се мести в `(protected)/rate-limit.ts` (двата импорта се поправят) и
  получава `passwordChangeLimit(userId)` по образеца на `userActionLimit`.

### 3.4 Server Action `changePasswordAction(input: unknown)` (`settings/actions.ts`)

Ред като `createProfileAction`: Zod с формената схема → `requireCurrent()` (извън `try`) →
`userActionLimit` → `passwordChangeLimit` → `changePassword(db, user.id, parsed.data)` в `try`.
Резултат `{ ok: true } | { ok: false, message }`: `'wrong_current'` → „Текущата парола не е
вярна."; `'not_found'` → „Акаунтът не е намерен — влез отново."; хвърлена грешка → лог на `cause`
(DAT-6; **никога** входа) → „Паролата не беше сменена — опитай пак след малко.". След `'ok'` →
`revokeOtherSessions(user.id)` в отделен `try`: провал (паднал Redis) се логва и **не** променя
резултата.

### 3.5 Другите сесии — **включва се** (прието), индекс по потребител в Redis

- `userKeyOf = (userId) => 'user-sessions:<userId>'` (Redis set).
- `createSession`: след `redis.set` → `sadd(userKey, id)` + `expire(userKey, SESSION_TTL_SECONDS)`.
- `readSession`: след успешния `expire` на ключа → `expire(userKey, SESSION_TTL_SECONDS)` — иначе
  множеството изтича 7 дни след входа, докато плъзгащата сесия още е жива. В същия `try`.
- `revokeOtherSessions(userId)`: текущото id от cookie-то, `smembers(userKey)`, `del` на всички
  `session:<id>` освен текущия, `srem` на изтритите. Текущата сесия **остава**.
- `destroySession`/`revokeSession` НЕ пипат множеството: застояло id е безвредно.
- Сесии, отворени **преди** деплоя, не са в множеството — приема се; след 7 дни изчезват сами.
- Barrel-ът изнася `revokeOtherSessions`, `changePassword`, `changePasswordInputSchema`, типа.

### 3.6 Страницата и формата

`settings/page.tsx`: `requireCurrent()` → `<main>` както `profiles/new/page.tsx`; две
`FormSection`: „Акаунт" — имейл и име само за показване; „Смяна на парола" — формата.
`change-password-form.tsx` (`'use client'`) по `register-form.tsx`: три `Field type="password"`
с `autoComplete` `"current-password"` / `"new-password"` / `"new-password"`, `hint="Поне 8
знака."`; при `ok: false` — `<p role="alert">`; при `ok: true` — `reset()` и `<p
role="status">Паролата е сменена.</p>`. Бутон „Смени паролата" / „Смяна…" при `isSubmitting`.

### 3.7 Тестове

- **node** `settings/actions.test.ts`: невалиден вход не пипа сесията; без сесия →
  `REDIRECT:/login`; лимит → съобщението, сервизът не е викан; ключ `rl:password:user:<id>`, 5,
  900; `'wrong_current'` → точното съобщение; `'ok'` → `{ ok: true }` и `revokeOtherSessions`
  веднъж; хвърлена грешка → generic, без входа; провал на `revokeOtherSessions` → пак `{ ok: true }`.
- **db** `user.service.db.test.ts`: грешна текуща ⇒ `'wrong_current'` и хешът непроменен; вярна ⇒
  `'ok'`, новият хеш verify-ва новата, старата вече не; непознат id ⇒ `'not_found'`.
- **node** `session.test.ts` (нов; mock на redis и `next/headers`): `createSession` добавя id в
  `user-sessions:<userId>`; `revokeOtherSessions` трие всички освен текущия.
- **dom** `change-password-form.test.tsx`: несъвпадащо повторение → Zod, action не е викан; нова
  = текуща → същото; `ok: false` → `role="alert"`; `ok: true` → „Паролата е сменена." и празни полета.

## 4. Какво НЕ се пипа

- Забравена парола, смяна на имейл/име, потвърждение на имейл, изтриване на акаунт.
- `/admin/settings` остава `ComingSoon` — админът е същият ред и сесия (AUTH-7).
- `signIn`/`signInUser`/`register`, примамката и `loginRateLimit`.
- `SESSION_TTL_SECONDS`, cookie атрибутите, абсолютен таван на сесията.
- `ARGON2_OPTIONS`, `toPublicUser`/`PublicUser` — хешът продължава да не излиза.
- `Field`, `FormSection`, `Button`. Схемата на базата — няма миграция.

## 5. Приемни критерии

- [ ] `/app/settings` показва имейла и името (без редакция) и форма с три полета; без сесия →
      `/login`.
- [ ] Вярна текуща + валидна нова + съвпадащо повторение → „Паролата е сменена.", полетата се
      изчистват; вход с новата минава, със старата — „Грешен имейл или парола.".
- [ ] Грешна текуща → „Текущата парола не е вярна."; хешът не се променя.
- [ ] Несъвпадащо повторение, нова < 8, нова = текуща → Zod, без заявка към сървъра.
- [ ] Шестият опит за 15 минути → „Твърде много опити…"; сервизът не се вика.
- [ ] След успешна смяна сесия в друг браузър (след деплоя) е мъртва; текущият остава влязъл.
- [ ] Админ, сменил паролата през `/app/settings`, влиза в `/admin` с новата.
- [ ] Паднал Redis при прекратяването не връща грешка; паролата е сменена; логът е без пароли.

## 6. Как се проверява

**Машинно:** `pnpm verify`.

**Ръчно:** 1. вход → `/app/settings`. 2. грешна текуща → alert. 3. различно повторение → Zod без
заявка. 4. вярна смяна → „Паролата е сменена."; изход; стара → отказ; нова → `/app` и `/admin`. 5. втори браузър преди смяната → след нея → `/login`. 6. шест грешни → лимит. 7. `redis-cli keys
'user-sessions:*'` с TTL.

**Регресия:** вход/регистрация/изход; `readSession` при паднал Redis → `null`; „Нов профил" и
редакторът (преместен `userActionLimit`); `/admin` пазачът.

## 7. Блокиращи въпроси

Няма. Приети: 5/15 мин по потребител; нова = текуща се отказва; другите сесии се прекратяват,
текущата остава; провал на прекратяването не проваля смяната.
