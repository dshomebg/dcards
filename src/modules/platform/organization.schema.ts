// Организации и членства. Един потребител може да е в много организации;
// всяка има точно един собственик.

import {
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
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
