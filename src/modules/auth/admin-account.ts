import { randomBytes } from 'node:crypto';

import { db } from '@/modules/core';

import { hashPassword, verifyPassword } from './password';
import type { Admin } from './schema';
import { findByEmailWithHash } from './user.repository';

export interface AdminRecord extends Admin {
  readonly passwordHash: string;
}

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

/**
 * Единственото място, което знае откъде идва акаунтът. Не-админът връща `null`
 * като непознат имейл — минава по същия път, с примамката и същото съобщение.
 */
export async function findAdminByEmail(
  email: string,
): Promise<AdminRecord | null> {
  const user = await findByEmailWithHash(db, email);
  if (user === null || !user.isAdmin) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    passwordHash: user.passwordHash,
  };
}

export { verifyPassword };
