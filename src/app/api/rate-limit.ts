import { clientIpFrom, RATE_POLICY, rateKey, rateLimit } from '@/modules/core';

type Bucket = 'apiIp' | 'uploadsIp';

/** IP bucket за публичните handlers; `429` с `Retry-After` или `null`. */
export async function publicApiLimit(
  req: Request,
  bucket: Bucket = 'apiIp',
): Promise<Response | null> {
  const { limit, windowSec } = RATE_POLICY[bucket];
  const result = await rateLimit.consume(
    rateKey[bucket](clientIpFrom(req.headers)),
    limit,
    windowSec,
  );
  if (result.allowed) return null;

  return new Response('Too many requests', {
    status: 429,
    headers: {
      'Retry-After': String(result.retryAfterSec),
      'Cache-Control': 'no-store',
    },
  });
}
