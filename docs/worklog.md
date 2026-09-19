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
