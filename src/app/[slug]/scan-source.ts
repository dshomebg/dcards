// Кое отваряне на `/{slug}` е сканиране и от какъв източник — чиста функция,
// за да се тества без Next и без база.

import { isBot, type ScanSource } from '@/modules/platform';

function isPrefetch(headers: Headers): boolean {
  return (
    headers.has('next-router-prefetch') ||
    headers.get('purpose') === 'prefetch' ||
    (headers.get('sec-purpose') ?? '').startsWith('prefetch')
  );
}

/**
 * `?s=qr` → `qr`; без `s` → `direct`; `seen` (cookie от `/c` за този slug) →
 * `null`, чипът вече е записан. Роботи, OG-preview и prefetch не са хора → `null`.
 */
export function scanSourceFor(
  headers: Headers,
  s: string | string[] | undefined,
  seen = false,
): ScanSource | null {
  // Масив (`?s=a&s=b`) е крафтнат адрес, не човек през нашите линкове.
  if (seen || Array.isArray(s)) return null;
  if (isBot(headers.get('user-agent')) || isPrefetch(headers)) return null;
  return s === 'qr' ? 'qr' : 'direct';
}
