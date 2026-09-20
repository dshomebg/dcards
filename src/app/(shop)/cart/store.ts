// Количката живее в Redis с id в cookie (10 реда × персонализация не се събират
// в 4 KB cookie). Загубен Redis = празна количка (ARC-3). Цени не се пазят тук.
import 'server-only';

import { randomBytes } from 'node:crypto';

import { cookies } from 'next/headers';

import { env, redis } from '@/modules/core';
import { type Cart, emptyCart, parseCart } from '@/modules/shop';

/** ЕДНОТО число за TTL в Redis и `maxAge` на cookie-то. */
const CART_TTL_SECONDS = 60 * 60 * 24 * 7;

const COOKIE_NAME = 'cart';

// 32 байта base64url са точно 43 знака — друго в cookie-то не стига до Redis.
const ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const keyOf = (id: string) => `cart:${id}`;

async function cookieId(): Promise<string | null> {
  const store = await cookies();
  const id = store.get(COOKIE_NAME)?.value;
  return id !== undefined && ID_PATTERN.test(id) ? id : null;
}

/** Никога не хвърля: без cookie, без ключ или паднал Redis → празна. */
export async function readCart(): Promise<Cart> {
  try {
    const id = await cookieId();
    if (id === null) return emptyCart();
    const raw = await redis.get(keyOf(id));
    if (raw === null) return emptyCart();
    return parseCart(JSON.parse(raw));
  } catch {
    return emptyCart();
  }
}

/** Празна количка трие ключа и cookie-то; иначе cookie-то се издава при първи запис. */
export async function hasCartCookie(): Promise<boolean> {
  return (await cookieId()) !== null;
}

export async function writeCart(cart: Cart): Promise<void> {
  const store = await cookies();
  const existing = await cookieId();

  if (cart.items.length === 0) {
    if (existing !== null) await redis.del(keyOf(existing));
    store.delete(COOKIE_NAME);
    return;
  }

  // Id-то е непредвидимо само по себе си — без подпис, както при сесията.
  const id = existing ?? randomBytes(32).toString('base64url');
  await redis.set(keyOf(id), JSON.stringify(cart), 'EX', CART_TTL_SECONDS);
  // Преиздава се при всеки запис, за да върви с TTL-а в Redis — иначе cookie-то
  // умира 7 дни след ПЪРВОТО добавяне, докато количката е пипана вчера.
  store.set(COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: env().NODE_ENV === 'production',
    maxAge: CART_TTL_SECONDS,
  });
}

const LOCK_TTL_SECONDS = 60;

const lockKeyOf = (id: string) => `checkout-lock:${id}`;

/**
 * Два таба или двоен submit четат една количка преди тя да е изпразнена и
 * правят две поръчки. `false` = вече се обработва. Без cookie няма какво да пазим.
 */
export async function acquireCheckoutLock(): Promise<boolean> {
  const id = await cookieId();
  if (id === null) return true;
  const set = await redis.set(lockKeyOf(id), '1', 'EX', LOCK_TTL_SECONDS, 'NX');
  return set === 'OK';
}

/** При отказ на поръчката — иначе клиентът чака минута за втори опит. */
export async function releaseCheckoutLock(): Promise<void> {
  const id = await cookieId();
  if (id !== null) await redis.del(lockKeyOf(id));
}
