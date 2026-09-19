// Създаване, списък и публично четене на профил. Редакция/изтриване — PLT-5.

import { DrizzleQueryError } from 'drizzle-orm';
import { z } from 'zod';

import type { DbExecutor } from '@/modules/core';

import type { Organization } from './organization.schema';
import { can } from './plan';
import {
  countProfilesByOrg,
  findProfileBySlug,
  findProfilesByOrg,
  findVisibleLinks,
  insertProfile,
  insertProfileLinks,
  lockOrganization,
  slugExists,
} from './profile.repository';
import {
  type Profile,
  PROFILE_LINK_TYPES,
  type ProfileLinkType,
  type ProfileTheme,
  type PublicProfile,
} from './profile.schema';
import { isReservedSlug, slugSchema } from './slug';

export type ProfileErrorCode =
  | 'input_invalid'
  | 'slug_invalid'
  | 'slug_reserved'
  | 'slug_taken'
  | 'plan_limit_profiles'
  | 'plan_limit_links'
  | 'org_not_found';

const MESSAGES: Readonly<Record<ProfileErrorCode, string>> = {
  input_invalid: 'Има невалидни или твърде дълги полета в профила.',
  slug_invalid:
    'Адресът може да съдържа само малки латински букви, цифри и тире (3–30 знака).',
  slug_reserved: 'Този адрес е запазен от платформата.',
  slug_taken: 'Този адрес вече е зает.',
  plan_limit_profiles: 'Планът Free позволява един профил.',
  plan_limit_links: 'Планът Free позволява до 6 линка.',
  org_not_found: 'Организацията не съществува.',
};

/** `code` е за тестовете и редактора (PLT-5); `message` е за човека. */
export class ProfileError extends Error {
  constructor(readonly code: ProfileErrorCode) {
    super(MESSAGES[code]);
    this.name = 'ProfileError';
  }
}

export interface CreateProfileLinkInput {
  readonly type: ProfileLinkType;
  readonly value: string;
  readonly label?: string | null;
  readonly isVisible?: boolean;
}

export interface CreateProfileInput {
  readonly orgId: string;
  readonly slug: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly title?: string | null;
  readonly company?: string | null;
  readonly bio?: string | null;
  readonly theme?: ProfileTheme;
  readonly isPublic?: boolean;
  readonly links?: readonly CreateProfileLinkInput[];
}

const DEFAULT_THEME: ProfileTheme = {
  preset: 'light',
  primaryColor: null,
  layout: 'default',
};

// Границите пазят публичната страница от неограничен HTML; сервизът се пази
// сам, не чака извикващият (PLT-5) да валидира.
const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => text(max).nullish();

export const profileThemeSchema = z.object({
  preset: z.enum(['light', 'dark', 'sand']),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .nullable(),
  layout: z.literal('default'),
});

export const createProfileInputSchema = z.object({
  orgId: z.uuid(),
  slug: z.string(),
  firstName: text(80).min(1),
  lastName: text(80).min(1),
  title: optionalText(120),
  company: optionalText(120),
  bio: optionalText(600),
  theme: profileThemeSchema.optional(),
  isPublic: z.boolean().optional(),
  links: z
    .array(
      z.object({
        type: z.enum(PROFILE_LINK_TYPES),
        value: text(500).min(1),
        label: optionalText(60),
        isVisible: z.boolean().optional(),
      }),
    )
    .max(50)
    .optional(),
});

/** Лош ред в базата (през studio) не бива да дава 500 на публичната страница. */
function safeTheme(raw: unknown): ProfileTheme {
  const parsed = profileThemeSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_THEME;
}

function assertSlug(slug: string): void {
  if (!slugSchema.safeParse(slug).success) {
    throw new ProfileError('slug_invalid');
  }
  if (isReservedSlug(slug)) throw new ProfileError('slug_reserved');
}

function assertLimits(
  org: Organization,
  usedProfiles: number,
  linksCount: number,
): void {
  if (!can(org, 'profiles', usedProfiles)) {
    throw new ProfileError('plan_limit_profiles');
  }
  if (linksCount > 0 && !can(org, 'links', linksCount - 1)) {
    throw new ProfileError('plan_limit_links');
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof DrizzleQueryError &&
    (error.cause as { code?: string } | undefined)?.code === '23505'
  );
}

/**
 * Профил плюс линкове в една транзакция. Организацията се заключва
 * (`FOR UPDATE`), за да не прескочат Free лимита две паралелни създавания.
 */
export async function createProfile(
  executor: DbExecutor,
  input: CreateProfileInput,
): Promise<Profile> {
  const parsed = createProfileInputSchema.safeParse(input);
  if (!parsed.success) throw new ProfileError('input_invalid');
  assertSlug(input.slug);
  const links = parsed.data.links ?? [];

  return executor.transaction(async (tx) => {
    const org = await lockOrganization(tx, input.orgId);
    if (org === null) throw new ProfileError('org_not_found');

    assertLimits(org, await countProfilesByOrg(tx, input.orgId), links.length);
    if (await slugExists(tx, input.slug)) throw new ProfileError('slug_taken');

    try {
      const profile = await insertProfile(tx, {
        orgId: input.orgId,
        slug: input.slug,
        firstName: input.firstName,
        lastName: input.lastName,
        title: input.title ?? null,
        company: input.company ?? null,
        bio: input.bio ?? null,
        theme: parsed.data.theme ?? DEFAULT_THEME,
        isPublic: input.isPublic ?? true,
      });
      await insertProfileLinks(
        tx,
        links.map((link, sortOrder) => ({
          profileId: profile.id,
          type: link.type,
          value: link.value,
          label: link.label ?? null,
          isVisible: link.isVisible ?? true,
          sortOrder,
        })),
      );
      return profile;
    } catch (error) {
      // Уникалният индекс е последната защита — нарушението не изтича като
      // Drizzle обвивка с параметрите на заявката (DAT-6).
      if (isUniqueViolation(error)) throw new ProfileError('slug_taken');
      throw error;
    }
  });
}

/** Ред от списъка в `/app` — изрични полета, без тема и текстове (DAT-7). */
export interface ProfileSummary {
  readonly id: string;
  readonly slug: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly isPublic: boolean;
  readonly updatedAt: Date;
}

/** Профилите на организацията за собственика им; членството проверява извикващият. */
export async function listProfiles(
  executor: DbExecutor,
  orgId: string,
): Promise<ProfileSummary[]> {
  const rows = await findProfilesByOrg(executor, orgId);
  return rows.map((profile) => ({
    id: profile.id,
    slug: profile.slug,
    firstName: profile.firstName,
    lastName: profile.lastName,
    isPublic: profile.isPublic,
    updatedAt: profile.updatedAt,
  }));
}

/** `null` и за непознат, и за скрит профил — страницата не различава двата случая. */
export async function findPublicProfileBySlug(
  executor: DbExecutor,
  slug: string,
): Promise<PublicProfile | null> {
  const profile = await findProfileBySlug(executor, slug);
  if (profile === null || !profile.isPublic) return null;

  const links = await findVisibleLinks(executor, profile.id);
  return {
    slug: profile.slug,
    firstName: profile.firstName,
    lastName: profile.lastName,
    title: profile.title,
    company: profile.company,
    bio: profile.bio,
    theme: safeTheme(profile.theme),
    links: links.map((link) => ({
      type: link.type,
      label: link.label,
      value: link.value,
    })),
  };
}
