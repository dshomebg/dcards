import { redirect } from 'next/navigation';

import { getCurrentUser, type SessionUser } from '@/modules/auth';
import { db } from '@/modules/core';
import {
  findPersonalOrganizationByOwner,
  type Organization,
} from '@/modules/platform';

export interface Current {
  readonly user: SessionUser;
  readonly org: Organization;
}

/** Сесия + лична org, или `null` без сесия — за публични страници като `/c/{id}`. */
export async function loadCurrent(): Promise<Current | null> {
  const user = await getCurrentUser();
  if (user === null) return null;

  const org = await findPersonalOrganizationByOwner(db, user.id);
  // Регистрацията и seed-ът я създават в една транзакция с потребителя.
  if (org === null) {
    throw new Error(`user ${user.id} has no personal organization`);
  }
  return { user, org };
}

/**
 * Пазачът на `/app`: всяка страница и action го вика сама — layout-ът не се
 * изпълнява при мека навигация. Без сесия → `/login`. `orgId` идва оттук,
 * никога от формата (AUTH-2).
 */
export async function requireCurrent(): Promise<Current> {
  return (await loadCurrent()) ?? redirect('/login');
}
