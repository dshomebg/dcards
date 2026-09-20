import { DrizzleQueryError } from 'drizzle-orm';

/** Нарушен уникален индекс (Postgres 23505) — общата проверка за всички модули. */
export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof DrizzleQueryError &&
    (error.cause as { code?: string } | undefined)?.code === '23505'
  );
}
