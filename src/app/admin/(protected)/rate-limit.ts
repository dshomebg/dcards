import { RATE_POLICY, rateKey, rateLimit } from '@/modules/core';

/**
 * Таван на действията на един админ — същата политика и ключ като за
 * потребител. Връща секундите до отпускане или `null` = минава. Никога не хвърля.
 */
export async function adminActionLimit(
  adminId: string,
): Promise<number | null> {
  const { limit, windowSec } = RATE_POLICY.actionUser;
  const result = await rateLimit.consume(
    rateKey.actionUser(adminId),
    limit,
    windowSec,
  );
  return result.allowed ? null : result.retryAfterSec;
}
