import {
  RATE_POLICY,
  rateKey,
  rateLimit,
  type RateLimitResult,
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

/** Смяна на парола: 5 опита/15 мин по потребител, брои се и успешният (AUTH-9). */
export async function passwordChangeLimit(
  userId: string,
): Promise<string | null> {
  const { limit, windowSec } = RATE_POLICY.passwordChangeUser;
  const result = await rateLimit.consume(
    rateKey.passwordChangeUser(userId),
    limit,
    windowSec,
  );
  return result.allowed ? null : tooManyMessage(result.retryAfterSec);
}

/** „Изпрати отново" за имейла: 3/час по потребител, брои се и успешното (AUTH-12). */
export async function verifyResendLimit(
  userId: string,
): Promise<string | null> {
  const { limit, windowSec } = RATE_POLICY.verifyResendUser;
  const result = await rateLimit.consume(
    rateKey.verifyResendUser(userId),
    limit,
    windowSec,
  );
  return result.allowed ? null : tooManyMessage(result.retryAfterSec);
}

/**
 * Claim с код: и по потребител, и по карта — брои се всеки опит, и успешният.
 * 5/час на карта прави 6-те цифри непреодолими (AUTH-9). `null` = минава.
 */
export async function claimLimit(
  userId: string,
  cardId: string,
): Promise<string | null> {
  const results: RateLimitResult[] = await Promise.all([
    rateLimit.consume(
      rateKey.claimUser(userId),
      RATE_POLICY.claimUser.limit,
      RATE_POLICY.claimUser.windowSec,
    ),
    rateLimit.consume(
      rateKey.claimCard(cardId),
      RATE_POLICY.claimCard.limit,
      RATE_POLICY.claimCard.windowSec,
    ),
  ]);
  const refused = results.filter((result) => !result.allowed);
  if (refused.length === 0) return null;
  return tooManyMessage(Math.max(...refused.map((r) => r.retryAfterSec)));
}

const UNAVAILABLE = 'Услугата е временно недостъпна — опитай пак след малко.';

/** Снимка/лого на профил: 20/час по потребител. Паднал Redis → отказ, не без таван. */
export async function imageUploadLimit(userId: string): Promise<string | null> {
  const { limit, windowSec } = RATE_POLICY.imageUploadUser;
  const result = await rateLimit.consume(
    rateKey.imageUploadUser(userId),
    limit,
    windowSec,
  );
  if (result.degraded === true) return UNAVAILABLE;
  return result.allowed ? null : tooManyMessage(result.retryAfterSec);
}

/** Покани: 10/час по org, брои се и „Изпрати пак" (ORG-1). `null` = минава. */
export async function inviteOrgLimit(orgId: string): Promise<string | null> {
  const { limit, windowSec } = RATE_POLICY.inviteOrg;
  const result = await rateLimit.consume(
    rateKey.inviteOrg(orgId),
    limit,
    windowSec,
  );
  return result.allowed ? null : tooManyMessage(result.retryAfterSec);
}
