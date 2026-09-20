# `PLT-7` — Pro теми: собствен цвят, лого на фон, без брандинг

**Тежест:** голяма — Pro gating (права), споделен DTO (`ProfileTheme`/`PublicProfile`), потребителски
вход, стигащ до CSS.
**Заявено:** 2026-09-20 (zadanie § 8, § 7.2)
**Сверено с кода:** 2026-09-20.

## Дневник на етапите

| Етап         | Изпълнител | Кога       | Резултат                                                       |
| ------------ | ---------- | ---------- | -------------------------------------------------------------- |
| анализ       | analyzer   | 2026-09-20 | задание                                                        |
| код          | programmer | 2026-09-20 | 631 теста                                                      |
| ревю         | reviewer   | 2026-09-20 | готово с уговорки                                              |
| сигурност    | security   | 2026-09-20 | 2 ниски — ключ по регекс при четене, FOR UPDATE — поправени    |
| тестове      | диригент   | 2026-09-20 | verify 675, build (след поправка node:fs), Playwright Pro/Free |
| документация | диригент   | 2026-09-20 | worklog, DAT-16, open-items, handover                          |

## 1. Какво не е наред

Pro org няма как да сложи свой цвят и лого на фон, макар `theme.primaryColor` и
`can(org,'customTheme')` да съществуват; футърът „Създадено с DCARDS" стои и за Pro. Сверка:
`profileThemeSchema` вече валидира hex; `actions.ts` и `profile-preview.tsx` нулират `primaryColor`
твърдо — това е блокерът; футърът съществува; `findProfileBySlug` не носи плана на org-а → join;
`ProfileTheme` няма поле за лого-фон (jsonb → без миграция); 7 тестови фикстури + `seed-demo` имат
пълен `ProfileTheme` литерал → новото поле е с Zod `default`.

## 2. Къде

| Файл                                                                                                        | Роля                                                                                             |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/modules/platform/profile.schema.ts`, `profile.service.ts`                                              | `ProfileTheme.logoBackground` (`default(false)`); `findPublicProfileRecordBySlug` прилага плана  |
| `src/modules/platform/profile.repository.ts`                                                                | `findProfileBySlug` с join `organizations` → `{ plan, planExpiresAt }`                           |
| `src/modules/platform/profile-edit.service.ts`                                                              | Free/изтекъл Pro пази Pro полетата от реда                                                       |
| `src/modules/platform/theme-contrast.ts` (нов), `index.ts`                                                  | hex → `'light' \| 'dark'` мастило по WCAG контраст                                               |
| `src/app/[slug]/{profile-view.tsx,profile-theme.css,page.tsx}`                                              | inline `--profile-accent(-ink)`, `data-profile-logo-bg` + `::before` воден знак, prop `branding` |
| `src/app/app/(protected)/profiles/[id]/{page,profile-editor,profile-fields,profile-preview,actions,schema}` | color input + Switch, disabled + бадж „Pro"; превюто гейтва еднакво; action не нулира            |

## 3. Как

1. **Схема.** `logoBackground: z.boolean().default(false)`; `primaryColor` остава (нормализира се към
   малки букви). Стар ред минава през `safeTheme` (DAT-7).
2. **Контраст без JS.** `theme-contrast.ts`: relative luminance → контраст спрямо `--color-bg` и
   `--color-ink`, връща по-високия. `ProfileView` слага inline `--profile-accent`/`--profile-accent-ink`
   **само** при `primaryColor !== null`; preset-ът остава подложка. Без нови hex литерали в компоненти.
3. **Лого на фон.** `data-profile-logo-bg` + inline `--profile-logo: url(/api/uploads/<key>)` само при
   `logoBackground && logoKey !== null`. CSS: корен `position: relative`; `::before` `inset: 0`,
   `background: var(--profile-logo) top center / 70% no-repeat`, ниска `opacity`, `pointer-events: none`.
4. **Gating при рендер.** `findProfileBySlug` връща и плана; в `findPublicProfileRecordBySlug`:
   `!can(org,'customTheme')` → `primaryColor: null, logoBackground: false` в DTO-то (редът не се пипа);
   `record.branding = !can(org,'noBranding')`. `ProfileView` получава `branding: boolean` и рисува
   футъра само при `true`. Pro маха брандинга автоматично.
5. **Gating при запис.** `updateProfile`: Free/изтекъл Pro записва `preset` от входа, а
   `primaryColor`/`logoBackground` от съществуващия ред — входът се игнорира, без грешка (отказ би
   блокирал всеки запис при изтекъл Pro). Форджнат Pro вход от Free не се записва.
6. **Редактор.** `page.tsx` подава `plan: { customTheme, branding }`. В „Тема": `Field type="color"`
   (`null ↔ '#…'`, бутон „Без цвят") и `Switch` „Лого на фон" (`disabled` без лого). При `!customTheme`
   — `disabled` + `<Badge tone="brand">Pro</Badge>` + подсказка. Превюто прилага същото гейтване и `branding`.

## 4. Какво НЕ се пипа

Postgres схемата (jsonb — без миграция); `layout`; preset стойностите в `profile-theme.css`;
`tokens.css`; `plan.ts`; vCard/QR/`/c/{id}`/сканирания; качването на лого (PLT-6); кеш на `/{slug}`;
превключвател „покажи брандинга" за Pro.

## 5. Приемни критерии

- [ ] Pro с `primaryColor` → inline `--profile-accent` и `--profile-accent-ink` по контраста; без цвят —
      страницата е както преди (без inline style/атрибут).
- [ ] Pro с лого и `logoBackground` → `data-profile-logo-bg` + `--profile-logo`; без лого — нищо.
- [ ] Free или изтекъл Pro: без custom цвят/лого-фон, футър има; редът пази стойностите. Активен Pro: без футър.
- [ ] Free записва профил с Pro стойности в реда → минава, стойностите остават; Pro стойности от Free
      не се записват. Pro записва цвят и лого-фон → връщат се обратно. Невалиден цвят → `input_invalid`.
- [ ] Стар ред без `logoBackground` → `false`. Редактор Free: disabled + „Pro", превюто без цвят и с
      футър; Pro: полетата работят, превюто следва цвета на живо, без футър.
- [ ] `pnpm verify` без предупреждения; без нов клиентски JS на публичната страница.

## 6. Как се проверява

Тестове: `theme-contrast.test.ts`, `profile.service.db.test.ts` (join + гейт по изтекъл Pro, default на
старо json), `profile-edit.service.db.test.ts` (Free пази Pro полета; Pro записва; невалиден hex),
`profile-view.test.tsx` (inline променливи, лого-фон, `branding`), `profile-preview.test.tsx`,
`profile-editor.test.tsx` (disabled + бадж). Ръчно/Playwright: org → Pro → цвят `#8b1e3f` + лого на фон →
превю → `/{slug}` без футър → org Free → `/{slug}` без цвят, с футър, редакторът disabled → запис на
име минава → обратно Pro → цветът се връща. Регресия: трите preset-а без цвят — идентичен HTML.

## 7. Решено

(а) Free игнорира Pro входа и пази реда (не отказ); (б) брандингът пада за Pro автоматично;
(в) `noBranding` влиза в цикъла.
