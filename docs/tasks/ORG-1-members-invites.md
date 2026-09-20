# `ORG-1` — `/app/org`: членове, покани по имейл, смяна на организация

**Тежест:** голяма — нова таблица (миграция `0008`), нова публична повърхност (`/invite`), права по роля.
**Заявено:** 2026-09-20 (zadanie § 7.2 `/app/org`, § 8 членове Free 1 / Pro без лимит)
**Сверено с кода:** 2026-09-20.

## Дневник на етапите

| Етап         | Изпълнител | Кога       | Резултат                                                             |
| ------------ | ---------- | ---------- | -------------------------------------------------------------------- |
| анализ       | analyzer   | 2026-09-20 | задание                                                              |
| код          | programmer | 2026-09-20 | 668 теста, миграция 0008                                             |
| ревю         | reviewer   | 2026-09-20 | готово с уговорки; editor тест за delete, съобщение при паднала база |
| сигурност    | security   | 2026-09-20 | 1 средна (план при приемане) + 2 ниски — поправени                   |
| тестове      | диригент   | 2026-09-20 | verify 675, build; Playwright два потребителя                        |
| документация | диригент   | 2026-09-20 | worklog, AUTH-13, open-items, handover, roadmap                      |

## 1. Какво не е наред

`/app/org` не съществува. `org_members` (owner/editor) е в схемата, но `loadCurrent` винаги дава
**личната** org — втори човек никога не я вижда. Няма покани, смяна на org, роля в `Current`.
Сверка: `plan.ts` вече има `members: 1 | null`; `listMembershipsForUsers` съществува (админ);
`organization.repository.ts` е 267 реда → новото SQL е в нови файлове; `safeNextPath` приема само
`/c/{id}`, а `register/page.tsx` влага `next` без кодиране → `encodeURIComponent`; `loadCurrent` се
вика и от checkout/order/activate — поръчка и активация отиват в **текущата** org (съзнателно).

## 2. Къде

