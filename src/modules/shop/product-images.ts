// Снимките на продукта са ключове `products/<uuid>.webp` в `core/storage`;
// основната е първата. Без runtime внос от `core` извън `storage/key` — barrel-ът
// на `shop` стига до клиентски bundle.

import { z } from 'zod';

import { isObjectKey } from '../core/storage/key';

export const MAX_PRODUCT_IMAGES = 6;

export function isProductImageKey(key: string): boolean {
  return key.startsWith('products/') && isObjectKey(key);
}

const storedSchema = z.array(z.unknown());

/** Лош ред в базата не дава 500 на витрината (DAT-7) — лошият елемент се пропуска. */
export function readProductImages(value: unknown): string[] {
  const parsed = storedSchema.safeParse(value);
  if (!parsed.success) return [];
  return parsed.data.filter(
    (key): key is string => typeof key === 'string' && isProductImageKey(key),
  );
}

export function primaryImage(value: unknown): string | null {
  return readProductImages(value)[0] ?? null;
}
