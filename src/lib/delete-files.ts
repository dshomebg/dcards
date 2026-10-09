import { logUnexpected } from '@/lib/log-unexpected';
import { deleteObject } from '@/modules/core';

/**
 * Провалът на триене е лог, не грешка — редът в базата е вече верен (DAT-15).
 * ⚠ НЕ в `'use server'` файл: оттам всеки изнесен async е action, достъпен отвън.
 */
export async function deleteFilesQuietly(
  keys: readonly (string | null)[],
): Promise<void> {
  const present = keys.filter((key): key is string => key !== null);
  await Promise.all(
    present.map((key) =>
      deleteObject(key).catch((error: unknown) => {
        logUnexpected('deleteObject', error);
      }),
    ),
  );
}