| Файл                                                                                  | Роля                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/platform/organization.schema.ts` + `drizzle/0008`                        | `org_invitations` (id, org_id cascade, email ≤254, role editor, token_hash unique, invited_by restrict, expires_at, accepted_at, created_at); частичен uniq `(org_id, lower(email)) WHERE accepted_at IS NULL` |
| `src/modules/platform/organization-member.repository.ts` (нов)                        | `findMembership`, `listMembershipsForUser`, `removeMember`, `renameOrganization`, `countMembers`                                                                                                               |
| `src/modules/platform/organization-invitation.{repository,service}.ts` (нови)         | create/find-by-hash/list-pending/delete/accept (транзакция); токен, хеш, срок, лимит по план, съвпадение на имейл                                                                                              |
| `src/modules/platform/organization-mail.ts` (нов), `organization-plan.ts`, `index.ts` | `inviteMail` чиста; кодове `plan_limit_members`, `already_member`, `invite_*`                                                                                                                                  |
| `src/app/app/(protected)/current.ts`, `current-org.ts` (нов)                          | **главна**: `Current.role`; текуща org от cookie `current_org` с проверка на членство; `requireOwner()`                                                                                                        |
| `src/app/app/(protected)/{layout,app-nav,sign-out,rate-limit}.ts(x)`                  | селект при > 1 членство; точка „Организация"; изход трие cookie; `inviteOrgLimit`                                                                                                                              |
| `src/app/app/(protected)/org/{page,actions,schema,*-form}.tsx`                        | главна: екранът и actions                                                                                                                                                                                      |
| `src/app/app/(protected)/profiles/[id]/actions.ts`                                    | `deleteProfileAction` иска `role === 'owner'`                                                                                                                                                                  |
| `src/app/(auth)/invite/{page,actions,rate-limit}.ts(x)` (нови)                        | главна: страницата на токена (образец `verify-email`)                                                                                                                                                          |
| `src/modules/auth/schema.ts`, `src/app/(auth)/register/page.tsx`                      | `safeNextPath` приема и `/invite?token=<43>`; `encodeURIComponent(next)`                                                                                                                                       |
| `src/modules/core/rate-limit/policy.ts`                                               | `inviteOrg 10/3600` по org + `inviteRouteIp`                                                                                                                                                                   |

## 3. Как

1. **Текуща org = cookie `current_org`**, не сесията. `loadCurrent`: сесия → cookie →
   `findMembership(orgId, userId)` (org + role) → при липса/чужда org → лична org с `owner`. Cookie-то е
   подсказка; истината е `org_members` при всяка заявка. `httpOnly`, `sameSite: lax`, `secure` в прод.
   `Current = { user, org, role }`; `requireOwner()` за actions на `/app/org`.
2. **Токен**: 32 байта base64url (43 знака), в писмото суров, в базата SHA-256 hex. Срок 7 дни. Линк
   `${APP_URL}/invite?token=…`. Писмото носи име на org и канещия, без имейла на получателя.
3. **Изпращане** (owner): Zod имейл → не е собственият → не е член → `can(org,'members', членове +
чакащи)` — Free е запълнен от owner-а → поканите са Pro (бадж + `plan_limit_members`) → insert →
   `after()` `sendMail`. Лимит: `userActionLimit` + `inviteOrg` 10/h по org (брои и „изпрати пак").
   Отмяна = изтриване; „изпрати пак" = нов токен + срок върху същия ред.
4. **Приемане** на `/invite?token=`: GET **без промяна** — показва org и бутон „Приеми" (action).
   Изходи: без сесия → линкове `/login?next=`/`/register?next=` (кодирани) · сесия с друг имейл
   (case-insensitive) → „Поканата е за друг адрес" (без да го показва) · вече член → „Вече си член" ·
   невалидна/изтекла/отменена → един екран. Успех: транзакция insert `org_members` (editor) +
   `accepted_at`, cookie = org, redirect `/app`. IP лимит на страницата.
5. **`/app/org`**: име на org (owner, 2–80) · членове (имейл, име, роля; „Премахни" от owner, скрит за
   самия owner) · чакащи покани („Отмени", „Изпрати пак") · форма „Покани" (имейл; роля `editor`).
   Всеки action: `requireOwner` → `userActionLimit`; `orgId` от `Current`, никога от формата.
6. **Смяна**: `listMembershipsForUser` в `layout.tsx`; при > 1 — `<select>` със `switchOrgAction(orgId)`:
   членство → cookie → `redirect('/app')`.
7. `deleteProfileAction` — само `owner`.

## 4. Какво НЕ се пипа

`session.ts`/`SessionUser` (AUTH-7); `org_members` схема, `createPersonalOrganization`,
`findPersonalOrganizationByOwner`; роля `editor` в profiles/cards actions (членството стига); прехвърляне
на собственост, „напусни", покана с роля owner, `type=company`; извикващите на `loadCurrent` в
`(shop)`/`c/[id]/activate`; админ екраните; `organization.repository.ts` (не се реже).

## 5. Приемни критерии

- [ ] Owner на Pro org праща покана → писмо с `/invite?token=` → ред в „изчакващи". Free → бадж „Pro"
      и отказ, без ред. Editor не вижда формите и всеки негов action там е отказан.
- [ ] Получател без акаунт се регистрира от линка, връща се, „Приеми" → `editor`; акаунт с друг имейл →
      отказ без разкриване. GET без „Приеми" не добавя членство.
- [ ] Изтекла/отменена/несъществуваща → един екран. „Изпрати пак" сменя токена; 11-ият/час по org → отказ.
- [ ] Член на две org вижда селект; смяната сменя профили/карти/поръчки. Cookie към чужда org → личната.
- [ ] Owner премахва член (не себе си); премахнатият пада на личната си org. Изтриване на профил от
      editor → отказ. Логове без токен/имейл. `pnpm verify` без предупреждения.

## 6. Как се проверява

Тестове: db за покана (създаване, хеш, изтекла, чужд имейл, вече член, uniq чакаща, приемане в
транзакция), членове (премахване; owner не се премахва), `loadCurrent` с cookie към чужда org → лична,
action тестове (editor отказан навсякъде), `inviteMail`. Ръчно (dev, два потребителя): A Pro → покана
→ линк в частен прозорец → регистрация на B → „Приеми" → селект с 2 org → A премахва B → B пада на
личната; A Free → бадж „Pro"; C отваря линка на B → отказ. Регресия: `?next=/c/{id}`, страниците на
`/app` без cookie, checkout на влязъл (текуща org), изходът трие `current_org`.

## 7. Решено (диригент, 2026-09-20)

Поканите влизат сега (заявка на собственика „до т. 5"); текуща org в cookie; съвпадение на имейл
задължително; изтриване на профил само от owner.
