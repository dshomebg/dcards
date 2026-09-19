# Отворени точки

> По един ред. Затворената се МАХА — следата остава в worklog.

- Кратък домейн за картите (`xxx.link`) — не е купен; блокира първата партида, не кода.
- Платежен доставчик — myPOS или Stripe; не блокира етапи 1–3.
- Cloudflare API token — няма; DNS се пипа ръчно от собственика.
- Webmail (Roundcube) за домейна — не е включен в Hestia; при нужда.
- Rate limit на `/admin/login` (Redis) — преди първия прод деплой на админа.
- Пренесените коментари цитират задания на pagagal (`ADM-22`, `CAT-50`…) — да се изчистят.
- Всяка бъдеща страница/Server Action с данни под `/admin` вика `getCurrentAdmin()` сама —
  layout-пазачът не се изпълнява при мека навигация (конвенция, не код сега).
- Абсолютен таван на сесията (напр. 30 дни) и затваряне на старата при повторен вход.
- Barrel-ът на `auth` носи `server-only` през `session.ts` → `scripts/` го внася дълбоко
  (`user.service`). Да се раздели на домейнов и Next-ов barrel; правилото за граници да покрие
  и `scripts/**`.
- `vitest.globalSetup.db.ts` / `vitest.setup.db.ts` / `vitest.setup.dom.ts` са извън `tsc` и
  `eslint`.
- Инварианти на org (точно един owner, `plan_expires_at` ↔ `plan`) са само в кода — trigger или
  check при цикъла за управление на организации.
- `CreateUserInput.isAdmin` излиза през barrel-а — регистрацията НЕ бива да го препраща от вход.
- Кеш на `/{slug}` — само след измерен LCP на прод (ARC-6). `updated_at` вече е ключ.
- Squatting на фирмени имена в slug (zadanie § 11) — не е решено.
- nginx: rate limit и security headers за публичната страница и `/api/{vcard,qr}` — преди прод.
- QR като PNG (за печат) и `?size=` — при нужда; никога потребителски `color` към `qrcode`.
- vCard folding (75 октета) и `PHOTO` — заедно с цикъла за качване на снимка.
- `.vcf` на iOS/Android и Web Share на телефон през https — ръчна проверка от собственика.
- `linkHref`: `demo.bg:8080` без схема се тълкува като схема → линкът се пропуска мълчаливо.
- `seed-demo` при скрит `/demo` във Free org казва `plan_limit_profiles` вместо „exists".
