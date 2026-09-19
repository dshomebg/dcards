import { randomBytes } from 'node:crypto';

import { db } from '@/modules/core';

import { hashPassword, verifyPassword } from './password';
import type { SessionUser } from './schema';
import { findByEmailWithHash } from './user.repository';
import type { User } from './user.schema';

export interface AccountRecord extends SessionUser {
  readonly passwordHash: string;
}

export type AdminRecord = AccountRecord;

/**
 * Примамка за непознат имейл: сверява се срещу хеш на случайна парола, за да
 * струва колкото истинската проверка. Иначе времето на отговора издава кой
 * имейл е админският, макар текстът да е един и същ.
 */
let decoyHash: Promise<string> | undefined;

export function decoyPasswordHash(): Promise<string> {
  decoyHash ??= hashPassword(randomBytes(32).toString('base64url')).catch(
    (error: unknown) => {
      decoyHash = undefined;
      throw error;
    },
  );
  return decoyHash;
}

// Изброено изрично: хешът е за входа, всичко друго от реда остава тук.
function toAccountRecord(user: User): AccountRecord {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    passwordHash: user.passwordHash,
  };
}

/** Всеки акаунт по имейл — за клиентския вход; ролята не се гледа. */
export async function findAccountByEmail(
  email: string,
): Promise<AccountRecord | null> {
  const user = await findByEmailWithHash(db, email);
  return user === null ? null : toAccountRecord(user);
}

/**
 * Единственото място, което знае откъде идва админът. Не-админът връща `null`
 * като непознат имейл — минава по същия път, с примамката и същото съобщение.
 */
export async function findAdminByEmail(
  email: string,
): Promise<AdminRecord | null> {
  const user = await findByEmailWithHash(db, email);
  if (user === null || !user.isAdmin) return null;
  return toAccountRecord(user);
}

export { verifyPassword };
