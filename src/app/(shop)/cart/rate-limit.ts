import { headers } from 'next/headers';

import {
  clientIpFrom,
  RATE_POLICY,
  rateKey,
  rateLimit,
  tooManyMessage,
} from '@/modules/core';

/** Действията с количката са без auth — таван по IP; `null` = минава. */
export async function cartActionLimit(): Promise<string | null> {
  const ip = clientIpFrom(await headers());
  const { limit, windowSec } = RATE_POLICY.cartIp;
  const result = await rateLimit.consume(rateKey.cartIp(ip), limit, windowSec);
  return result.allowed ? null : tooManyMessage(result.retryAfterSec);
}

/** Издаване на НОВА количка (нов ключ в Redis) — строг таван, срещу пълнене на паметта. */
export async function newCartLimit(): Promise<string | null> {
  const ip = clientIpFrom(await headers());
  const { limit, windowSec } = RATE_POLICY.cartNewIp;
  const result = await rateLimit.consume(
    rateKey.cartNewIp(ip),
    limit,
    windowSec,
  );
  return result.allowed ? null : tooManyMessage(result.retryAfterSec);
}
