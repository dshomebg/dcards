// Fixed window върху Redis: `INCR` → `EXPIRE … NX` при първи опит → `TTL` при
// отказ. Три команди вместо Lua, за да се тества с фалшив store.

import type { Redis } from 'ioredis';

export type RateLimitStore = Pick<Redis, 'incr' | 'expire' | 'ttl'>;

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly retryAfterSec: number;
}

export interface RateLimiter {
  consume(
    key: string,
    limit: number,
    windowSec: number,
  ): Promise<RateLimitResult>;
}

const ALLOWED: RateLimitResult = { allowed: true, retryAfterSec: 0 };

// Таван на чакането: ioredis при паднал Redis прави retry с backoff (~6 s), а
// `/api/{qr,vcard}` се зареждат с всяка публична страница. Fail-open, но бързо.
const STORE_TIMEOUT_MS = 250;

function withTimeout<T>(work: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(`rate-limit store timed out after ${STORE_TIMEOUT_MS} ms`),
        ),
      STORE_TIMEOUT_MS,
    );
    work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

async function count(
  store: RateLimitStore,
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const hits = await store.incr(key);
  // `NX` при ВСЕКИ опит: прекъснат `EXPIRE` след първия `INCR` иначе оставя вечен
  // ключ и заключва имейла до ръчно изтриване. Една евтина команда повече.
  await store.expire(key, windowSec, 'NX');
  if (hits <= limit) return ALLOWED;

  const ttl = await store.ttl(key);
  return { allowed: false, retryAfterSec: ttl > 0 ? ttl : windowSec };
}

/** Fail-open: паднал Redis пуска заявката и логва — статуквото отпреди лимита. */
export function createLimiter(store: RateLimitStore): RateLimiter {
  return {
    async consume(key, limit, windowSec) {
      try {
        return await withTimeout(count(store, key, limit, windowSec));
      } catch (cause) {
        console.error('rate-limit: store unavailable', cause);
        return ALLOWED;
      }
    },
  };
}
