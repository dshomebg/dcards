import { clientIpFrom, RATE_POLICY, rateKey, rateLimit } from '@/modules/core';

/** Публичният IP bucket на `/invite` — и за GET, и за „Приеми". `true` = отказ. */
export async function inviteRouteLimited(headers: Headers): Promise<boolean> {
  const { limit, windowSec } = RATE_POLICY.inviteIp;
  const result = await rateLimit.consume(
    rateKey.inviteIp(clientIpFrom(headers)),
    limit,
    windowSec,
  );
  return !result.allowed;
}
