// Профил (публичната страница на картата) и неговите линкове. Собственик е
// организацията, не потребителят (AUTH-2).

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { createdAt, primaryId, updatedAt } from '../core/db/columns';
import { organizations } from './organization.schema';
import { SLUG_PATTERN } from './slug';

export const PROFILE_LINK_TYPES = [
  'phone',
  'email',
  'website',
  'linkedin',
  'facebook',
  'instagram',
  'tiktok',
  'youtube',
  'whatsapp',
  'viber',
  'telegram',
  'address',
  'custom',
] as const;

export type ProfileLinkType = (typeof PROFILE_LINK_TYPES)[number];

export const profileLinkTypeEnum = pgEnum(
  'profile_link_type',
  PROFILE_LINK_TYPES,
);

/** `layout` има една стойност засега — за да не иска миграция, когато дойде втора. */
export interface ProfileTheme {
  readonly preset: 'light' | 'dark' | 'sand';
  readonly primaryColor: string | null;
  readonly layout: 'default';
}

// `sql.raw` — иначе drizzle-kit оставя `$1` в миграцията вместо литерал.
const SLUG_PATTERN_SQL = sql.raw(`'${SLUG_PATTERN.source}'`);

export const profiles = pgTable(
  'profiles',
  {
    id: primaryId(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    title: text('title'),
    company: text('company'),
    bio: text('bio'),
    photoKey: text('photo_key'),
    logoKey: text('logo_key'),
    theme: jsonb('theme').$type<ProfileTheme>().notNull(),
    isPublic: boolean('is_public').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('profiles_slug_idx').on(table.slug),
    index('profiles_org_idx').on(table.orgId),
    // Пази и от редакция през `db:studio`, която заобикаля `slugSchema`.
    check('profiles_slug_format', sql`${table.slug} ~ ${SLUG_PATTERN_SQL}`),
  ],
);

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;

export const profileLinks = pgTable(
  'profile_links',
  {
    id: primaryId(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    type: profileLinkTypeEnum('type').notNull(),
    // Празен етикет → подразбираният от `LINK_LABELS` по тип.
    label: text('label'),
    value: text('value').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isVisible: boolean('is_visible').notNull().default(true),
  },
  (table) => [
    index('profile_links_profile_idx').on(table.profileId, table.sortOrder),
  ],
);

export type ProfileLink = typeof profileLinks.$inferSelect;
export type NewProfileLink = typeof profileLinks.$inferInsert;

/** Каквото вижда публичната страница — изброено изрично, не `Omit`. */
export interface PublicProfileLink {
  readonly type: ProfileLinkType;
  readonly label: string | null;
  readonly value: string;
}

export interface PublicProfile {
  readonly slug: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly title: string | null;
  readonly company: string | null;
  readonly bio: string | null;
  readonly theme: ProfileTheme;
  readonly links: readonly PublicProfileLink[];
}
