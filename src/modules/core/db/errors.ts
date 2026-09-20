import { DrizzleQueryError } from 'drizzle-orm';

// Драйверът `postgres` слага името на индекса в `constraint_name` (не в
// `constraint` като `pg`).
interface PgCause {
  readonly code?: string;
  readonly constraint_name?: string;
}

function pgCause(error: unknown): PgCause | undefined {
  return error instanceof DrizzleQueryError
    ? (error.cause as PgCause | undefined)
    : undefined;
}

/** Нарушен уникален индекс (Postgres 23505) — общата проверка за всички модули. */
export function isUniqueViolation(error: unknown): boolean {
  return pgCause(error)?.code === '23505';
}

/** Името на нарушения уникален индекс — за таблици с повече от един; иначе `null`. */
export function uniqueViolationConstraint(error: unknown): string | null {
  const cause = pgCause(error);
  if (cause?.code !== '23505') return null;
  return cause.constraint_name ?? null;
}

// `ON DELETE RESTRICT` дава 23001, не 23503 — второто е за `NO ACTION` и insert.
const FK_CODES: ReadonlySet<string> = new Set(['23503', '23001']);

/** Нарушен външен ключ — изтриване на ред, към който сочат поръчки. */
export function isForeignKeyViolation(error: unknown): boolean {
  const code = pgCause(error)?.code;
  return code !== undefined && FK_CODES.has(code);
}
