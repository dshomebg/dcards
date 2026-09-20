'use server';

import { DrizzleQueryError } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { db } from '@/modules/core';

import type { SignInFailure, SignOutFailure } from './actions';
import {
  decoyPasswordHash,
  findAccountByEmail,
  verifyPassword,
} from './admin-account';
import { loginRateLimit, registerRateLimit } from './login-limit';
import { registerAccount, type RegisterResult } from './registration';
import { registerSchema, type SignInInput, signInSchema } from './schema';
import { createSession, destroySession } from './session';

export interface RegisterFailure {
  readonly ok: false;
  readonly message: string;
}

// Едно съобщение за непознат имейл, грешна парола и паднал Redis — входът не
// издава кой имейл съществува.
const REJECTED = 'Грешен имейл или парола.';

async function openSession(input: SignInInput): Promise<boolean> {
  const account = await findAccountByEmail(input.email);

  // Проверката минава и за непознат имейл — срещу примамка — за да е еднакво
  // бавна; ранният изход тук е измерим оракул.
  const passwordHash = account?.passwordHash ?? (await decoyPasswordHash());
  const valid = await verifyPassword(passwordHash, input.password);
  if (account === null || !valid) return false;

  // В сесията влиза само публичното — хешът не напуска този файл.
  await createSession({
    id: account.id,
    email: account.email,
    name: account.name,
  });
  return true;
}

/** Клиентски вход: не хвърля; при успех сам пренасочва към `/app`. */
export async function signInUser(input: unknown): Promise<SignInFailure> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: REJECTED };

  const limited = await loginRateLimit(parsed.data.email);
  if (limited !== null) return { ok: false, message: limited };

  let opened: boolean;
  try {
    opened = await openSession(parsed.data);
  } catch {
    opened = false;
  }

  // `redirect` хвърля — стои извън `try`, инак `catch` го глътва.
  if (opened) redirect('/app');

  return { ok: false, message: REJECTED };
}

/** При успех пренасочва към `/login`; провалът се връща (AUTH-4). */
export async function signOutUser(): Promise<SignOutFailure> {
  let destroyed: boolean;
  try {
    destroyed = await destroySession();
  } catch {
    destroyed = false;
  }
  if (destroyed) redirect('/login');

  return { ok: false, message: 'Изходът не мина — опитай пак след малко.' };
}

// Drizzle слага параметрите на заявката (хеша) в `message` — логва се `cause` (DAT-6).
function logCause(context: string, error: unknown): void {
  const cause = error instanceof DrizzleQueryError ? error.cause : error;
  console.error(`${context}:`, cause);
}

/** Регистрация: създава акаунт и org, отваря сесия и пренасочва към `/app`. */
export async function register(input: unknown): Promise<RegisterFailure> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Невалидни данни.';
    return { ok: false, message };
  }

  const limited = await registerRateLimit();
  if (limited !== null) return { ok: false, message: limited };

  let result: RegisterResult;
  try {
    result = await registerAccount(db, parsed.data);
  } catch (error) {
    logCause('register', error);
    return {
      ok: false,
      message: 'Регистрацията не мина — опитай пак след малко.',
    };
  }
  if (result.status === 'email_taken') {
    return { ok: false, message: 'Този имейл вече е регистриран.' };
  }

  let opened: boolean;
  try {
    await createSession({
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
    });
    opened = true;
  } catch {
    opened = false;
  }
  if (opened) redirect('/app');

  return {
    ok: false,
    message: 'Акаунтът е създаден, но входът не мина — влез от /login.',
  };
}
