// Пазач срещу внасяне от клиентски компонент — грешката става ясна при строене.
import 'server-only';

import { randomBytes } from 'node:crypto';

import { cookies } from 'next/headers';

import { env, redis } from '@/modules/core';

import type { SessionUser } from './schema';

/**
 * Срокът на сесията — ЕДНОТО число, от което се четат TTL-ът в Redis и
 * `maxAge` на cookie-то (AUTH-4 в `decisions.md`). Плъзгащ: всяко четене го
 * подновява в Redis; cookie-то се издава веднъж, при вход.
 */
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

const COOKIE_NAME = 'session';

const keyOf = (id: string) => `session:${id}`;

// Индекс на сесиите по потребител (Redis set) — за прекратяване на другите.
const userKeyOf = (userId: string) => `user-sessions:${userId}`;

export async function createSession(user: SessionUser): Promise<void> {
  // 32 случайни байта — id-то е непредвидимо само по себе си, без подпис.
  const id = randomBytes(32).toString('base64url');
  const store = await cookies();

  // Повторен вход в същия браузър не оставя сирак — „Изход" трябва да затваря всичко.
  const previous = store.get(COOKIE_NAME)?.value;
  if (previous !== undefined) await redis.del(keyOf(previous));

  await redis.set(keyOf(id), JSON.stringify(user), 'EX', SESSION_TTL_SECONDS);
  await redis.sadd(userKeyOf(user.id), id);
  await redis.expire(userKeyOf(user.id), SESSION_TTL_SECONDS);

  store.set(COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: env().NODE_ENV === 'production',
    maxAge: SESSION_TTL_SECONDS,
  });
}

/** `null` и при липсваща cookie, и при недостъпен Redis — загубен Redis = изход. */
export async function readSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const id = store.get(COOKIE_NAME)?.value;
  if (id === undefined) return null;

  try {
    const raw = await redis.get(keyOf(id));
    if (raw === null) return null;

    await redis.expire(keyOf(id), SESSION_TTL_SECONDS);
    const user = JSON.parse(raw) as SessionUser;
    // Плъзга и индекса — иначе множеството изтича 7 дни след входа.
    await redis.expire(userKeyOf(user.id), SESSION_TTL_SECONDS);
    return user;
  } catch {
    return null;
  }
}

/**
 * Трие всички сесии на потребителя освен текущата (от cookie-то). Сесии отпреди
 * индекса не са в множеството — изтичат сами. Застояло id в set-а е безвредно.
 */
export async function revokeOtherSessions(userId: string): Promise<void> {
  const store = await cookies();
  const current = store.get(COOKIE_NAME)?.value;
  const userKey = userKeyOf(userId);

  const others = (await redis.smembers(userKey)).filter((id) => id !== current);
  if (others.length === 0) return;

  await redis.del(...others.map(keyOf));
  await redis.srem(userKey, ...others);
}

/**
 * Само ключът в Redis — за Server Component, който не може да пипа cookie-та.
 * Cookie-то остава, но е мъртво: `readSession` не намира ключ и връща `null`.
 */
export async function revokeSession(): Promise<void> {
  const store = await cookies();
  const id = store.get(COOKIE_NAME)?.value;
  if (id !== undefined) await redis.del(keyOf(id));
}

/**
 * Ключът пада ПРЕДИ cookie-то: върната ръчно стара cookie не отваря нищо.
 * Не успее ли изтриването (паднал Redis), cookie-то ОСТАВА и се връща `false`
 * — иначе сесията оживява, щом Redis се върне, а човекът мисли, че е излязъл.
 */
export async function destroySession(): Promise<boolean> {
  const store = await cookies();
  const id = store.get(COOKIE_NAME)?.value;

  if (id !== undefined) {
    try {
      await redis.del(keyOf(id));
    } catch {
      return false;
    }
  }

  store.delete(COOKIE_NAME);
  return true;
}
