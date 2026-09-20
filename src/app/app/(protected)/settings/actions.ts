'use server';

import { DrizzleQueryError } from 'drizzle-orm';

import {
  changePassword,
  type ChangePasswordResult,
  revokeOtherSessions,
} from '@/modules/auth';
import { db } from '@/modules/core';

import { requireCurrent } from '../current';
import { passwordChangeLimit, userActionLimit } from '../rate-limit';
import { changePasswordFormSchema } from './schema';

export type ChangePasswordOutcome =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

const failure = (message: string): ChangePasswordOutcome => ({
  ok: false,
  message,
});

const MESSAGES: Record<Exclude<ChangePasswordResult, 'ok'>, string> = {
  wrong_current: 'Текущата парола не е вярна.',
  not_found: 'Акаунтът не е намерен — влез отново.',
};

/** Смяна на парола за влезлия. Не хвърля към клиента; входът не се логва. */
export async function changePasswordAction(
  input: unknown,
): Promise<ChangePasswordOutcome> {
  const parsed = changePasswordFormSchema.safeParse(input);
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? 'Невалидни данни.');
  }

  // `redirect` при липсваща сесия хвърля — затова е извън `try`.
  const { user } = await requireCurrent();
  const limited =
    (await userActionLimit(user.id)) ?? (await passwordChangeLimit(user.id));
  if (limited !== null) return failure(limited);

  let result: ChangePasswordResult;
  try {
    result = await changePassword(db, user.id, parsed.data);
  } catch (error) {
    // Drizzle носи параметрите на заявката (хеша) в `message` — само `cause` (DAT-6).
    console.error(
      'changePasswordAction:',
      error instanceof DrizzleQueryError ? error.cause : error,
    );
    return failure('Паролата не беше сменена — опитай пак след малко.');
  }
  if (result !== 'ok') return failure(MESSAGES[result]);

  // Паролата вече е сменена — паднал Redis тук не бива да я „връща" като грешка.
  try {
    await revokeOtherSessions(user.id);
  } catch (error) {
    console.error('changePasswordAction: revokeOtherSessions:', error);
  }
  return { ok: true };
}
