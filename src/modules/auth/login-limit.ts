// Лимитът стои преди базата и argon2: отказаният опит не струва нищо и не
// издава дали имейлът съществува. Всеки опит се брои — и успешният (OPS-1).

import { headers } from 'next/headers';

import {
  clientIpFrom,
  RATE_POLICY,
  rateKey,
  rateLimit,
  type RateLimitResult,
  type RatePolicy,
  tooManyMessage,
} from '@/modules/core';

function consume(key: string, policy: RatePolicy): Promise<RateLimitResult> {
  return rateLimit.consume(key, policy.limit, policy.windowSec);
}

/** Най-дългото чакане измежду отказалите броячи; `null` когато всички пускат. */
function refusal(results: readonly RateLimitResult[]): string | null {
  const refused = results.filter((result) => !result.allowed);
  if (refused.length === 0) return null;
  return tooManyMessage(Math.max(...refused.map((r) => r.retryAfterSec)));
}

/**
 * Вход (админ и клиент делят броячите — същите акаунти, AUTH-7). IP-то се брои
 * ПЪРВО и спира останалите: отказан IP не създава ключове по произволни имейли.
 */
export async function loginRateLimit(email: string): Promise<string | null> {
  const ip = clientIpFrom(await headers());
  const byIp = await consume(rateKey.loginIp(ip), RATE_POLICY.loginIp);
  if (!byIp.allowed) return refusal([byIp]);

  const results = await Promise.all([
    consume(rateKey.loginEmailIp(email, ip), RATE_POLICY.loginEmailIp),
    consume(rateKey.loginEmail(email), RATE_POLICY.loginEmail),
  ]);
  return refusal(results);
}

/** Регистрация: само по IP — имейлът още не е ничий. */
export async function registerRateLimit(): Promise<string | null> {
  const ip = clientIpFrom(await headers());
  return refusal([
    await consume(rateKey.registerIp(ip), RATE_POLICY.registerIp),
  ]);
}
