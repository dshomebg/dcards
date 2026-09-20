// Организации и членства. Един потребител може да е в много организации;
// всяка има точно един собственик.

import { sql } from 'drizzle-orm';
import {
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { users } from '../auth/user.schema';
import { createdAt, primaryId } from '../core/db/columns';

export const organizationTypeEnum = pgEnum('organization_type', [
  'personal',
  'company',
]);

export const organizationPlanEnum = pgEnum('organization_plan', [
  'free',
  'pro',
]);

export const orgMemberRoleEnum = pgEnum('org_member_role', ['owner', 'editor']);

export const organizations = pgTable('organizations', {
  id: primaryId(),
  type: organizationTypeEnum('type').notNull(),
  name: text('name').notNull(),
  plan: organizationPlanEnum('plan').notNull().default('free'),
  planExpiresAt: timestamp('plan_expires_at', {
    withTimezone: true,
    mode: 'date',
  }),
  // Организация без собственик е невалидна — потребителят не се трие, докато
  // притежава такава.
  ownerUserId: uuid('owner_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  createdAt: createdAt(),
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

export const orgMembers = pgTable(
  'org_members',
  {
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: orgMemberRoleEnum('role').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.orgId, table.userId] }),
    index('org_members_user_idx').on(table.userId),
  ],
);

export type OrgMember = typeof orgMembers.$inferSelect;

/** Покана по имейл: суровият токен е само в писмото, тук стои SHA-256 хешът му. */
export const orgInvitations = pgTable(
  'org_invitations',
  {
    id: primaryId(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 254 }).notNull(),
    role: orgMemberRoleEnum('role').notNull().default('editor'),
    tokenHash: text('token_hash').notNull(),
    // Канещият не се трие, докато има негови покани — писмото носи името му.
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true, mode: 'date' }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('org_invitations_token_hash_idx').on(table.tokenHash),
    // Една чакаща покана на адрес в org; приетите остават като история.
    uniqueIndex('org_invitations_org_email_pending_idx')
      .on(table.orgId, sql`lower(${table.email})`)
      .where(sql`${table.acceptedAt} is null`),
    index('org_invitations_org_idx').on(table.orgId),
  ],
);

export type OrgInvitation = typeof orgInvitations.$inferSelect;
export type NewOrgInvitation = typeof orgInvitations.$inferInsert;
