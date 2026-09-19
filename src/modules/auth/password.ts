import { argon2id, hash as argonHash, verify as argonVerify } from 'argon2';

/**
 * Параметрите на argon2id — ЗАКРЕПЕНИ, не подразбирането на библиотеката (OWASP:
 * m=64 MiB, t=3, p=4). `verify` следва параметрите в самия хеш, тоест ъпгрейд на
 * `argon2` би разминал примамката от истинските хешове и би върнал времевия оракул.
 */
export const ARGON2_OPTIONS = {
  type: argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
} as const;

export function hashPassword(password: string): Promise<string> {
  return argonHash(password, ARGON2_OPTIONS);
}

export function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  return argonVerify(passwordHash, password);
}
