// Клас на устройството от `User-Agent` — чиста функция. Суровият низ не
// напуска функцията: в `scans` влиза само `ios|android|other`.

import type { ScanDevice } from './scan.schema';

export function classifyDevice(userAgent: string | null): ScanDevice {
  if (userAgent === null) return 'other';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  return 'other';
}
