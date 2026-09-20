'use server';

import { DrizzleQueryError } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { setCurrentOrgId } from '@/app/app/(protected)/current-org';
import { userActionLimit } from '@/app/app/(protected)/rate-limit';
import { getCurrentPublicUser } from '@/modules/auth';
import { db } from '@/modules/core';
import {
  acceptInvitation,
  type AcceptInvitationResult,
} from '@/modules/platform';

import { inviteRouteLimited } from './rate-limit';

export interface AcceptFailure {
  readonly ok: false;
  readonly message: string;
}

const failure = (message: string): AcceptFailure => ({ ok: false, message });

const MESSAGES: Record<
  Exclude<AcceptInvitationResult['status'], 'accepted' | 'already_member'>,
  string
> = {
  invalid: 'Поканата е невалидна, изтекла или отменена.',
  email_mismatch: 'Поканата е за друг имейл адрес.',
  plan_limit: 'Организацията е достигнала лимита си за членове.',
};

// Съвпадението на имейла доказва нещо само ако адресът е потвърден (AUTH-12).
const UNVERIFIED =
  'Първо потвърди имейла си от писмото, после отвори линка отново.';

/**
 * „Приеми": единственото място, което променя нещо по токена (GET не пише).
 * Успех и „вече член" водят в org-а — cookie + `/app`. Токенът не се логва.
 */
export async function acceptInvitationAction(
  token: unknown,
): Promise<AcceptFailure> {
  if (await inviteRouteLimited(await headers())) {
    return failure('Твърде много опити. Опитай пак след малко.');
  }
  const user = await getCurrentPublicUser();
  if (user === null) return failure('Влез в акаунта си, за да приемеш.');
  if (user.emailVerifiedAt === null) return failure(UNVERIFIED);
  const limited = await userActionLimit(user.id);
  if (limited !== null) return failure(limited);

  let result: AcceptInvitationResult;
  try {
    result = await acceptInvitation(db, token, user);
  } catch (error) {
    console.error(
      'acceptInvitationAction:',
      error instanceof DrizzleQueryError ? error.cause : error,
    );
    return failure('Поканата не беше приета — опитай пак след малко.');
  }
  if (!('orgId' in result)) return failure(MESSAGES[result.status]);

  // `redirect` хвърля — стои извън `try`.
  await setCurrentOrgId(result.orgId);
  redirect('/app');
}
