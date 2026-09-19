import { db } from '@/modules/core';

import type { Admin } from './schema';
import { readSession, revokeSession } from './session';
import { findById } from './user.repository';

/**
 * Влезлият админ или `null` — при липсваща сесия, недостъпен Redis И когато
 * редът в `users` вече не е админ: сесията е плъзгаща и без тази сверка
 * свалянето на `is_admin` не би прекратило нищо. Една заявка по PK на заявка.
 */
export async function getCurrentAdmin(): Promise<Admin | null> {
  const session = await readSession();
  if (session === null) return null;

  let stillAdmin: boolean;
  try {
    const user = await findById(db, session.id);
    stillAdmin = user !== null && user.isAdmin;
  } catch {
    // Паднала база = никой не е админ в момента; сесията остава за после.
    return null;
  }

  if (!stillAdmin) {
    // Само ключът: layout-ът е Server Component и не може да трие cookie.
    try {
      await revokeSession();
    } catch {
      // Redis недостъпен — ключът бездруго не се чете; резултатът е същият.
    }
    return null;
  }
  return session;
}
