// Потребители за другите модули: хешът се слага тук и не излиза оттук.

import type { DbExecutor } from '@/modules/core';

import { hashPassword, verifyPassword } from './password';
import { type ChangePasswordInput, changePasswordInputSchema } from './schema';
import {
  findByEmailWithHash,
  findById,
  insert,
  updatePasswordHash,
} from './user.repository';
import { type PublicUser, toPublicUser } from './user.schema';

export interface CreateUserInput {
  readonly email: string;
  readonly password: string;
  readonly name: string;
  readonly isAdmin?: boolean;
  readonly emailVerifiedAt?: Date | null;
}

/** Хешира с argon2id по `ARGON2_OPTIONS`. Имейлът се пази с малки букви. */
export async function createUser(
  executor: DbExecutor,
  input: CreateUserInput,
): Promise<PublicUser> {
  const created = await insert(executor, {
    email: input.email,
    passwordHash: await hashPassword(input.password),
    name: input.name,
    isAdmin: input.isAdmin ?? false,
    emailVerifiedAt: input.emailVerifiedAt ?? null,
  });
  return toPublicUser(created);
}

export async function findUserByEmail(
  executor: DbExecutor,
  email: string,
): Promise<PublicUser | null> {
  const user = await findByEmailWithHash(executor, email);
  return user === null ? null : toPublicUser(user);
}

export type ChangePasswordResult = 'ok' | 'wrong_current' | 'not_found';

/**
 * Проверява текущата парола срещу хеша и записва нов. Без примамка: човекът
 * е влязъл — няма какво да се крие. Без транзакция — един запис.
 */
export async function changePassword(
  executor: DbExecutor,
  userId: string,
  input: ChangePasswordInput,
): Promise<ChangePasswordResult> {
  const { currentPassword, newPassword } =
    changePasswordInputSchema.parse(input);

  const user = await findById(executor, userId);
  if (user === null) return 'not_found';

  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    return 'wrong_current';
  }

  const updated = await updatePasswordHash(
    executor,
    userId,
    await hashPassword(newPassword),
  );
  return updated ? 'ok' : 'not_found';
}
