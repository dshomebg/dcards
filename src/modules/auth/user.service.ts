// Потребители за другите модули: хешът се слага тук и не излиза оттук.

import type { DbExecutor } from '@/modules/core';

import { hashPassword } from './password';
import { findByEmailWithHash, insert } from './user.repository';
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
