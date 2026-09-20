// Текущата org живее в cookie `current_org`, не в сесията (ORG-1): cookie-то
// е подсказка, истината е `org_members` при всяка заявка (`loadCurrent`).

import { cookies } from 'next/headers';
import { z } from 'zod';

import { env } from '@/modules/core';

const COOKIE_NAME = 'current_org';

// Колкото сесията — по-дълга би надживяла входа, по-къса връща на личната org.
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/** `null` при липса, невалиден формат или извън заявка — никога не хвърля. */
export async function readCurrentOrgId(): Promise<string | null> {
  try {
    const store = await cookies();
    const parsed = z.uuid().safeParse(store.get(COOKIE_NAME)?.value);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Само от Server Action — Server Component не може да пише cookie. */
export async function setCurrentOrgId(orgId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, orgId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: env().NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

/** При изход: следващият на споделен браузър тръгва от личната си org. */
export async function clearCurrentOrgId(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
