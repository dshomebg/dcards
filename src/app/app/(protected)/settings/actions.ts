'use server';

import { DrizzleQueryError } from 'drizzle-orm';
import { after } from 'next/server';

import {
  changePassword,
  type ChangePasswordResult,
  findUserById,
  issueVerificationUrl,
  passwordChangedMail,
  type PublicUser,
  revokeOtherSessions,
  verifyEmailMail,
} from '@/modules/auth';
import { db, env, sendMail } from '@/modules/core';

import { requireCurrent } from '../current';
import {
  passwordChangeLimit,
  userActionLimit,
  verifyResendLimit,
} from '../rate-limit';
import { changePasswordFormSchema } from './schema';

export type ActionOutcome =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

const failure = (message: string): ActionOutcome => ({ ok: false, message });

const MESSAGES: Record<Exclude<ChangePasswordResult, 'ok'>, string> = {
  wrong_current: 'Текущата парола не е вярна.',
  not_found: 'Акаунтът не е намерен — влез отново.',
};

/** Смяна на парола за влезлия. Не хвърля към клиента; входът не се логва. */
export async function changePasswordAction(
  input: unknown,
): Promise<ActionOutcome> {
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
  // Известие след отговора; `sendMail` не хвърля и не носи паролата.
  after(() => {
    const { APP_NAME, APP_URL } = env();
    const mail = passwordChangedMail({ appName: APP_NAME, appUrl: APP_URL });
    return sendMail({ to: user.email, ...mail }).then(() => undefined);
  });
  return { ok: true };
}

/**
 * Ново писмо за потвърждение. Потвърденият не получава писмо — иначе бутонът е
 * безплатен канал за спам към собствения (или чужд, при грешка) адрес.
 */
export async function resendVerificationAction(): Promise<ActionOutcome> {
  const { user } = await requireCurrent();
  const limited =
    (await userActionLimit(user.id)) ?? (await verifyResendLimit(user.id));
  if (limited !== null) return failure(limited);

  let account: PublicUser | null;
  try {
    account = await findUserById(db, user.id);
  } catch (error) {
    console.error(
      'resendVerificationAction:',
      error instanceof DrizzleQueryError ? error.cause : error,
    );
    return failure('Писмото не беше изпратено — опитай пак след малко.');
  }
  if (account === null) return failure(MESSAGES.not_found);
  if (account.emailVerifiedAt !== null) {
    return failure('Имейлът вече е потвърден.');
  }

  const { APP_NAME, APP_URL } = env();
  const verifyUrl = await issueVerificationUrl(user.id, APP_URL);
  if (verifyUrl === null) {
    return failure('Писмото не беше изпратено — опитай пак след малко.');
  }

  after(() => {
    const mail = verifyEmailMail({ appName: APP_NAME, verifyUrl });
    return sendMail({ to: account.email, ...mail }).then(() => undefined);
  });
  return { ok: true };
}
