# `PLT-3` — vCard, QR и „Сподели" на публичната страница

**Тежест:** голяма — два нови публични route handler-а без auth (вход от потребител в URL,
файлов изход с потребителски текст) и първият клиентски компонент на `/[slug]`. Пуска `security`.
**Заявено:** 2026-09-19
**Сверено с кода:** 2026-09-19 — всеки `файл:ред` по-долу е отворен наново, не преписан от
заявката.

## Дневник на етапите

| Етап         | Изпълнител | Кога       | Резултат                                         |
| ------------ | ---------- | ---------- | ------------------------------------------------ |
| анализ       | analyzer   | 2026-09-19 | задание                                          |
| код          | programmer | 2026-09-19 | готово; 4 отклонения приети                      |
| ревю         | reviewer   | 2026-09-19 | готово с уговорки — 5 поправени от диригента     |
| сигурност    | security   | 2026-09-19 | 1 ниска (RFC 8187) поправена; без експлоатируеми |
| тестове      | programmer | 2026-09-19 | 69 + 1; Playwright: QR/Сподели/vCard на живо     |
| документация | диригентът | 2026-09-19 | ARC-8/9, worklog, open-items                     |

## 1. Какво не е наред

Картата води до `/{slug}` (PLT-2), но човекът отсреща не може да направи нищо с профила освен да
го гледа: няма „Запази контакт" (`.vcf`), няма QR за показване от екран на екран, няма „Сподели".
Етап 1 (`docs/zadanie.md` § 10) свършва точно с тези три (§ 7.1:167-168, § 9:213-214).

**Сверка със заявката — разлики:**

- `src/app/[slug]/profile-view.tsx:71` — мястото за реда с действия е коментар (PLT-2 § 3.5).
- `src/modules/platform/slug.ts:46-47` — `vcard` и `qr` вече са в `RESERVED_SLUGS`.
- `src/app/[slug]/page.tsx:19` — изричният тип за `params` вече е образец; `page.tsx:47` строи
  URL на профила инлайн — може да се съгласува с `profileUrl` (§ 3.1), по избор.
- `src/components/ui/dialog.tsx:1-7` — **не става за публичната страница**: `'use client'`,
  внася `lucide-react` и `Button` с админ токени (`bg-surface`, `border-border`, `text-text`),
  не `--profile-*`. QR се показва с native `<details>` (§ 3.4).
- `src/modules/core/env.ts:10` — `APP_URL` по подразбиране е `:3000`; QR локално кодира грешен
  хост, ако `.env` не го задава.
- `src/modules/platform/profile.service.ts:99-103,110` — граници: име ≤ 80, bio ≤ 600, стойност
  на линк ≤ 500. Най-дългият vCard ред е bio на кирилица ≈ 1200 октета → § 3.2 за folding.
- `node_modules/@types/qrcode` — липсва; `qrcode` не носи типове → dev зависимост.
- `vitest.config.ts:19-35` — `.test.ts` в `node`, `.test.tsx` в `happy-dom`.
- Next `…/02-guides/cdn-caching.md:24` — динамичен маршрут получава `private, no-cache, no-store`.
  **Не е документирано** дали изричен `Cache-Control` в `Response` на route handler го
  замества — проверява се с curl (§ 5); резервен вариант в § 3.3.
