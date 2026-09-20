# `PLT-6` — Профилна снимка и лого: редактор, публична страница, vCard PHOTO

**Тежест:** голяма — качване от влязъл потребител върху профил (права), споделена повърхност
(`core/storage` за две папки, route), промяна на `PublicProfile` DTO.
**Заявено:** 2026-09-20 (zadanie § 3, § 7.1, § 7.2; open-items vCard PHOTO)
**Сверено с кода:** 2026-09-20.

## Дневник на етапите

| Етап         | Изпълнител | Кога       | Резултат                                                    |
| ------------ | ---------- | ---------- | ----------------------------------------------------------- |
| анализ       | analyzer   | 2026-09-20 | задание                                                     |
| код          | programmer | 2026-09-20 | 614 теста                                                   |
| ревю         | reviewer   | 2026-09-20 | готово с уговорки; повреден файл → без PHOTO; alt на логото |
| сигурност    | security   | 2026-09-20 | 1 средна (изтрит профил оставя снимка) — поправена          |
| тестове      | диригент   | 2026-09-20 | verify 618, build; Playwright пълен поток                   |
| документация | диригент   | 2026-09-20 | worklog, DAT-15, open-items, handover                       |

## 1. Какво не е наред

Редакторът няма поле за снимка и лого; `/{slug}` рисува инициали; `.vcf` е без `PHOTO` и без folding.
Колоните `profiles.photo_key/logo_key` съществуват, но никой не ги пише/чете. Сверка: `ProfileEditDto`
изключва ключовете изрично; `profile-theme.css` няма нищо за лого; `logo-url.ts` вече връща
`/api/uploads/${key}`; снимката НЕ влиза в `profileFormSchema` — записва се веднага (не със „Запази").

## 2. Къде

| Файл                                                                                                             | Роля                                                                                                |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `src/modules/core/image/{logo→process,index}.ts`                                                                 | главна: `processImage(input, { maxSide, fit })`, `toJpeg(webp, side)`; `processLogo` остава обвивка |
| `src/modules/core/storage/local.ts`, `index.ts`, `core/index.ts`                                                 | `ObjectKind = 'logos' \| 'photos'`, регекс за двете, `createObjectKey(kind)`                        |
| `src/app/api/uploads/logos/[key]` → `[kind]/[key]/route.ts`                                                      | един route; URL-ите на логата непроменени                                                           |
| `src/lib/logo-url.ts` → `upload-url.ts` (+вносители)                                                             | `uploadUrl(key)`                                                                                    |
| `src/modules/core/rate-limit/policy.ts`, `app/(protected)/rate-limit.ts`                                         | `imageUploadUser` 20/3600; `imageUploadLimit(userId)` отказва при `degraded`                        |
| `src/modules/platform/{profile.schema,profile.service,profile.repository,profile-edit.service,index}.ts`         | `PublicProfile` + `photoKey`/`logoKey`; `setProfileImage` (WHERE org_id AND id, връща стария ключ)  |
| `src/app/app/(protected)/profiles/[id]/{image-actions.ts,profile-images.tsx,profile-editor,profile-preview}.tsx` | главна: качване/премахване; секция „Снимка и лого"; `saved` носи ключовете                          |
| `src/components/image-upload.tsx` ← `products/[slug]/logo-upload.tsx`                                            | обобщен компонент; shop-ът е тънка обвивка                                                          |
| `src/app/[slug]/profile-view.tsx`, `page.tsx`                                                                    | кръгла снимка (alt = името) вместо инициали; лого над header-а                                      |
| `src/modules/platform/vcard.ts`, `src/app/api/vcard/[slug]/route.ts`                                             | главна: `PHOTO;ENCODING=b;TYPE=JPEG` + folding ≤ 75 октета за всички редове                         |

## 3. Как

1. **`core/image`:** `processImage(input, { maxSide, fit })` — същият pipeline; лого `inside` 256, снимка
   `cover` квадрат 512. `LogoError` → `ImageError` (shop вносителите се обновяват). `toJpeg(webp, 256)`.
   **Storage:** `/^(logos|photos)\/[0-9a-f-]{36}\.webp$/`, `createObjectKey(kind)`; `createLogoKey` обвивка.
2. **Качване:** `uploadProfileImageAction(profileId, kind, formData)` — zod → размер ≤ 2 MB →
   `requireCurrent` → `userActionLimit` → `imageUploadLimit` → профилът е на org-а → `processImage` →
   `putObject(нов)` → `setProfileImage` (връща стария) → `deleteObject(стар)`. Провал на записа → трие
   новия. Приема **файл, никога ключ**. `removeProfileImageAction` → null + `deleteObject`. Провал на
   `deleteObject` е лог. Резултат `{ ok, key }`; редакторът слива в `saved`.
3. **Редактор:** `<ImageUpload>` с props `value`, `label`, `hint`, `shape`, `upload(formData)`, `onRemove`;
   секция „Снимка и лого" с бележка „записва се веднага". `toPublicProfile` подава ключовете на превюто.
4. **Публична страница:** снимка `size-24 rounded-full object-cover`, `alt` името; лого `max-h-12 w-auto
object-contain` над header-а върху `bg-(--profile-surface)` подложка — еднакво за трите теми. DTO носи
   ключове; `ProfileView` ги превръща с `uploadUrl`. OG image — не сега.
5. **vCard:** route чете `readObject(photoKey)` → `toJpeg` → `buildVCard(profile, url, { jpeg })` →
   `PHOTO;ENCODING=b;TYPE=JPEG:<base64>`. `foldLines`: ≤ 75 октета (UTF-8, `Buffer.byteLength`),
   продължение `CRLF + ' '`, без разцепване на многобайтов знак — за всички редове. `no-store` остава.
   Липсващ файл при наличен ключ → vCard без PHOTO, 200.
6. **Лимити:** `imageUploadUser` 20/h; при `degraded` — отказ. Без Pro gating.

## 4. Какво НЕ се пипа

Схемата (без миграция); `LOGO_KEY_PATTERN` в `cart.ts` и `uploadLogoAction`; `updateProfile`/
`profileFormSchema`; „лого на фон" (Pro) и `primaryColor`; OG `images`; кеш на `/{slug}` и `.vcf`;
чистене на сирачета; `next.config.ts`, Docker, `backup.sh`; `next/image`.

## 5. Приемни критерии

- [ ] Влязъл качва PNG/JPEG/WebP ≤ 2 MB като снимка и като лого; превюто ги показва веднага; след
      презареждане са там. Снимка на диска 512×512 WebP, лого ≤ 256 px; малък вход не се увеличава.
- [ ] Повторно качване трие стария файл (404 на стария URL); „Премахни" → null и файлът го няма.
- [ ] Чужд `profileId`, не-UUID, лош `kind`, SVG/GIF/HTML, > 2 MB → съобщение, нищо на диска/в базата;
      21-во/час → лимит.
- [ ] `/{slug}` показва кръгла снимка с alt и логото над header-а в трите теми; без снимка — инициали.
- [ ] `/api/vcard/{slug}` съдържа `PHOTO;ENCODING=b;TYPE=JPEG`, всеки ред ≤ 75 октета; без снимка —
      както днес, но foldнат; ключ с липсващ файл → без PHOTO, 200.
- [ ] `/api/uploads/logos/<uuid>.webp` от SHP-4 работи непроменено; `/api/uploads/photos/../x` → 404.
- [ ] `pnpm verify` без предупреждения.

## 6. Как се проверява

Тестове: `process.test.ts` (512 cover от 1200×800; 256 inside; отказите), `local.test.ts` (две папки),
`image-actions.test.ts` (чужд профил → отказ и новият файл изтрит; лош файл; лимит; смяна трие стария),
`profile-edit.service.db.test.ts` (`setProfileImage` връща стария; чужд org → null), `vcard.test.ts`
(PHOTO декодира; всеки ред ≤ 75 октета; unfold == оригинал за кирилска NOTE > 75), `profile-view.test.tsx`,
`image-upload.test.tsx`. Ръчно/Playwright: качване → превю → `/{slug}` → `.vcf` с PHOTO → повторно
качване → стар URL 404. Регресия: магазинът с лого, `saveProfileAction` не нулира ключовете.

## 7. Решено

(а) снимката е квадрат `cover`; (б) JPEG за vCard се прави в паметта при всяка заявка; (в) логото е
върху `--profile-surface` подложка за трите теми.
