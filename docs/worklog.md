# Дневник

> Един цикъл — един запис, до 5 реда: какво работи и проверимото число. Спънките също.

## 2026-09-19 — Инфраструктура и скеле

- DNS в Cloudflare (A/www/mail/webmail, MX, SPF, DKIM, DMARC), Let's Encrypt за web и mail.
- Git: `dshomebg/dcards`. Скеле: `.claude/` (6 агента, pipeline, hook), `CLAUDE.md`, `docs/`.
- Next.js монолит: `pnpm verify` минава; dev на :3100; `/api/health/ready` → ready; Docker
  образ 282 MB; deploy/rollback/bootstrap скриптове + nginx шаблон подготвени (не пуснати).
- Спънка: DKIM без `v=DKIM1;` префикс; mail ACME искаше отделен vhost; 3000–3002 са на pagagal.

## 2026-09-19 — ADM-1 Скелет на админа

- `/admin`: вход с временен акаунт, сесия в Redis, пазач, двоен панел, 5 секции + 7 „предстои".
- Пренесени от pagagal `ui/list/form/nav/hooks` (≈45 файла), палитрата през токените.
- Одит: 3 находки (времеви оракул, кеширан отхвърлен promise, изход при паднал Redis) — поправени.
- Проверено на живо с Playwright: вход/грешки/cookie/навигация/чекмедже/изход. 53 теста.
- Спънка: pagagal ID-та (`ADM-22`…) в 35 пренесени коментара се бъркат с нашите — за чистене.

## 2026-09-19 — PLT-1 Потребители, организации, истински вход

- Схеми `users` / `organizations` / `org_members`, миграция `0000_init_users_orgs`, seed за админ.
- Входът чете от базата; `ADMIN_BOOTSTRAP_*` махнати. Тестова база в Docker (55434), проект `db`.
- Одит: 3 находки поправени — сесията се сверява с реда при всяка заявка, seed не печата хеш,
  argon2 параметрите закрепени. 34 теста + curl/Playwright на живо (вкл. отнемане на права).
- Спънка: `cookies().delete` не работи в Server Component — при отнет `is_admin` пада само ключът.

## 2026-09-19 — PLT-2 Профили, линкове, публична страница

- Схеми `profiles` / `profile_links` + миграция `0001`; `can()` за Free/Pro; `/{slug}` SSR с
  OG, 3 теми, 13 типа линкове; `not-found`; `pnpm db:seed:demo` → `/demo`.
- Одит: XSS през `href` — чисто; средна находка (вход без Zod) поправена + `theme` с fallback.
- Ревю: генерираният `PageProps` чупи `typecheck` на чиста машина — заменен с изричен тип.
- 17 файла / 118 теста; снимки в 3 теми на 390 px и 1200 px; счупен `theme` в базата → 200.

## 2026-09-19 — PLT-3 vCard, QR, „Сподели"

- `/api/vcard/{slug}` (.vcf, CRLF, escaping, дедупликация на TEL), `/api/qr/{slug}` (SVG,
  24 ч кеш), ред с действия на `/{slug}` — един клиентски компонент („Сподели" → clipboard).
- Ревю + одит: без експлоатируеми находки; RFC 8187 кодиране и `URL` без `\,` поправени.
- Спънка: Chromium игнорира `display: contents` на `<details>` — QR панелът е извън grid-а през
  `group-has-[details[open]]`. Проверено на живо: QR, „Копирано", vCard, без грешки в конзолата.

## 2026-09-19 — PLT-4 Клиентски вход, регистрация, рамка на `/app`

- `/register`, `/login`, `/app` (пазач, лента, списък профили, „Нов профил"); една сесия за
  клиент и админ (AUTH-7); `isOrgMember`, `listProfiles`.
- Одит: 2 ниски (имейл без max, сирак при повторен вход) — поправени; ревю: `orgId` последен.
- Playwright: регистрация → дублиран имейл → грешни slug-ове → създаване → лимит → пазачи →
  изход → вход. Спънка: `li` в flex `ul` с `inline-block` линк се свиваше до padding — `flex-none`
  и `block whitespace-nowrap`.

## 2026-09-19 — PLT-5 Редактор на профил

- `/app/profiles/{id}`: полета, адрес, тема, видимост, линкове (↑/↓, скриване), живо превю в
  рамка, изтриване с потвърждение; `saveProfileAction` в една транзакция.
- Одит: без експлоатируеми; `primaryColor` се нулира при запис. Ревю: `touchProfile` с JS време.
- Playwright: превю, лимит 6 с rollback на полетата, ред, запис → `/demo`, смяна на адрес,
  запазен адрес, изтриване на телефон. **Етап 1 от заданието е завършен.**

## 2026-09-20 — Първи деплой

- Bootstrap (`/opt/dcards`), deploy (образ `08ddf0b`), nginx шаблон `dcards-proxy` с 301 → www,
  HSTS и headers; `www.dcards-bg.com` отговаря, health `ready`, pagagal непокътнат.
- Спънки: `New-Secret 64` гърмеше (48 байта); Docker build без `.env` — `env()` при импорт в
  layout metadata и db/redis клиентите → placeholder ENV само в build stage.
- Първи админ: `/register` + `is_admin` през SQL (seed не е в образа — open-items).
