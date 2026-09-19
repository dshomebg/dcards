// `href` по тип линк (§ 3.7). Чисти функции — ползват се и от страницата, и от
// тестове без база. Само `http(s)` минава като URL: `javascript:`/`data:` → `null`.

import type { ProfileLinkType } from './profile.schema';

export const LINK_LABELS: Readonly<Record<ProfileLinkType, string>> = {
  phone: 'Телефон',
  email: 'Имейл',
  website: 'Уебсайт',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  whatsapp: 'WhatsApp',
  viber: 'Viber',
  telegram: 'Telegram',
  address: 'Адрес',
  custom: 'Линк',
};

function digits(value: string): string {
  return value.replaceAll(/\D/g, '');
}

function handle(value: string): string {
  return value.trim().replace(/^@/, '').replaceAll(/\s/g, '');
}

/** Приема само `http(s)://` — всяка друга схема е `null`. */
function url(value: string): string | null {
  const trimmed = value.trim();
  return /^https?:\/\/\S+$/i.test(trimmed) ? trimmed : null;
}

/** Има ли вече схема (`x:`) — тогава минава само през `url()`, не се допълва. */
function hasScheme(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(value.trim());
}

function urlOrHttps(value: string): string | null {
  if (hasScheme(value)) return url(value);
  return url(`https://${value.trim()}`);
}

function urlOrHandle(value: string, base: string): string | null {
  if (hasScheme(value)) return url(value);
  const name = handle(value);
  return name === '' ? null : `${base}${name}`;
}

function phone(value: string): string | null {
  const trimmed = value.trim();
  const number = (trimmed.startsWith('+') ? '+' : '') + digits(trimmed);
  return digits(trimmed) === '' ? null : `tel:${number}`;
}

const BUILDERS: Readonly<
  Record<ProfileLinkType, (value: string) => string | null>
> = {
  phone,
  email: (v) => (v.trim() === '' ? null : `mailto:${v.trim()}`),
  website: urlOrHttps,
  custom: urlOrHttps,
  linkedin: (v) => urlOrHandle(v, 'https://www.linkedin.com/in/'),
  facebook: (v) => urlOrHandle(v, 'https://www.facebook.com/'),
  instagram: (v) => urlOrHandle(v, 'https://www.instagram.com/'),
  tiktok: (v) => urlOrHandle(v, 'https://www.tiktok.com/@'),
  youtube: (v) => urlOrHandle(v, 'https://www.youtube.com/@'),
  whatsapp: (v) => (digits(v) === '' ? null : `https://wa.me/${digits(v)}`),
  viber: (v) =>
    digits(v) === '' ? null : `viber://chat?number=%2B${digits(v)}`,
  telegram: (v) => urlOrHandle(v, 'https://t.me/'),
  address: (v) =>
    v.trim() === ''
      ? null
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.trim())}`,
};

export function linkHref(type: ProfileLinkType, value: string): string | null {
  return BUILDERS[type](value);
}
