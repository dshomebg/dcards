// Гостът вижда поръчката си през токен в cookie → Redis → номер. Един токен
// сочи един номер; нова поръчка го презаписва (старите остават в имейла, SHP-2c).
import 'server-only';

import { randomBytes } from 'node:crypto';

import { cookies } from 'next/headers';

import { env, redis } from '@/modules/core';

/** ЕДНОТО число за TTL в Redis и `maxAge` на cookie-то. */
const ORDER_VIEW_TTL_SECONDS = 60 * 60 * 24;

const COOKIE_NAME = 'order_view';

// 32 байта base64url са точно 43 знака — друго в cookie-то не стига до Redis.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const keyOf = (token: string) => `order-view:${token}`;

export async function issueOrderViewToken(number: string): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  await redis.set(keyOf(token), number, 'EX', ORDER_VIEW_TTL_SECONDS);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: env().NODE_ENV === 'production',
    maxAge: ORDER_VIEW_TTL_SECONDS,
  });
}

/** Никога не хвърля: без cookie, лош формат или паднал Redis → `null`. */
export async function readOrderViewNumber(): Promise<string | null> {
  try {
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    if (token === undefined || !TOKEN_PATTERN.test(token)) return null;
    return await redis.get(keyOf(token));
  } catch {
    return null;
  }
}

/** При изход: следващият на споделен браузър не бива да вижда чужда поръчка. */
export async function clearOrderView(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  store.delete(COOKIE_NAME);
  if (token !== undefined && TOKEN_PATTERN.test(token)) {
    await redis.del(keyOf(token));
  }
}
