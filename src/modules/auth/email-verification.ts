// Токенът за потвърждение на имейл живее в Redis: `email-verify:<token>` → userId
// и обратен индекс `email-verify-user:<userId>` → token, за да е жив само един.

import { randomBytes } from 'node:crypto';

import { redis } from '@/modules/core';

const VERIFY_TTL_SECONDS = 60 * 60 * 24;

// 32 байта base64url са точно 43 знака — друго не стига до Redis.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const keyOf = (token: string) => `email-verify:${token}`;

// ioredis закача `command.args` (ключ с токена) на грешката — логва се само името.
function logRedisFailure(where: string, error: unknown): void {
  console.error(`${where}:`, error instanceof Error ? error.name : 'error');
}
const userKeyOf = (userId: string) => `email-verify-user:${userId}`;

/** Нов токен; старият на същия потребител умира. Хвърля при паднал Redis. */
export async function issueVerificationToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');

  // `SET … GET` сменя индекса и връща стария токен атомарно — два едновременни
  // натискания не могат да оставят втори жив токен. Индексът е преди токена:
  // провал по средата оставя най-много сирак индекс, никога токен без индекс.
  const previous = await redis.set(
    userKeyOf(userId),
    token,
    'EX',
    VERIFY_TTL_SECONDS,
    'GET',
  );
  if (previous !== null) await redis.del(keyOf(previous));
  await redis.set(keyOf(token), userId, 'EX', VERIFY_TTL_SECONDS);
  return token;
}

/** Линкът за писмото или `null` при паднал Redis — писмото тръгва и без него. */
export async function issueVerificationUrl(
  userId: string,
  appUrl: string,
): Promise<string | null> {
  try {
    const token = await issueVerificationToken(userId);
    return `${appUrl}/verify-email?token=${token}`;
  } catch (error) {
    logRedisFailure('issueVerificationUrl', error);
    return null;
  }
}

/** Никога не хвърля: лош формат или паднал Redis → `null`. Не трие. */
export async function readVerificationToken(
  token: string,
): Promise<string | null> {
  if (!TOKEN_PATTERN.test(token)) return null;
  try {
    return await redis.get(keyOf(token));
  } catch {
    return null;
  }
}

/** Трие и двата ключа; паднал Redis тук не бива да отмени вече записаната дата. */
export async function consumeVerificationToken(
  token: string,
  userId: string,
): Promise<void> {
  try {
    await redis.del(keyOf(token), userKeyOf(userId));
  } catch (error) {
    logRedisFailure('consumeVerificationToken', error);
  }
}
