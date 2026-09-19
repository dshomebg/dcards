# Дневник

> Един цикъл — един запис, до 5 реда: какво работи и проверимото число. Спънките също.

## 2026-09-19 — Инфраструктура и скеле

- DNS в Cloudflare (A/www/mail/webmail, MX, SPF, DKIM, DMARC), Let's Encrypt за web и mail.
- Git: `dshomebg/dcards`. Скеле: `.claude/` (6 агента, pipeline, hook), `CLAUDE.md`, `docs/`.
- Next.js монолит: `pnpm verify` минава; dev на :3100; `/api/health/ready` → ready; Docker
  образ 282 MB; deploy/rollback/bootstrap скриптове + nginx шаблон подготвени (не пуснати).
- Спънка: DKIM без `v=DKIM1;` префикс; mail ACME искаше отделен vhost; 3000–3002 са на pagagal.
