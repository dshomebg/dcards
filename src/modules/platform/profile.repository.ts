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

// Редакторът: всяка заявка е с `orgId` И `id` — собствеността се проверява в
// самата заявка, не преди нея (IDOR).

export async function findProfileByOrgAndId(
  executor: DbExecutor,
  orgId: string,
  profileId: string,
): Promise<Profile | null> {
  const rows = await executor
    .select()
    .from(profiles)
    .where(and(eq(profiles.orgId, orgId), eq(profiles.id, profileId)))
    .limit(1);
  return rows[0] ?? null;
}

/** Всички линкове, и скритите — за редактора. Редът е като при видимите. */
export function findLinksByProfile(
  executor: DbExecutor,
  profileId: string,
): Promise<ProfileLink[]> {
  return executor
    .select()
    .from(profileLinks)
    .where(eq(profileLinks.profileId, profileId))
    .orderBy(asc(profileLinks.sortOrder), asc(profileLinks.id));
}

export type ProfileUpdate = Pick<
  NewProfile,
  | 'slug'
  | 'firstName'
  | 'lastName'
  | 'title'
  | 'company'
  | 'bio'
  | 'theme'
  | 'isPublic'
>;

/** `null` = няма такъв профил в тази организация. `updatedAt` идва от `$onUpdate`. */
export async function updateProfileByOrgAndId(
  executor: DbExecutor,
  orgId: string,
  profileId: string,
  values: ProfileUpdate,
): Promise<Profile | null> {
  const rows = await executor
    .update(profiles)
    .set(values)
    .where(and(eq(profiles.orgId, orgId), eq(profiles.id, profileId)))
    .returning();
  return rows[0] ?? null;
}

/**
 * Една заявка: проверка за собственост, заключване на реда до края на
 * транзакцията и bump на `updated_at`. `false` = няма такъв профил.
 */
export async function touchProfile(
  executor: DbExecutor,
  orgId: string,
  profileId: string,
): Promise<boolean> {
  const rows = await executor
    .update(profiles)
    // JS време, като `$onUpdate` — иначе DTO-то и базата се разминават в един запис.
    .set({ updatedAt: new Date() })
    .where(and(eq(profiles.orgId, orgId), eq(profiles.id, profileId)))
    .returning({ id: profiles.id });
  return rows.length > 0;
}

export async function deleteLinksByProfile(
  executor: DbExecutor,
  profileId: string,
): Promise<void> {
  await executor
    .delete(profileLinks)
    .where(eq(profileLinks.profileId, profileId));
}

/** `false` = няма такъв профил в тази организация. Линковете падат по cascade. */
export async function deleteProfileByOrgAndId(
  executor: DbExecutor,
  orgId: string,
  profileId: string,
): Promise<boolean> {
  const rows = await executor
    .delete(profiles)
    .where(and(eq(profiles.orgId, orgId), eq(profiles.id, profileId)))
    .returning({ id: profiles.id });
  return rows.length > 0;
}
