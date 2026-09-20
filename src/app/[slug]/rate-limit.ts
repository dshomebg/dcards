import { RATE_POLICY, rateKey, rateLimit } from '@/modules/core';

/**
 * Таван на записите в `scans` по профил — при превишаване страницата се вижда
 * без запис. Паднал Redis = без запис (fail-closed само за реда, не за страницата).
 */
export async function profileScanLimited(profileId: string): Promise<boolean> {
  const { limit, windowSec } = RATE_POLICY.scanProfile;
  const result = await rateLimit.consume(
    rateKey.scanProfile(profileId),
    limit,
    windowSec,
  );
  return !result.allowed || result.degraded === true;
}
