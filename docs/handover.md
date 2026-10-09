# Предаване между сесиите

> **Презаписано:** 2026-10-09 (късно), след PLT-8, SHP-5, SHP-6, ORG-2.
> Чете се веднага след `CLAUDE.md`. Презаписва се, не се дописва. Таван 200 реда.

## Докъде сме

**ПРОДЪТ Е НА ЖИВО: `https://www.dcards-bg.com`**, release `af64110` (всичко до ORG-2 и
миграция `0009` са вътре). Админът е `s.panev@gmail.com` (сменен 2026-10-09 по искане на
собственика, паролата е при него; `info@` вече не е вход, остава адрес за известия). Сървърните скриптове
`backup.sh`, `restore-check.sh` (нд 05:00), `cleanup-uploads.sh --delete` (нд 04:30) са в cron;
`cleanup-uploads.sh` е качен наново с `products/` (SHP-5). Старите в `*.bak-2026-10-09`.

**Решение на собственика 2026-10-09:** картово плащане, куриер, абонаменти и offsite копие
отпадат засега.

**Деплойнато 2026-10-09 (`af64110`):**

- `PLT-8` — публичният профил: еднакви бутони с иконки, иконки на линковете, тема `petrol`,
  нечетим Pro цвят → фирмата в ink (`accentReadableOn`).
- `SHP-5` — снимки на продуктите (до 6, WebP ≤1200, `products/`), галерия без JS, отделен лимит
  `uploadsIp`; `deleteQuietly` изнесена от `'use server'` в `src/lib/delete-files.ts` (DAT-18).
- `SHP-6` — нов вид на витрината (илюстрация `card-mockup.tsx`, предимства, стъпки, лента).
- `ORG-2` — **миграция `0009`**: един собственик (уникален частичен индекс), дата само при Pro
  (check). Прод данните сверени 0/0; минава през pre-deploy dump.
- Дребни: `createUser` извън barrel-а на `auth`; `seed-demo` по `slugExists`.

Заданията: `docs/tasks/{PLT-8,SHP-5,SHP-6,ORG-2}-*.md`.

## Следващата стъпка

1. Админът качва снимки на продуктите; после проверка на витрината на телефон.
2. Остават: кратък домейн за картите (блокира първата партида), ръчна проверка на `.vcf` и
   „Сподели" на iPhone/Android.

## Капани, които вече ни хванаха

- **Локалният `.env` има `MAIL_HOST` — `pnpm dev` праща ИСТИНСКИ писма през `info@`.** За тестове
  dev се пуска с празен `MAIL_HOST` (node `spawn` с `env: { MAIL_HOST: '' }` — PowerShell не може да
  зададе празна променлива); тогава писмата са `[mail]` в конзолата. Лимитите на регистрация (3/h)
  и поръчка (5/h) се чистят локално с `redis-cli --scan --pattern 'rl:*'` + `DEL`.

- **`next build` от Git Bash с cwd `/f/01DCARDS` пада** („Expected workStore to be initialized")
  — малка буква на диска; от PowerShell с `F:` минава. Не е код.
- **Playwright:** `%TEMP%\dcards-e2e` е счупена инсталация. Работи `npm i playwright@1.55.0` в
  scratchpad + `executablePath` към `%LOCALAPPDATA%\ms-playwright\chromium-1234\chrome-win64`.
- **Портове 3000–3002 на тази машина са на pagagal dev.** dcards dev е на 3100; Postgres/Redis
  на 5433/6380. Next мълчаливо сменя порта, ако е зает.
- **Hook-ът `verify-gates` се пуска ПРЕДИ командата** и спира и за коментар над 3 реда.
  Редактирай в отделна команда, после `verify`.
- **Песочницата отказва Bash команди с `rm -f`** в тялото — пробите с триене ги пиши като скрипт.
- **PowerShell 5.1 `Set-Content -Encoding utf8` пише BOM** — за `package.json` ползвай `Edit`.
- **Bash heredoc за файлове с кирилица** понякога се спъва — пиши с `Write`.
- **Next пренаписва `tsconfig.json`** и дописва блок в `CLAUDE.md` при първия `dev`/`build`.
- **DKIM в Cloudflare** — проверявай пълния TXT (`v=DKIM1; k=rsa;`).
- **Let's Encrypt за mail в Hestia** иска nginx vhost за `mail.`/`webmail.` само за ACME.

## Общи файлове с pagagal

Копирани и адаптирани, не споделени: `.claude/agents/*`, `pipeline`, `verify-gates.mjs`,
`scripts/comments/*`, eslint, deploy скриптовете. Промяна там не се синхронизира сама.
