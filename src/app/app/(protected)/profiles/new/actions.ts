'use server';

import { DrizzleQueryError } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { db } from '@/modules/core';
import { createProfile, isOrgMember, ProfileError } from '@/modules/platform';

import { requireCurrent } from '../../current';
import { userActionLimit } from '../rate-limit';
import { newProfileSchema } from './schema';

export interface CreateProfileFailure {
  readonly ok: false;
  readonly message: string;
}

const failure = (message: string): CreateProfileFailure => ({
  ok: false,
  message,
});

/**
 * „Нов профил": org-ът е САМО от сървъра (`requireCurrent`) — подаден `orgId`
 * във входа се игнорира от схемата. Не хвърля към клиента; при успех пренасочва.
 */
export async function createProfileAction(
  input: unknown,
): Promise<CreateProfileFailure> {
  const parsed = newProfileSchema.safeParse(input);
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? 'Невалидни данни.');
  }

  // `redirect` при липсваща сесия хвърля — затова е извън `try`.
  const { user, org } = await requireCurrent();
  const limited = await userActionLimit(user.id);
  if (limited !== null) return failure(limited);

  try {
    if (!(await isOrgMember(db, org.id, user.id))) {
      return failure('Нямаш достъп до тази организация.');
    }
    // `orgId` последен: сървърът печели, дори схемата утре да пусне такова поле.
    await createProfile(db, { ...parsed.data, orgId: org.id });
  } catch (error) {
    if (error instanceof ProfileError) return failure(error.message);
    // Drizzle носи параметрите на заявката в `message` — само `cause` (DAT-6).
    console.error(
      'createProfileAction:',
      error instanceof DrizzleQueryError ? error.cause : error,
    );
    return failure('Профилът не беше създаден — опитай пак след малко.');
  }

  redirect('/app');
}
