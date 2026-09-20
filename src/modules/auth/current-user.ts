import { db } from '@/modules/core';

import type { SessionUser } from './schema';
import { readSession, revokeSession } from './session';
import { findById } from './user.repository';
import { type PublicUser, toPublicUser, type User } from './user.schema';

export interface CurrentRow {
  readonly session: SessionUser;
  readonly user: User;
}

/**
 * Общият път на `getCurrentUser` и `getCurrentAdmin`: сесия → ред по PK.
 * Изчезнал ред отменя ключа (сесията е плъзгаща — иначе не спира нищо);
 * паднала база дава `null` и пази сесията за после.
 */
export async function loadCurrentRow(): Promise<CurrentRow | null> {
  const session = await readSession();
  if (session === null) return null;

  let user: User | null;
  try {
    user = await findById(db, session.id);
  } catch {
    return null;
  }

  if (user === null) {
    // Само ключът: layout-ът е Server Component и не може да трие cookie.
    try {
      await revokeSession();
    } catch {
      // Redis недостъпен — ключът бездруго не се чете; резултатът е същият.
    }
    return null;
  }
  return { session, user };
}

/** Влезлият потребител (админ или не) от сесията, сверен с реда в `users`. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const current = await loadCurrentRow();
  return current?.session ?? null;
}

/** Публичният ред (с `emailVerifiedAt`) — за екрани, на които сесията не стига. */
export async function getCurrentPublicUser(): Promise<PublicUser | null> {
  const current = await loadCurrentRow();
  return current === null ? null : toPublicUser(current.user);
}
