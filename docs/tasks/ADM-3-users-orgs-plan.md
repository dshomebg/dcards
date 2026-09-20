# `ADM-3` — `/admin/orgs` и `/admin/users`: преглед, търсене, план и дата на изтичане

**Тежест:** голяма по обем (два екрана, детайл, форма, три repository-та), сменя права (Pro) →
`security` се пуска.
**Заявено:** 2026-09-20 (zadanie § 7.3, § 8; AUTH-3)
**Сверено с кода:** 2026-09-20.

## Дневник на етапите

| Етап         | Изпълнител | Кога       | Резултат                                                   |
| ------------ | ---------- | ---------- | ---------------------------------------------------------- |
| анализ       | analyzer   | 2026-09-20 | задание                                                    |
| код          | programmer | 2026-09-20 | 29 теста в обхвата                                         |
| ревю         | reviewer   | 2026-09-20 | готово с уговорки; формата синхронизира датата, `min`      |
| сигурност    | security   | 2026-09-20 | чисто                                                      |
| тестове      | диригент   | 2026-09-20 | verify 618, build; Playwright pro/минала дата/free/търсене |
| документация | диригент   | 2026-09-20 | worklog, DAT-14, open-items, handover                      |

## 1. Какво не е наред

`/admin/users` и `/admin/orgs` са `ComingSoon`. Админът не вижда клиентите и не може да даде/отнеме
Pro. Сверка: `plan_expires_at` не се пише никъде — това е първият writer; ILIKE няма никъде →
escape helper е нов; `CursorPager` не се ползва (лимит 200 + бележка); nav вече сочи двата пътя.

## 2. Къде

| Файл                                                                                                                                                    | Роля                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `src/modules/platform/organization.repository.ts`                                                                                                       | главна: `searchOrganizations`, `getOrganizationForAdmin`, `updateOrganizationPlan`, `listMembershipsForUsers` |
| `src/modules/platform/index.ts`                                                                                                                         | нови експорти + `effectivePlan`, `PLAN_LABELS`, `OrganizationError`                                           |
| `src/modules/auth/user.repository.ts`, `index.ts`                                                                                                       | главна: `searchUsers` → `PublicUser[]`                                                                        |
| `src/modules/core/db/like.ts` (нов) + `core/index.ts`                                                                                                   | `likePattern(query)` — escape на `%`, `_`, `\`                                                                |
| `src/app/admin/(protected)/orgs/{page,[id]/page,actions,schema,plan-form}.tsx`                                                                          | главна                                                                                                        |
| `src/app/admin/(protected)/users/page.tsx`                                                                                                              | главна: списък                                                                                                |
| образци: `cards/actions.ts` (`runCardAction`), `orders/tracking-form.tsx`, `orders/page.tsx` (`SelectFilter`), `batches/[id]/page.tsx` (404 за не-UUID) |

## 3. Как

1. **`/admin/orgs`** — `searchOrganizations(executor, { query?, plan?, limit: 200 })`: `organizations`
   JOIN `users` (само `email`), подзаявка `count(profiles)`; `ORDER BY created_at DESC`; търсене
   `name ILIKE $ OR owner.email ILIKE $` с `ESCAPE '\'`. Филтърът по план е върху колоната. Колони: име
   (линк), тип, план + `Badge danger` „изтекъл" при `effectivePlan(org) !== org.plan`, собственик, профили,
   създадена. `SelectFilter paramKey="plan"`, `SearchFilter paramKey="q"`; невалиден филтър → всички.
   При 200 реда — бележка „показани са първите 200".
2. **`/admin/orgs/[id]`** — `getOrganizationForAdmin`: org + собственик + членове (имейл, име, роля) +
   профили (`findProfilesByOrg`, линк към `/{slug}`, маркер „скрит"). Не-UUID/непознат → 404. `PlanForm`
   (по `tracking-form.tsx`): `Select` free/pro + `Field type="date"` + бутон; при `free` датата е disabled.
3. **`setOrgPlanAction(orgId, plan, expiresOn)`** — Zod: `orgId` uuid, `plan` enum, `expiresOn`
   `z.iso.date() | ''`; `free` → датата се нулира; `pro` → дата ≥ днес по `Europe/Sofia` или празна
   (безсрочно). Ред: Zod → `requireAdmin` → `adminActionLimit` → `updateOrganizationPlan` →
   `revalidatePath` (`/admin/orgs`, `/admin/orgs/{id}`). Грешки: `code`/`constraint_name` (DAT-6).
4. **`updateOrganizationPlan(executor, id, { plan, expiresOn })`** — `UPDATE … RETURNING`; 0 реда →
   `OrganizationError('org_not_found')`. „Изтича на 2026-12-31" = 00:00 на следващия ден по София,
   изчислено в SQL: `((${expiresOn}::date + 1)::timestamp AT TIME ZONE 'Europe/Sofia')`.
5. **`/admin/users`** — само списък: `searchUsers` (`email ILIKE OR name ILIKE`) → `PublicUser[]`;
   `listMembershipsForUsers(userIds)` → `{ userId, orgId, orgName, role }[]`; страницата ги сглобява
   (ARC-2). Колони: имейл, име, потвърден (`Badge`), админ (`Badge brand`), организации (линкове), създаден.

## 4. Какво НЕ се пипа

`plan.ts` (`can`, `effectivePlan`, `PLAN_LIMITS`); `is_admin` (нито четене в действие, нито промяна —
самозаключване); схемата (без нова колона, без `updated_at`); `org_members` покани/роли (`/app/org`);
профилите (readonly); nav; табло; имейл при смяна на план.

## 5. Приемни критерии

- [ ] `/admin/orgs`: всички org-ове с колоните; изтеклият Pro носи „изтекъл"; `?plan=pro` филтрира,
      `?plan=x` показва всички; търсене по име И имейл; `%`/`_`/`\` се търсят буквално.
- [ ] `/admin/orgs/{uuid}`: полета, членове, профили с линк; не-UUID/непознат → 404.
- [ ] Формата: `pro` + дата → `plan_expires_at` = 00:00 София на следващия ден; `pro` без дата → null;
      `free` → null; дата в миналото → грешка, нищо записано. `can(org,'analytics')` отразява веднага.
- [ ] Action без админ → `/admin/login`; над лимита → съобщение; DB грешка → общо съобщение, лог без имейл.
- [ ] `/admin/users`: имейл, име, баджове, org линкове; търсене; `password_hash` не напуска `auth`.
- [ ] Над 200 реда → бележка. `pnpm verify` без предупреждения.

## 6. Как се проверява

Тестове: `organization.repository.db.test.ts` (`updateOrganizationPlan`: pro+дата, pro без дата, free
нулира, непознат id; `searchOrganizations`: име, имейл, escape), `user.repository.db.test.ts`
(`searchUsers`), `core/db/like.test.ts`, `orgs/actions.test.ts` (Zod преди сесия, redirect, лимит,
скрита DB грешка), `orgs/schema.test.ts`, `plan-form.test.tsx`. Ръчно/Playwright: demo org → pro + утре
→ `/app/analytics` е Pro → free → пак Free; `%` в търсенето → 0 резултата; `/admin/users` баджове.

## 7. Решено

(а) `platform` чете `users.email/name` в JOIN за админ списъците (разширение на DAT-6 изключението);
(б) „изтича на" = край на деня по `Europe/Sofia`, изчислен в SQL.