- `docs/zadanie.md:165` („кеш с revalidate") е заменено от ARC-6; `:167` PHOTO base64 — няма
  storage, отлага се; `:169` `whatsapp://` — PLT-2 избра `wa.me`, не се пипа.

## 2. Къде

| Файл                                  | Редове | Роля в промяната                                       |
| ------------------------------------- | ------ | ------------------------------------------------------ |
| `src/modules/platform/profile-url.ts` | нов    | `profileUrl(appUrl, slug)` — единственото място за URL |
| `src/modules/platform/vcard.ts`       | нов    | `buildVCard`, `vcardContentDisposition`, escaping      |
| `src/modules/platform/qr.ts`          | нов    | `renderQrSvg(url)` върху `qrcode`                      |
| `src/modules/platform/index.ts`       | 3-22   | barrel: изнася трите; `escapeVCardText` не излиза      |
| `src/app/api/vcard/[slug]/route.ts`   | нов    | тънък handler: slug → профил → `.vcf`                  |
| `src/app/api/qr/[slug]/route.ts`      | нов    | тънък handler: slug → профил → SVG                     |
| `src/app/[slug]/share-button.tsx`     | нов    | ЕДИНСТВЕНИЯТ `'use client'` в папката                  |
| `src/app/[slug]/profile-view.tsx`     | 71     | редът с действия на мястото на коментара               |
| `src/app/[slug]/page.tsx`             | 47, 59 | подава `appUrl` на изгледа; по избор `profileUrl`      |
| `package.json`                        | 38-75  | `qrcode` (dep), `@types/qrcode` (dev)                  |
| `src/app/api/health/ready/route.ts`   | 7-27   | само за контекст: образец за handler и `dynamic`       |
| `src/modules/platform/link-href.ts`   | 52-78  | само за контекст: `linkHref` дава URL/tel за vCard     |

## 3. Как (посока, не готов код)

### 3.1 URL на профила (`profile-url.ts`)

`profileUrl(appUrl, slug)` → `${appUrl без краен /}/${slug}`. Строи се само от `APP_URL` + slug,
никога от `request.url`/`Host` (ARC-7). Ползва се от vCard (ред `URL` към самия профил), от QR и
от `ProfileView` (share/alt текст).

### 3.2 vCard (`vcard.ts`) — vCard 3.0, ръчно, без библиотека

`buildVCard(profile: PublicProfile, profileUrl: string): string`. Редове, CRLF, накрая CRLF:

| Ред                          | Източник                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `BEGIN:VCARD`, `VERSION:3.0` | винаги                                                                        |
| `N:{last};{first};;;`        | `lastName`, `firstName` — всеки компонент escaped поотделно                   |
| `FN:{first} {last}`          | винаги                                                                        |
| `TITLE:`, `ORG:`             | `title`, `company` — само ако не са `null`                                    |
| `TEL;TYPE=CELL,VOICE:`       | `phone`, `whatsapp`, `viber` → номер от `linkHref` без `tel:`/`wa.me` (за     |
|                              | whatsapp/viber: `+` + цифри). **Дедупликация** по цифри — същият номер веднъж |
| `EMAIL;TYPE=INTERNET:`       | `email` (trim); `null` от `linkHref` → пропуска се                            |
| `URL:`                       | първо `profileUrl`; после `website`, `custom`, `linkedin`, `facebook`,        |
|                              | `instagram`, `tiktok`, `youtube`, `telegram` — стойността е `linkHref(...)`,  |
|                              | `null` → пропуска се (ARC-7: никога суровата стойност)                        |
| `ADR;TYPE=WORK:;;{addr};;;;` | `address` — целият текст в компонент „улица"                                  |
| `NOTE:`                      | `bio`                                                                         |
| `END:VCARD`                  | винаги                                                                        |

Пропуска се: `label` на линковете (vCard 3.0 няма преносим етикет); `theme`. `PHOTO` — влиза
между `NOTE` и `END` като `PHOTO;ENCODING=b;TYPE=JPEG:` когато има storage; тогава folding става
задължителен. Оставя се коментар на мястото, не код.

**Escaping (RFC 2426 § 2.4.2):** една функция `escapeVCardText(v)`: първо `\` → `\\`, после
`;` → `\;`, `,` → `\,`, `\r\n`/`\r`/`\n` → `\n` (буквално обратна наклонена + n); останалите
контролни знаци (`\x00-\x1f`, `\x7f`) се махат. Прилага се на ВСЯКА потребителска стойност,
включително компонентите на `N` и `ADR` (escaped поотделно, после съединени с `;`).

**Folding (75 октета):** НЕ в v1 (прието). RFC-то го дава като SHOULD; парсерите на iOS/Android
четат дълги редове; коректното сгъване е по октети без разкъсване на UTF-8 и си заслужава едва с
`PHOTO`. Тест гарантира, че в изхода няма самотен `\n` извън CRLF.

`vcardContentDisposition(profile)` → `attachment; filename="{slug}.vcf";
filename*=UTF-8''{encodeURIComponent(first + ' ' + last)}.vcf`. Slug е ASCII по `slugSchema`
(fallback); кирилското име минава само през `filename*` (RFC 5987), никога в `filename`.

### 3.3 QR (`qr.ts`) и заглавки на двата отговора

`renderQrSvg(url)` → `qrcode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 })`.
Цветове — подразбираните на библиотеката (без hex литерали в кода). **Само SVG в v1** (прието):
един формат, мащабира се, `<img>` го показва навсякъде; PNG е ред в `open-items.md`. Пакет
`qrcode@^1.5` — програмистът потвърждава с `pnpm view qrcode version` и `pnpm view @types/qrcode
version`.

Handler-ите (образец `ready/route.ts:7-27`): `export async function GET(_req: Request, ctx: {
params: Promise<{ slug: string }> })` — изричен тип (ARC-7). Ред: `slugSchema.safeParse` →
невалиден → 404 **без заявка** (DAT-8); `findPublicProfileBySlug(db, slug)` → `null` → 404
(DAT-7; скрит и непознат неразличими). 404 е `new Response('Not found', { status: 404, headers:
{ 'Cache-Control': 'no-store' } })`. Двата файла са `dynamic = 'force-dynamic'` (ARC-6).

| Отговор | Заглавки                                                                                                                                   |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| vCard   | `Content-Type: text/vcard; charset=utf-8` · `Content-Disposition` от § 3.2 · `Cache-Control: no-store` · `X-Content-Type-Options: nosniff` |
| QR      | `Content-Type: image/svg+xml; charset=utf-8` · `Cache-Control: public, max-age=86400` · `X-Content-Type-Options: nosniff`                  |

QR **без `immutable`** (прието): съдържанието зависи от `APP_URL`, който ще се смени при
купуване на краткия домейн. Скрит профил → QR остава в кеш до 24 ч — приемливо. **Ако** curl
покаже, че Next заменя изричния `Cache-Control`, резервният вариант е `export const revalidate =
86400` — записва се в дневника като отклонение.

### 3.4 Редът с действия (`profile-view.tsx:71`) и share бутонът

`ProfileView` получава нов проп `appUrl: string` (от `page.tsx`, `env().APP_URL`) и строи
`url = profileUrl(appUrl, profile.slug)`. На мястото на коментара, над `<ul>`:

1. **„Запази контакт"** — `<a href={`/api/vcard/${profile.slug}`} download>`; без JS. Стил:
   акцент (`bg-(--profile-accent) text-(--profile-accent-ink)`), като главно действие.
2. **„Сподели"** — `<ShareButton url={url} title={fullName} />` от `share-button.tsx`.
3. **„QR"** — native `<details>`: `<summary>` изглежда като другите два бутона; вътре `<img
src={`/api/qr/${profile.slug}`} alt={`QR код към ${url}`} width={240} height={240}>` върху
   `--profile-surface`. Без JS, без диалог. Известно: браузърът зарежда `<img>` и при затворен
   `<details>` — една заявка към кеширан ~2KB SVG на визита, прието. Разположението решава
   програмистът; условие: всичко само с `--profile-*`, без hex.

`share-button.tsx` (`'use client'`, ≤ 50 реда): props `url`, `title`. При натискане:
`navigator.share` съществува → `share({ title, url })`, `AbortError` се преглъща; иначе
`navigator.clipboard.writeText(url)` → състояние „Копирано" за ~2 с; clipboard липсва/отказан →
показва адреса като текст до бутона. Никакви импорти от `@/modules/*` и от `src/components/ui/*`.
Стил като „Запази контакт", но `--profile-surface`.

Тестът на PLT-2 „няма `'use client'` в `src/app/[slug]/`" се заменя с „точно един файл".

### 3.5 Тестове

- node `vcard.test.ts`: `BEGIN/VERSION/END`; CRLF на всеки ред и без самотен `\n`; `N`/`FN` от
  двете имена; escaping за `;` `,` `\` и многоредов bio (`\n` буквално); `\r` изчезва; `TEL` за
  phone/whatsapp/viber с дедупликация; `EMAIL`; `URL` първо профилът, после само `https`
  резултати от `linkHref`, `javascript:` стойност → липсва; `ADR` с escaped компонент; `null`
  полета → редовете липсват; `vcardContentDisposition` с кирилско име → ASCII `filename` +
  `filename*` с `%D0…`.
- node `qr.test.ts`: започва с `<svg`, съдържа `</svg>`; детерминиран; различен за различен slug.
  `profile-url.test.ts`: краен `/` в `APP_URL` не удвоява.
- dom `profile-view.test.tsx` (допълва се): `href="/api/vcard/ivan-petrov"` с `download`,
  `<img src="/api/qr/ivan-petrov"`, бутон „Сподели"; досегашните минават.
- dom `share-button.test.tsx`: с `navigator.share` (`vi.stubGlobal`) → извикан с `{ title, url }`;
  без него и с `clipboard.writeText` → „Копирано"; без нито едно → адресът е в DOM.
- Route handler-ите **нямат автоматичен тест** (прието): проверяват се с curl (§ 6).

## 4. Какво НЕ се пипа

- Схемата и миграциите — нищо.
- `findPublicProfileBySlug`, `profile.repository.ts`, `link-href.ts`, `slug.ts` — не се променят.
- `POST /api/scans`, броене на изтегляния/сканирания — етап 4. `/c/[id]` — етап 2.
- `PHOTO` в vCard, `core/storage`, `sharp` — цикълът за качване.
- PNG формат на QR, `?format=`/`?size=` — `open-items.md`. Folding — с `PHOTO`.
- `src/components/ui/*` — не се ползват и не се променят.
- `profile-theme.css` и `tokens.css` — без нови променливи.
- Кешът на страницата (ARC-6), `next.config.ts` — не. `og:*` в `page.tsx` — без промяна.
- Редактор/PLT-4, auth, admin, `/app/*`.

## 5. Приемни критерии

- [ ] `GET /api/vcard/{slug}` на публичен профил → 200, `Content-Type: text/vcard; charset=utf-8`,
      `Content-Disposition` с `filename="{slug}.vcf"` и `filename*=UTF-8''…`; тялото започва с
      `BEGIN:VCARD\r\nVERSION:3.0` и завършва с `END:VCARD\r\n`; редовете са само CRLF.
- [ ] Профил с bio `a;b,c\d` на два реда → в `NOTE` стоят `a\;b\,c\\d` и буквално `\n`.
- [ ] Различни номера в phone и whatsapp → два `TEL`; един и същ номер → един `TEL`.
- [ ] `custom` със стойност `javascript:alert(1)` не дава `URL` ред; `website` `demo.bg` дава
      `URL:https://demo.bg`; първият `URL` е `${APP_URL}/{slug}`.
- [ ] `GET /api/qr/{slug}` → 200, `image/svg+xml`, тялото започва с `<svg`,
      `Cache-Control: public, max-age=86400` (потвърдено с curl).
- [ ] `/api/vcard/…` и `/api/qr/…` за непознат slug, `is_public=false` и невалиден slug (`Demo`,
      `a`, `a b`) → 404 с еднакъв отговор; невалидният не стига до базата.
- [ ] `/{slug}` показва „Запази контакт" (линк с `download`), „Сподели", „QR" над линковете;
      разгъването на QR показва картинката без презареждане и без грешки в конзолата.
- [ ] „Сподели" на телефон с Web Share отваря системния лист; на десктоп без него копира адреса и
      надписът става „Копирано"; без clipboard адресът се вижда като текст.
- [ ] В `src/app/[slug]/` има точно един файл с `'use client'` и няма hex литерал.
- [ ] `.vcf`, отворен на iOS и Android, предлага нов контакт с име, длъжност, фирма, телефон,
      имейл и линк към профила (ръчно, от собственика).
- [ ] Няма нов бутон без действие.

## 6. Как се проверява

**Машинно:**

```bash
pnpm verify
grep -rln "use client" "src/app/[slug]/"                 # точно един: share-button.tsx
grep -rnE "#[0-9a-fA-F]{3,6}\b" "src/app/[slug]/"        # празно
pnpm view qrcode version && pnpm view @types/qrcode version
```

**Ръчно** (dev на `:3100`, `APP_URL=http://localhost:3100` в `.env`, `pnpm db:seed:demo`):

1. `curl -si http://localhost:3100/api/vcard/demo | head -20` — заглавки по § 3.3, `BEGIN:VCARD`;
   `curl -s … | od -c | head` показва `\r\n`.
2. `curl -si http://localhost:3100/api/qr/demo | head -8` — `image/svg+xml` и `Cache-Control:
public, max-age=86400`; SVG-ът се сканира с телефон → води до `APP_URL/demo`.
3. `curl -sI …/api/vcard/nqma`, `…/api/qr/Demo`, `…/api/vcard/demo` след `is_public=false` → 404.
4. `http://localhost:3100/demo` — трите действия над линковете; „QR" разгъва картинката;
   „Сподели" на десктоп → „Копирано", в clipboard е адресът.
5. Телефон (собственикът): през `https` (на `http://192.168…` Web Share и clipboard не работят по
   дизайн на браузъра): „Запази контакт" отваря Контакти с попълнени полета; „Сподели" — лист.
6. Профил с `;`, `,`, `\` и нов ред в bio → `.vcf` се отваря без грешка и бележката е четима.

**Регресия — какво НЕ трябва да се счупи:**

- `/{slug}` продължава да дава 200/404 както в PLT-2 § 5; `og:*` и `<title>` непроменени; трите
  теми — същите цветове.
- `profile-view.test.tsx` — досегашните очаквания минават (броят `<li>` остава 3).
- `/api/health/ready`, `/admin`, `/` — работят.
- Клиентският JS на `/{slug}` е само share бутонът — `qrcode` и `vcard.ts` не се появяват в
  клиентски chunk.

## 7. Блокиращи въпроси

Няма. Приети от диригента: (а) само SVG; (б) QR `max-age=86400` без `immutable`; (в) без folding
до `PHOTO`; (г) whatsapp/viber → `TEL;TYPE=CELL` с дедупликация; (д) QR през `<details>`; (е)
`URL` към самия профил като първи ред.
