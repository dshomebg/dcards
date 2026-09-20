// Лог при неуспешен запис в `scans` — страницата се вижда, редът се губи.

import { DrizzleQueryError } from 'drizzle-orm';

/** Само код и constraint — pg `detail` и Drizzle `message` носят целия ред (DAT-6). */
export function logScanFailure(where: string, error: unknown): void {
  const cause =
    error instanceof DrizzleQueryError
      ? (error.cause as { code?: string; constraint?: string } | undefined)
      : undefined;
  console.error(`${where}: scan insert failed`, cause?.code, cause?.constraint);
}
