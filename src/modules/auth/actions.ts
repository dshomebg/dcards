'use server';

import { redirect } from 'next/navigation';

import {
  decoyPasswordHash,
  findAdminByEmail,
  verifyPassword,
} from './admin-account';
import { type SignInInput, signInSchema } from './schema';
import { createSession, destroySession } from './session';

export interface SignInFailure {
  readonly ok: false;
  readonly message: string;
}

// Едно съобщение за непознат имейл, грешна парола и паднал Redis — входът не
// издава кой имейл съществува.
const REJECTED = 'Грешен имейл или парола.';

async function openSession(input: SignInInput): Promise<boolean> {
  const admin = await findAdminByEmail(input.email);

  // Проверката минава и за непознат имейл — срещу примамка — за да е еднакво
  // бавна; ранният изход тук е измерим оракул.
  const passwordHash = admin?.passwordHash ?? (await decoyPasswordHash());
  const valid = await verifyPassword(passwordHash, input.password);
  if (admin === null || !valid) return false;

  // В сесията влиза само публичното — хешът не напуска този файл.
  await createSession({ id: admin.id, email: admin.email, name: admin.name });
  return true;
}

/** Не хвърля — връща резултат; при успех сам пренасочва към таблото. */
export async function signIn(input: unknown): Promise<SignInFailure> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: REJECTED };

  let opened: boolean;
  try {
    opened = await openSession(parsed.data);
  } catch {
    opened = false;
  }

  // `redirect` хвърля — стои извън `try`, инак `catch` го глътва.
  if (opened) redirect('/admin');

  return { ok: false, message: REJECTED };
}

export interface SignOutFailure {
  readonly ok: false;
  readonly message: string;
}

/** При успех пренасочва; провалът се връща, не се преструва на изход. */
export async function signOut(): Promise<SignOutFailure> {
  let destroyed: boolean;
  try {
    destroyed = await destroySession();
  } catch {
    destroyed = false;
  }
  if (destroyed) redirect('/admin/login');

  return { ok: false, message: 'Изходът не мина — опитай пак след малко.' };
}
