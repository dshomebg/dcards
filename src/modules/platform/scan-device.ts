// Клас на устройството от `User-Agent` — чиста функция. Суровият низ не
// напуска функцията: в `scans` влиза само `ios|android|other`.

import type { ScanDevice } from './scan.schema';

export function classifyDevice(userAgent: string | null): ScanDevice {
  if (userAgent === null) return 'other';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  return 'other';
}

// `bot` само като дума или `bot/` — телефоните Cubot не са роботи.
const BOT_PATTERN =
  /\bbot\b|bot[/;)\s]|bot$|crawl|spider|slurp|facebookexternalhit|whatsapp|viber|telegram|twitterbot|linkedinbot|preview|headless|curl|wget|python/i;

/** Роботи и OG-preview-ъри не са сканирания; липсващ UA се брои за робот. */
export function isBot(userAgent: string | null): boolean {
  return (
    userAgent === null || userAgent.trim() === '' || BOT_PATTERN.test(userAgent)
  );
}
