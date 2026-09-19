// Пазач срещу внасяне от клиентски компонент — грешката става ясна при строене.
import 'server-only';

import { randomBytes } from 'node:crypto';

import { cookies } from 'next/headers';

import { env, redis } from '@/modules/core';

import type { Admin } from './schema';

/**
 * Срокът на сесията — ЕДНОТО число, от което се четат TTL-ът в Redis и
 * `maxAge` на cookie-то (AUTH-4 в `decisions.md`). Плъзгащ: всяко четене го
 * подновява в Redis; cookie-то се издава веднъж, при вход.
 */
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

const COOKIE_NAME = 'admin_session';

const keyOf = (id: string) => `session:${id}`;

export async function createSession(admin: Admin): Promise<void> {
  // 32 случайни байта — id-то е непредвидимо само по себе си, без подпис.
  const id = randomBytes(32).toString('base64url');

  await redis.set(keyOf(id), JSON.stringify(admin), 'EX', SESSION_TTL_SECONDS);

  const store = await cookies();
  store.set(COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: env().NODE_ENV === 'production',
    maxAge: SESSION_TTL_SECONDS,
  });
}

/** `null` и при липсваща cookie, и при недостъпен Redis — загубен Redis = изход. */
export async function readSession(): Promise<Admin | null> {
  const store = await cookies();
  const id = store.get(COOKIE_NAME)?.value;
  if (id === undefined) return null;

  try {
    const raw = await redis.get(keyOf(id));
    if (raw === null) return null;

    await redis.expire(keyOf(id), SESSION_TTL_SECONDS);
    return JSON.parse(raw) as Admin;
  } catch {
    return null;
  }
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
