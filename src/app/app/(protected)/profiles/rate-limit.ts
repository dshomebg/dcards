import {
  RATE_POLICY,
  rateKey,
  rateLimit,
  tooManyMessage,
} from '@/modules/core';

/** Таван на действията на един потребител; `null` = минава. Никога не хвърля. */
export async function userActionLimit(userId: string): Promise<string | null> {
  const { limit, windowSec } = RATE_POLICY.actionUser;
  const result = await rateLimit.consume(
    rateKey.actionUser(userId),
    limit,
    windowSec,
  );
  return result.allowed ? null : tooManyMessage(result.retryAfterSec);
}
