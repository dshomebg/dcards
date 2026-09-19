import { randomBytes } from 'node:crypto';

import { hash, verify } from 'argon2';

import { env } from '@/modules/core';

import type { Admin } from './schema';

export interface AdminRecord extends Admin {
  readonly passwordHash: string;
}

/**
 * Паролата от env се хешира ВЕДНЪЖ при първо ползване и се сверява като хеш —
 * същият път „намери акаунт → провери хеш", който етап 1 ще ползва с базата.
 */
let bootstrapHash: Promise<string> | undefined;

function bootstrapPasswordHash(password: string): Promise<string> {
  // Отхвърлен promise не се кешира — иначе един провал (OOM при хеширане)
  // оставя входа мъртъв до рестарт, без ред в лога.
  bootstrapHash ??= hash(password).catch((error: unknown) => {
    bootstrapHash = undefined;
    throw error;
  });
  return bootstrapHash;
}

/**
 * Примамка за непознат имейл: сверява се срещу хеш на случайна парола, за да
 * струва колкото истинската проверка. Иначе времето на отговора издава кой
 * имейл е админският, макар текстът да е един и същ.
 */
let decoyHash: Promise<string> | undefined;

export function decoyPasswordHash(): Promise<string> {
  decoyHash ??= hash(randomBytes(32).toString('base64url')).catch(
    (error: unknown) => {
      decoyHash = undefined;
      throw error;
    },
  );
  return decoyHash;
}

/**
 * Единственото място, което знае откъде идва акаунтът. Етап 1 го насочва към
 * таблицата `users` и маха двата env ключа — останалото не се пипа.
 */
export async function findAdminByEmail(
  email: string,
): Promise<AdminRecord | null> {
  const { ADMIN_BOOTSTRAP_EMAIL, ADMIN_BOOTSTRAP_PASSWORD } = env();
  if (ADMIN_BOOTSTRAP_EMAIL === undefined) return null;
  if (ADMIN_BOOTSTRAP_PASSWORD === undefined) return null;
  if (email.toLowerCase() !== ADMIN_BOOTSTRAP_EMAIL.toLowerCase()) return null;

  return {
    id: 'bootstrap',
    email: ADMIN_BOOTSTRAP_EMAIL,
    name: 'Администратор',
    passwordHash: await bootstrapPasswordHash(ADMIN_BOOTSTRAP_PASSWORD),
  };
}

export function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  return verify(passwordHash, password);
}
