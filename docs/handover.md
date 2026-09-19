# Предаване между сесиите

> **Презаписано:** 2026-09-19, край на първата сесия (инфраструктура + скеле).
> Чете се веднага след `CLAUDE.md`. Презаписва се, не се дописва. Таван 200 реда.

## Докъде сме

**Етап 1 е завършен и комитнат. ПРОДЪТ Е НА ЖИВО от 2026-09-20: `https://www.dcards-bg.com`**
(release в `/opt/dcards/.deploy-history`; nginx шаблон `dcards-proxy` в Hestia; първи админ
`info@dcards-bg.com`, паролата е при собственика). Следва: или **първи деплой** (`docs/go-live.md` + rate limit
преди него), или **етап 2** — карти и партиди (`/c/{id}`, активация, admin `/admin/batches`).

`PLT-5`: редактор `/app/profiles/{id}` (полета, адрес, тема, видимост, линкове ↑/↓, превю,
изтриване); `profile-edit.service.ts` с `getProfileForEdit/updateProfile/replaceProfileLinks/
deleteProfile` — всички по `org_id AND id`.

`PLT-4`: `/register`, `/login`, `/app` с пазач `requireCurrent()` (всяка страница/action го вика
сама), списък + „Нов профил". Една сесия за клиент и админ (cookie `session`, AUTH-7).

`PLT-3`: `/api/vcard/{slug}`, `/api/qr/{slug}`, ред с действия на `/{slug}` (единствен клиентски
компонент `share-button.tsx`). Ръчна проверка на телефон (.vcf, Web Share през https) — на
собственика.

`PLT-2`: `profiles`/`profile_links` + миграция `0001`; `/{slug}` SSR (3 теми, OG, 13 типа линкове
през `linkHref`); `can()` за Free/Pro; `pnpm db:seed:demo -- --email a@x.bg` → `/demo`. Модулът
`platform` изнася `createProfile`/`findPublicProfileBySlug`/`ProfileError` — PLT-4 стъпва на тях.

`PLT-1`: `users`/`organizations`/`org_members` + първа миграция; админът е ред в базата
(`pnpm db:seed:admin -- --email … --password …`); тестова база в Docker на 55434 (`pnpm test`
иска Docker). Dev базата има `a@x.bg` / `correct-horse-1`.

`ADM-1`: `/admin/login` (акаунтът вече е от базата — PLT-1), сесия в Redis,
пазач в `admin/(protected)/layout.tsx`, двоен панел, 5 секции, 7 екрана „предстои";
`components/{ui,list,form,nav}` и `hooks` пренесени от pagagal. Минал е analyzer → programmer
→ reviewer + security → поправки → 53 теста + Playwright на живо. Дневникът е в
`docs/tasks/ADM-1-admin-skeleton.md`.

Работи и е проверено:

- `pnpm verify` минава (format, comments, typecheck, lint, тестове node/dom/db).
- `pnpm infra:up` → `dcards-postgres-dev` (5433) и `dcards-redis-dev` (6380).
- `pnpm dev` на :3100 — начална страница + `/api/health/ready` → `{"status":"ready"}`.
- `pnpm build` → standalone + `migrate.mjs`; `node --env-file=.env .next/standalone/migrate.mjs`
  минава срещу dev базата (празна история, `drizzle/meta/_journal.json`).
- `docker build -f docker/app.Dockerfile` → образ 282 MB със `server.js`, `migrate.mjs`, `drizzle/`.
- Сървър: DNS, Let's Encrypt (web + mail), пощата `info@` с TLS — всичко живо.

Не е правено: bootstrap на `/opt/dcards`, nginx шаблон, първи deploy — `docs/go-live.md`.

## Следващата стъпка

**Етап 1 от `zadanie.md`:** auth (имейл + парола, argon2id, сесии в Redis), организации,
профили + линкове, публична страница `[slug]`, vCard, QR. Първо — Drizzle схемите на
`users / organizations / org_members / profiles / profile_links` и първата миграция.

Преди това собственикът решава: канонично `www` или apex (виж `go-live.md`).

## Капани, които вече ни хванаха

- **`next build` от Git Bash с cwd `/f/01DCARDS` пада** („Expected workStore to be initialized")
  — малка буква на диска кара Next да зареди модулите си двойно; от PowerShell с главна буква (`F:`)
  минава. Не е код.
- **Playwright снимка + `autoFocus` дава hydration warning** (`caret-color: transparent`) —
  артефакт на инструмента, не на приложението. Скриптът е в `%TEMP%\dcards-e2e\login.mjs`
  (временен; ако се окаже полезен — влиза в `scripts/visual/` като при pagagal).

- **Портове 3000–3002 на тази машина са на pagagal dev.** dcards dev е на 3100; Postgres/Redis
  на 5433/6380. Next мълчаливо сменя порта, ако е зает — и после curl-ваш чужд сайт.
- **Hook-ът `verify-gates` се пуска ПРЕДИ командата.** Редакция + `pnpm verify` в една команда
  се спира по старото състояние. Редактирай в отделна команда, после `verify`.
- **Bash heredoc за файлове с кирилица и обратни кавички понякога се спъва** в тази среда —
  тогава се пише с `Write`, не се бори с екранирането.
- **Next пренаписва `tsconfig.json`** (jsx → react-jsx, include) и дописва блок в `CLAUDE.md`
  при първия `dev`/`build`. Не е грешка, не се връща.
- **DKIM в Cloudflare** беше въведен без `v=DKIM1; k=rsa;` — проверявай пълния TXT, не само
  дали съществува.
- **Let's Encrypt за mail домейн в Hestia** иска nginx vhost за `mail.`/`webmail.` само за
  ACME — `/etc/nginx/conf.d/mail-acme-dcards-bg.conf` по образец на pagagal.

## Общи файлове с pagagal

Копирани и адаптирани, не споделени: `.claude/agents/*`, `pipeline`, `verify-gates.mjs`,
`scripts/comments/*`, eslint, deploy скриптовете. Промяна там не се синхронизира сама.
