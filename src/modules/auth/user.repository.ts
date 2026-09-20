// Достъп до `users` — единственото място в модула, което пише SQL.

import { and, eq, isNull, sql } from 'drizzle-orm';

import type { DbExecutor } from '@/modules/core';

import { type NewUser, type User, users } from './user.schema';

/**
 * Търси през `lower(email)`, точно както е уникалният индекс — друго условие
 * би го пропуснало и би сканирало таблицата. Връща и хеша: само за входа.
 */
export async function findByEmailWithHash(
  executor: DbExecutor,
  email: string,
): Promise<User | null> {
  const rows = await executor
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);

  return rows[0] ?? null;
}

/** По първичен ключ — за сверка на жива сесия с текущото състояние на реда. */
export async function findById(
  executor: DbExecutor,
  id: string,
): Promise<User | null> {
  const rows = await executor
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  return rows[0] ?? null;
}

export async function insert(
  executor: DbExecutor,
  user: NewUser,
): Promise<User> {
  const rows = await executor
    .insert(users)
    .values({ ...user, email: user.email.toLowerCase() })
    .returning();

  const created = rows[0];
  if (created === undefined) throw new Error('insert users returned no row');
  return created;
}

/** Само хешът — `true`, ако редът съществува и е презаписан. */
export async function updatePasswordHash(
  executor: DbExecutor,
  userId: string,
  passwordHash: string,
): Promise<boolean> {
  const rows = await executor
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, userId))
    .returning({ id: users.id });

  return rows.length > 0;
}

/**
 * Само първото потвърждение записва дата — `true` при промяна. `false` означава
 * „вече потвърден" или „няма такъв ред"; извикващият ги различава с `findById`.
 */
export async function markEmailVerified(
  executor: DbExecutor,
  userId: string,
): Promise<boolean> {
  const rows = await executor
    .update(users)
    .set({ emailVerifiedAt: sql`now()` })
    .where(and(eq(users.id, userId), isNull(users.emailVerifiedAt)))
    .returning({ id: users.id });

  return rows.length > 0;
}
