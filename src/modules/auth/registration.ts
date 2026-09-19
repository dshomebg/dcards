// Регистрация от потребител: ред в `users` + лична организация, атомарно.
// Без `session.ts` — така db тестът го внася без `server-only`.

import { DrizzleQueryError } from 'drizzle-orm';

import type { DbExecutor } from '@/modules/core';
import { createPersonalOrganization } from '@/modules/platform';

import type { RegisterInput } from './schema';
import type { PublicUser } from './user.schema';
import { createUser } from './user.service';

export type RegisterResult =
  | { readonly status: 'created'; readonly user: PublicUser }
  | { readonly status: 'email_taken' };

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof DrizzleQueryError &&
    (error.cause as { code?: string } | undefined)?.code === '23505'
  );
}

/**
 * Зает имейл се лови по уникалния индекс, не с предварителна проверка — две
 * едновременни регистрации инак минават и двете. Транзакцията се връща цяла:
 * няма org без user. `isAdmin`/`emailVerifiedAt` нарочно не се подават.
 */
export async function registerAccount(
  db: DbExecutor,
  input: RegisterInput,
): Promise<RegisterResult> {
  try {
    const user = await db.transaction(async (tx) => {
      const created = await createUser(tx, {
        email: input.email,
        password: input.password,
        name: input.name,
      });
      await createPersonalOrganization(tx, {
        ownerUserId: created.id,
        name: created.name,
      });
      return created;
    });
    return { status: 'created', user };
  } catch (error) {
    if (isUniqueViolation(error)) return { status: 'email_taken' };
    throw error;
  }
}
