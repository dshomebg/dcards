// Достъп до `organizations` и `org_members` — единственото място в модула със SQL.

import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';

import { likePattern } from '@/lib/like-pattern';
import type { DbExecutor } from '@/modules/core';

import { users } from '../auth/user.schema';
import {
  type Organization,
  organizations,
  type OrgMember,
  orgMembers,
} from './organization.schema';
import { OrganizationError } from './organization-plan';
import { profiles } from './profile.schema';
import { SCAN_TIME_ZONE } from './scan-days';

export interface CreatePersonalOrganizationInput {
  readonly ownerUserId: string;
  readonly name: string;
}

/**
 * Лична организация плюс ред `owner` в `org_members` — в една транзакция.
 * Подаден изпълнител-транзакция я влага като savepoint, тоест остава атомарна
 * и с чуждата.
 */
export function createPersonalOrganization(
  executor: DbExecutor,
  input: CreatePersonalOrganizationInput,
): Promise<Organization> {
  return executor.transaction(async (tx) => {
    const rows = await tx
      .insert(organizations)
      .values({
        type: 'personal',
        name: input.name,
        ownerUserId: input.ownerUserId,
      })
      .returning();

    const created = rows[0];
    if (created === undefined) {
      throw new Error('insert organizations returned no row');
    }

    await tx
      .insert(orgMembers)
      .values({ orgId: created.id, userId: input.ownerUserId, role: 'owner' });

    return created;
  });
}

/** Личната организация на потребител — има най-много една (`seed-demo`). */
export async function findPersonalOrganizationByOwner(
  executor: DbExecutor,
  ownerUserId: string,
): Promise<Organization | null> {
  const rows = await executor
    .select()
    .from(organizations)
    .where(
      and(
        eq(organizations.ownerUserId, ownerUserId),
        eq(organizations.type, 'personal'),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** Членство по PK на `org_members` — проверката за AUTH-2 във всяка Server Action. */
export async function isOrgMember(
  executor: DbExecutor,
  orgId: string,
  userId: string,
): Promise<boolean> {
  const rows = await executor
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

export async function countOrganizations(
  executor: DbExecutor,
): Promise<number> {
  const rows = await executor.select({ total: count() }).from(organizations);
  return rows[0]?.total ?? 0;
}

// Админ: списък, детайл и план. `users.email/name` се четат тук по DAT-6 —
// хешът не се избира никога.

export interface AdminOrganizationRow {
  readonly id: string;
  readonly type: Organization['type'];
  readonly name: string;
  readonly plan: Organization['plan'];
  readonly planExpiresAt: Date | null;
  readonly ownerEmail: string;
  readonly profileCount: number;
  readonly createdAt: Date;
}

export interface SearchOrganizationsInput {
  readonly query?: string;
  readonly plan?: Organization['plan'];
  readonly limit: number;
}

function searchConditions(input: SearchOrganizationsInput): SQL | undefined {
  const conditions: SQL[] = [];
  if (input.query !== undefined && input.query !== '') {
    const pattern = likePattern(input.query);
    const match = or(
      sql`${organizations.name} ILIKE ${pattern} ESCAPE '\\'`,
      sql`${users.email} ILIKE ${pattern} ESCAPE '\\'`,
    );
    if (match !== undefined) conditions.push(match);
  }
  if (input.plan !== undefined) {
    conditions.push(eq(organizations.plan, input.plan));
  }
  return and(...conditions);
}

/** Най-новите първи; `limit` е таванът на екрана (без страници). */
export function searchOrganizations(
  executor: DbExecutor,
  input: SearchOrganizationsInput,
): Promise<AdminOrganizationRow[]> {
  return executor
    .select({
      id: organizations.id,
      type: organizations.type,
      name: organizations.name,
      plan: organizations.plan,
      planExpiresAt: organizations.planExpiresAt,
      ownerEmail: users.email,
      profileCount:
        sql<number>`(select count(*) from ${profiles} where ${profiles.orgId} = ${organizations.id})`.mapWith(
          Number,
        ),
      createdAt: organizations.createdAt,
    })
    .from(organizations)
    .innerJoin(users, eq(users.id, organizations.ownerUserId))
    .where(searchConditions(input))
    .orderBy(desc(organizations.createdAt), desc(organizations.id))
    .limit(input.limit);
}

export interface AdminOrgMemberRow {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly role: OrgMember['role'];
}

export interface AdminOrganizationDetail extends Organization {
  readonly ownerEmail: string;
  readonly ownerName: string;
  readonly members: readonly AdminOrgMemberRow[];
}

export async function getOrganizationForAdmin(
  executor: DbExecutor,
  orgId: string,
): Promise<AdminOrganizationDetail | null> {
  const rows = await executor
    .select({
      org: organizations,
      ownerEmail: users.email,
      ownerName: users.name,
    })
    .from(organizations)
    .innerJoin(users, eq(users.id, organizations.ownerUserId))
    .where(eq(organizations.id, orgId))
    .limit(1);
  const found = rows[0];
  if (found === undefined) return null;

  const members = await executor
    .select({
      userId: orgMembers.userId,
      email: users.email,
      name: users.name,
      role: orgMembers.role,
    })
    .from(orgMembers)
    .innerJoin(users, eq(users.id, orgMembers.userId))
    .where(eq(orgMembers.orgId, orgId))
    .orderBy(asc(orgMembers.createdAt), asc(orgMembers.userId));

  return {
    ...found.org,
    ownerEmail: found.ownerEmail,
    ownerName: found.ownerName,
    members,
  };
}

export interface PlanUpdate {
  readonly plan: Organization['plan'];
  /** `YYYY-MM-DD`; `null` = безсрочно. При `free` се пренебрегва. */
  readonly expiresOn: string | null;
}

/** „Изтича на X" = 00:00 по София на следващия ден — смята се в SQL, не в JS. */
export async function updateOrganizationPlan(
  executor: DbExecutor,
  orgId: string,
  update: PlanUpdate,
): Promise<Organization> {
  const planExpiresAt =
    update.plan === 'pro' && update.expiresOn !== null
      ? sql`((${update.expiresOn}::date + 1)::timestamp AT TIME ZONE ${SCAN_TIME_ZONE})`
      : null;
  const rows = await executor
    .update(organizations)
    .set({ plan: update.plan, planExpiresAt })
    .where(eq(organizations.id, orgId))
    .returning();
  const updated = rows[0];
  if (updated === undefined) throw new OrganizationError('org_not_found');
  return updated;
}

export interface UserMembershipRow {
  readonly userId: string;
  readonly orgId: string;
  readonly orgName: string;
  readonly role: OrgMember['role'];
}

/** Членствата на много потребители наведнъж — за списъка в `/admin/users`. */
export function listMembershipsForUsers(
  executor: DbExecutor,
  userIds: readonly string[],
): Promise<UserMembershipRow[]> {
  if (userIds.length === 0) return Promise.resolve([]);
  return executor
    .select({
      userId: orgMembers.userId,
      orgId: orgMembers.orgId,
      orgName: organizations.name,
      role: orgMembers.role,
    })
    .from(orgMembers)
    .innerJoin(organizations, eq(organizations.id, orgMembers.orgId))
    .where(inArray(orgMembers.userId, [...userIds]))
    .orderBy(asc(orgMembers.userId), asc(orgMembers.createdAt));
}
