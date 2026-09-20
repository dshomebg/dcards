import { redirect } from 'next/navigation';

import { getCurrentUser, type SessionUser } from '@/modules/auth';
import { db } from '@/modules/core';
import {
  findMembership,
  findPersonalOrganizationByOwner,
  type Organization,
  type OrgMember,
} from '@/modules/platform';

import { readCurrentOrgId } from './current-org';

export interface Current {
  readonly user: SessionUser;
  readonly org: Organization;
  readonly role: OrgMember['role'];
}

/**
 * Сесия + текуща org (cookie, сверено с `org_members`) или личната с `owner`;
 * `null` без сесия — за публични страници като `/c/{id}`. Cookie към чужда
 * org не е грешка — пада тихо на личната.
 */
export async function loadCurrent(): Promise<Current | null> {
  const user = await getCurrentUser();
  if (user === null) return null;

  const wanted = await readCurrentOrgId();
  if (wanted !== null) {
    const membership = await findMembership(db, wanted, user.id);
    if (membership !== null) return { user, ...membership };
  }

  const org = await findPersonalOrganizationByOwner(db, user.id);
  // Регистрацията и seed-ът я създават в една транзакция с потребителя.
  if (org === null) {
    throw new Error(`user ${user.id} has no personal organization`);
  }
  return { user, org, role: 'owner' };
}

/**
 * Пазачът на `/app`: всяка страница и action го вика сама — layout-ът не се
 * изпълнява при мека навигация. Без сесия → `/login`. `orgId` идва оттук,
 * никога от формата (AUTH-2).
 */
export async function requireCurrent(): Promise<Current> {
  return (await loadCurrent()) ?? redirect('/login');
}

/** Само собственикът на текущата org; editor → `/app` (actions на `/app/org`). */
export async function requireOwner(): Promise<Current> {
  const current = await requireCurrent();
  return current.role === 'owner' ? current : redirect('/app');
}
