// Четене за редактора, запис, смяна на линковете и изтриване на профил. Всяка
// операция носи `orgId` И `id` — чужд и несъществуващ профил са неразличими.

import type { z } from 'zod';

import type { DbExecutor } from '@/modules/core';

import { can } from './plan';
import {
  type DeletedProfileKeys,
  deleteLinksByProfile,
  deleteProfileByOrgAndId,
  findLinksByProfile,
  findProfileByOrgAndId,
  insertProfileLinks,
  lockOrganization,
  replaceProfileImageKey,
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
  updateProfileInputSchema,
} from './profile.service';
import { mergeThemeForPlan, safeTheme } from './profile-theme';

export interface ProfileEditLinkDto {
  readonly id: string;
  readonly type: ProfileLinkType;
  readonly label: string | null;
  readonly value: string;
  readonly isVisible: boolean;
  readonly sortOrder: number;
}

/** Каквото вижда редакторът — изрични полета (DAT-7). */
export interface ProfileEditDto {
  readonly id: string;
  readonly slug: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly title: string | null;
  readonly company: string | null;
  readonly bio: string | null;
  readonly photoKey: string | null;
  readonly logoKey: string | null;
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
    photoKey: profile.photoKey,
    logoKey: profile.logoKey,
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

/** Темата за запис: Pro полетата минават само с активен Pro, иначе остават от реда. */
async function gatedTheme(
  executor: DbExecutor,
  orgId: string,
  profileId: string,
  input: ProfileTheme,
): Promise<ProfileTheme> {
  // `FOR UPDATE` на org-а: същият ред на заключване като `replaceProfileLinks`.
  const org = await lockOrganization(executor, orgId);
  if (org === null) throw new ProfileError('org_not_found');
  const current = await findProfileByOrgAndId(executor, orgId, profileId);
  if (current === null) throw new ProfileError('profile_not_found');
  return mergeThemeForPlan(org, input, safeTheme(current.theme));
}

/**
 * Без `slugExists`: уникалният индекс е проверката (няма TOCTOU). Редът се
 * чете само заради Pro полетата на темата. `updatedAt` идва от `$onUpdate`.
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

  return executor.transaction(async (tx) => {
    const theme = await gatedTheme(tx, orgId, profileId, parsed.data.theme);
    let updated: Profile | null;
    try {
      updated = await updateProfileByOrgAndId(tx, orgId, profileId, {
        slug: parsed.data.slug,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        title: parsed.data.title ?? null,
        company: parsed.data.company ?? null,
        bio: parsed.data.bio ?? null,
        theme,
        isPublic: parsed.data.isPublic,
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ProfileError('slug_taken');
      throw error;
    }
    if (updated === null) throw new ProfileError('profile_not_found');
    return toDto(updated, await findLinksByProfile(tx, profileId));
  });
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

export const PROFILE_IMAGE_KINDS = ['photo', 'logo'] as const;
export type ProfileImageKind = (typeof PROFILE_IMAGE_KINDS)[number];

export interface SetProfileImageInput {
  readonly orgId: string;
  readonly profileId: string;
  readonly kind: ProfileImageKind;
  /** `null` = „Премахни". */
  readonly key: string | null;
}

/**
 * Записва ключа и връща СТАРИЯ (или `null`), за да го изтрие извикващият
 * от диска чак след успешния запис. Чужд профил → `profile_not_found`.
 */
export async function setProfileImage(
  executor: DbExecutor,
  input: SetProfileImageInput,
): Promise<string | null> {
  const column = input.kind === 'photo' ? 'photoKey' : 'logoKey';
  const result = await replaceProfileImageKey(
    executor,
    { orgId: input.orgId, profileId: input.profileId },
    column,
    input.key,
  );
  if (result === null) throw new ProfileError('profile_not_found');
  return result.previousKey;
}

/**
 * Линковете падат по cascade. Чужд профил → `profile_not_found`, нищо не се трие.
 * Връща ключовете на снимка/лого — извикващият трие файловете (лице на диска).
 */
export async function deleteProfile(
  executor: DbExecutor,
  orgId: string,
  profileId: string,
): Promise<DeletedProfileKeys> {
  const keys = await deleteProfileByOrgAndId(executor, orgId, profileId);
  if (keys === null) throw new ProfileError('profile_not_found');
  return keys;
}
