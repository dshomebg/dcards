import { headers } from 'next/headers';

import {
  clientIpFrom,
  RATE_POLICY,
  rateKey,
  rateLimit,
  tooManyMessage,
} from '@/modules/core';

type IpPolicy = 'cartIp' | 'cartNewIp' | 'uploadIp';

const UNAVAILABLE = 'Услугата е временно недостъпна — опитай пак след малко.';

/** Гост без auth — таван по IP за избраната политика; `null` = минава. */
async function limitByIp(policy: IpPolicy): Promise<string | null> {
  const ip = clientIpFrom(await headers());
  const { limit, windowSec } = RATE_POLICY[policy];
  const result = await rateLimit.consume(rateKey[policy](ip), limit, windowSec);
  // Паднал Redis: количката и без това не работи; качването не бива да е без таван.
  if (result.degraded === true) return UNAVAILABLE;
  return result.allowed ? null : tooManyMessage(result.retryAfterSec);
}

/** Действията с количката са без auth — таван по IP. */
export const cartActionLimit = () => limitByIp('cartIp');

/** Издаване на НОВА количка (нов ключ в Redis) — строг таван, срещу пълнене на паметта. */
export const newCartLimit = () => limitByIp('cartNewIp');

/** Качване на лого — sharp и диск на всяко; строг таван по IP. */
export const uploadLimit = () => limitByIp('uploadIp');
