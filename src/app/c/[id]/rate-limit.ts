import { clientIpFrom, RATE_POLICY, rateKey, rateLimit } from '@/modules/core';

/** Публичният IP bucket на `/c/{id}` — същият като на `/api/*`. `true` = отказ. */
export async function cardRouteLimited(headers: Headers): Promise<boolean> {
  const { limit, windowSec } = RATE_POLICY.apiIp;
  const result = await rateLimit.consume(
    rateKey.apiIp(clientIpFrom(headers)),
    limit,
    windowSec,
  );
  return !result.allowed;
}

/** Таван на записите в `scans` по карта — при превишаване се пренасочва без запис. */
export async function scanRecordLimited(cardId: string): Promise<boolean> {
  const { limit, windowSec } = RATE_POLICY.scanCard;
  const result = await rateLimit.consume(
    rateKey.scanCard(cardId),
    limit,
    windowSec,
  );
  return !result.allowed;
}
