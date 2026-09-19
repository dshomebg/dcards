// Достъп до `profiles` и `profile_links` — единственият SQL за двете таблици.

import { and, asc, count, eq } from 'drizzle-orm';

import type { DbExecutor } from '@/modules/core';

import { type Organization, organizations } from './organization.schema';
import {
  type NewProfile,
  type NewProfileLink,
  type Profile,
  type ProfileLink,
  profileLinks,
  profiles,
} from './profile.schema';

/** Заключва реда на организацията до края на транзакцията (`FOR UPDATE`). */
export async function lockOrganization(
  executor: DbExecutor,
  orgId: string,
): Promise<Organization | null> {
  const rows = await executor
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .for('update');
  return rows[0] ?? null;
}

export async function countProfilesByOrg(
  executor: DbExecutor,
  orgId: string,
): Promise<number> {
  const rows = await executor
    .select({ total: count() })
    .from(profiles)
    .where(eq(profiles.orgId, orgId));
  return rows[0]?.total ?? 0;
}

export async function slugExists(
  executor: DbExecutor,
  slug: string,
): Promise<boolean> {
  const rows = await executor
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.slug, slug))
    .limit(1);
  return rows.length > 0;
}

export async function insertProfile(
  executor: DbExecutor,
  values: NewProfile,
): Promise<Profile> {
  const rows = await executor.insert(profiles).values(values).returning();
  const created = rows[0];
  if (created === undefined) throw new Error('insert profiles returned no row');
  return created;
}

export async function insertProfileLinks(
  executor: DbExecutor,
  values: readonly NewProfileLink[],
): Promise<ProfileLink[]> {
  if (values.length === 0) return [];
  return executor
    .insert(profileLinks)
    .values([...values])
    .returning();
}

export async function findProfileBySlug(
  executor: DbExecutor,
  slug: string,
): Promise<Profile | null> {
  const rows = await executor
    .select()
    .from(profiles)
    .where(eq(profiles.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

/** Всички профили на организацията по ред на създаване (`createdAt`, после `id`). */
export function findProfilesByOrg(
  executor: DbExecutor,
  orgId: string,
): Promise<Profile[]> {
  return executor
    .select()
    .from(profiles)
    .where(eq(profiles.orgId, orgId))
    .orderBy(asc(profiles.createdAt), asc(profiles.id));
}

/** Само видимите, по `sortOrder`, после `id` (uuidv7 — редът на създаване). */
export function findVisibleLinks(
  executor: DbExecutor,
  profileId: string,
): Promise<ProfileLink[]> {
  return executor
    .select()
    .from(profileLinks)
    .where(
      and(
        eq(profileLinks.profileId, profileId),
        eq(profileLinks.isVisible, true),
      ),
    )
    .orderBy(asc(profileLinks.sortOrder), asc(profileLinks.id));
}
