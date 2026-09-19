// Четене за редактора, запис, смяна на линковете и изтриване на профил. Всяка
// операция носи `orgId` И `id` — чужд и несъществуващ профил са неразличими.

import type { z } from 'zod';

import type { DbExecutor } from '@/modules/core';

import { can } from './plan';
import {
  deleteLinksByProfile,
  deleteProfileByOrgAndId,
  findLinksByProfile,
  findProfileByOrgAndId,
  insertProfileLinks,
  lockOrganization,
  touchProfile,
  updateProfileByOrgAndId,
} from './profile.repository';
import type {
  Profile,
  ProfileLink,
  ProfileLinkType,
  ProfileTheme,
} from './profile.schema';
import {
  assertSlug,
  isUniqueViolation,
  ProfileError,
  profileLinksInputSchema,
  safeTheme,
  updateProfileInputSchema,
} from './profile.service';

export interface ProfileEditLinkDto {
  readonly id: string;
  readonly type: ProfileLinkType;
  readonly label: string | null;
  readonly value: string;
  readonly isVisible: boolean;
  readonly sortOrder: number;
}

/** Каквото вижда редакторът — изрични полета (DAT-7); без `photoKey`/`logoKey`. */
export interface ProfileEditDto {
  readonly id: string;
  readonly slug: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly title: string | null;
  readonly company: string | null;
  readonly bio: string | null;
  readonly theme: ProfileTheme;
  readonly isPublic: boolean;
  readonly updatedAt: Date;
  readonly links: readonly ProfileEditLinkDto[];
}

export type UpdateProfileInput = z.input<typeof updateProfileInputSchema>;
export type ProfileLinkInput = z.input<typeof profileLinksInputSchema>[number];

function toLinkDto(link: ProfileLink): ProfileEditLinkDto {
  return {
    id: link.id,
    type: link.type,
    label: link.label,
    value: link.value,
    isVisible: link.isVisible,
    sortOrder: link.sortOrder,
  };
}

function toDto(
  profile: Profile,
  links: readonly ProfileLink[],
): ProfileEditDto {
  return {
    id: profile.id,
    slug: profile.slug,
    firstName: profile.firstName,
    lastName: profile.lastName,
    title: profile.title,
    company: profile.company,
    bio: profile.bio,
    theme: safeTheme(profile.theme),
    isPublic: profile.isPublic,
    updatedAt: profile.updatedAt,
    links: links.map(toLinkDto),
  };
}

/** `null` и за чужд, и за несъществуващ профил. Линковете са всички, и скритите. */
export async function getProfileForEdit(
  executor: DbExecutor,
  orgId: string,
  profileId: string,
): Promise<ProfileEditDto | null> {
  const profile = await findProfileByOrgAndId(executor, orgId, profileId);
  if (profile === null) return null;
  return toDto(profile, await findLinksByProfile(executor, profileId));
}

/**
 * Без предварително четене и без `slugExists`: уникалният индекс е проверката
 * (няма TOCTOU). `updatedAt` идва от `$onUpdate`.
 */
export async function updateProfile(
  executor: DbExecutor,
  orgId: string,
  profileId: string,
  input: UpdateProfileInput,
): Promise<ProfileEditDto> {
  const parsed = updateProfileInputSchema.safeParse(input);
  if (!parsed.success) throw new ProfileError('input_invalid');
  assertSlug(parsed.data.slug);

  let updated: Profile | null;
  try {
    updated = await updateProfileByOrgAndId(executor, orgId, profileId, {
      slug: parsed.data.slug,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      title: parsed.data.title ?? null,
      company: parsed.data.company ?? null,
      bio: parsed.data.bio ?? null,
      theme: parsed.data.theme,
      isPublic: parsed.data.isPublic,
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new ProfileError('slug_taken');
    throw error;
  }
  if (updated === null) throw new ProfileError('profile_not_found');
  return toDto(updated, await findLinksByProfile(executor, profileId));
}

/**
 * Delete + insert, не diff: идентичността на линк няма външна стойност.
 * Организацията се заключва заради лимита, профилът — с `touchProfile`.
 */
export async function replaceProfileLinks(
  executor: DbExecutor,
  orgId: string,
  profileId: string,
  links: readonly ProfileLinkInput[],
): Promise<ProfileEditDto['links']> {
  const parsed = profileLinksInputSchema.safeParse(links);
  if (!parsed.success) throw new ProfileError('input_invalid');
  const items = parsed.data;

  return executor.transaction(async (tx) => {
    const org = await lockOrganization(tx, orgId);
    if (org === null) throw new ProfileError('org_not_found');
    if (!(await touchProfile(tx, orgId, profileId))) {
      throw new ProfileError('profile_not_found');
    }
    // Същата аритметика като при създаване: „може ли още един при n-1 заети".
    if (items.length > 0 && !can(org, 'links', items.length - 1)) {
      throw new ProfileError('plan_limit_links');
    }

    await deleteLinksByProfile(tx, profileId);
    const inserted = await insertProfileLinks(
      tx,
      items.map((link, sortOrder) => ({
        profileId,
        type: link.type,
        value: link.value,
        label: link.label ?? null,
        isVisible: link.isVisible ?? true,
        sortOrder,
      })),
    );
    // `returning` не обещава ред — подреждаме както ще ги чете редакторът.
    return inserted.map(toLinkDto).sort((a, b) => a.sortOrder - b.sortOrder);
  });
}

/** Линковете падат по cascade. Чужд профил → `profile_not_found`, нищо не се трие. */
export async function deleteProfile(
  executor: DbExecutor,
  orgId: string,
  profileId: string,
): Promise<void> {
  if (!(await deleteProfileByOrgAndId(executor, orgId, profileId))) {
    throw new ProfileError('profile_not_found');
  }
}
