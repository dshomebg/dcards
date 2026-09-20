import { headers } from 'next/headers';

import {
  clientIpFrom,
  RATE_POLICY,
  rateKey,
  rateLimit,
  type RateLimitResult,
  tooManyMessage,
} from '@/modules/core';

/**
 * Checkout без auth: по IP и по имейл, броят се и успешните. IP-то е първо —
 * при отказ имейлът не се брои, за да не блокира чужд имейл от един адрес.
 */
export async function checkoutLimit(email: string): Promise<string | null> {
  const ip = clientIpFrom(await headers());
  const byIp: RateLimitResult = await rateLimit.consume(
    rateKey.checkoutIp(ip),
    RATE_POLICY.checkoutIp.limit,
    RATE_POLICY.checkoutIp.windowSec,
  );
  if (!byIp.allowed) return tooManyMessage(byIp.retryAfterSec);

  const byEmail = await rateLimit.consume(
    rateKey.checkoutEmail(email),
    RATE_POLICY.checkoutEmail.limit,
    RATE_POLICY.checkoutEmail.windowSec,
  );
  return byEmail.allowed ? null : tooManyMessage(byEmail.retryAfterSec);
}
