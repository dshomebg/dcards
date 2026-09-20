// Формата на ключа — без `node:fs`, за да може да се внася и от код, който
// стига до клиентски bundle през barrel-а на `platform` (DAT-7 при четене).

export const OBJECT_KINDS = ['logos', 'photos'] as const;
export type ObjectKind = (typeof OBJECT_KINDS)[number];

/** Единственият приеман ключ — без него няма `join` с клиентски вход. */
export const OBJECT_KEY_PATTERN = /^(logos|photos)\/[0-9a-f-]{36}\.webp$/;

export function isObjectKey(key: string): boolean {
  return OBJECT_KEY_PATTERN.test(key);
}
