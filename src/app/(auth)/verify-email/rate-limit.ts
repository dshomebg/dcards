import { clientIpFrom, RATE_POLICY, rateKey, rateLimit } from '@/modules/core';

/** Публичният IP bucket на `/verify-email` — същият като на `/api/*`. `true` = отказ. */
export async function verifyRouteLimited(headers: Headers): Promise<boolean> {
  const { limit, windowSec } = RATE_POLICY.apiIp;
  const result = await rateLimit.consume(
    rateKey.apiIp(clientIpFrom(headers)),
    limit,
    windowSec,
  );
  return !result.allowed;
}
