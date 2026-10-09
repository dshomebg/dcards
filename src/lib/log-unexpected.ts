import { DrizzleQueryError } from 'drizzle-orm';

/**
 * Неочаквана грешка в action → лог без лични данни (DAT-6, DAT-17): от базата
 * само код и constraint; иначе име, код и редовете `at …` — без съобщението.
 */
export function logUnexpected(where: string, error: unknown): void {
  if (error instanceof DrizzleQueryError) {
    const cause = error.cause as
      { code?: string; constraint_name?: string } | undefined;
    console.error(`${where}: db error`, cause?.code, cause?.constraint_name);
    return;
  }
  const err = error as { name?: string; code?: string; stack?: string } | null;
  const frames = err?.stack
    ?.split('\n')
    .filter((line) => /^\s+at /.test(line))
    .join('\n');
  console.error(`${where}:`, err?.name ?? 'error', err?.code, frames);
}
