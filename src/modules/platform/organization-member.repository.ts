// Членствата откъм потребителя и собственика — `organization.repository.ts` е
// пълен (ORG-1); тук няма нищо админско.

import { and, asc, count, eq, ne, sql } from 'drizzle-orm';

import type { DbExecutor } from '@/modules/core';

import { users } from '../auth/user.schema';
import {
  type Organization,
  organizations,
  type OrgMember,
  orgMembers,
} from './organization.schema';

export interface Membership {
  readonly org: Organization;
  readonly role: OrgMember['role'];
}

/** Org + роля, ако потребителят е член — проверката зад cookie-то `current_org`. */
export async function findMembership(
  executor: DbExecutor,
  orgId: string,
  userId: string,
): Promise<Membership | null> {
  const rows = await executor
    .select({ org: organizations, role: orgMembers.role })
    .from(orgMembers)
    .innerJoin(organizations, eq(organizations.id, orgMembers.orgId))
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export interface MembershipRow {
  readonly orgId: string;
  readonly orgName: string;
  readonly role: OrgMember['role'];
}

/** Всички org на един потребител — за селекта в layout-а; най-старото първо. */
export function listMembershipsForUser(
  executor: DbExecutor,
  userId: string,
): Promise<MembershipRow[]> {
  return executor
    .select({
      orgId: orgMembers.orgId,
      orgName: organizations.name,
      role: orgMembers.role,
    })
    .from(orgMembers)
    .innerJoin(organizations, eq(organizations.id, orgMembers.orgId))
    .where(eq(orgMembers.userId, userId))
    .orderBy(asc(orgMembers.createdAt), asc(orgMembers.orgId));
}

export interface OrgMemberRow {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly role: OrgMember['role'];
  readonly createdAt: Date;
}

/** Членовете на org с имейл и име — за `/app/org`; хешът не се избира (DAT-6). */
export function listMembers(
  executor: DbExecutor,
  orgId: string,
): Promise<OrgMemberRow[]> {
  return executor
    .select({
      userId: orgMembers.userId,
      email: users.email,
      name: users.name,
      role: orgMembers.role,
      createdAt: orgMembers.createdAt,
    })
    .from(orgMembers)
    .innerJoin(users, eq(users.id, orgMembers.userId))
    .where(eq(orgMembers.orgId, orgId))
    .orderBy(asc(orgMembers.createdAt), asc(orgMembers.userId));
}

export async function countMembers(
  executor: DbExecutor,
  orgId: string,
): Promise<number> {
  const rows = await executor
    .select({ total: count() })
    .from(orgMembers)
    .where(eq(orgMembers.orgId, orgId));
  return rows[0]?.total ?? 0;
}

/** Има ли член с този имейл (без оглед на регистъра) — преди да се кани. */
export async function isMemberByEmail(
  executor: DbExecutor,
  orgId: string,
  email: string,
): Promise<boolean> {
  const rows = await executor
    .select({ userId: orgMembers.userId })
    .from(orgMembers)
    .innerJoin(users, eq(users.id, orgMembers.userId))
    .where(
      and(
        eq(orgMembers.orgId, orgId),
        sql`lower(${users.email}) = lower(${email})`,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Маха член; собственикът не се маха оттук — `false` и за него, и за чужд. */
export async function removeMember(
  executor: DbExecutor,
  orgId: string,
  userId: string,
): Promise<boolean> {
  const rows = await executor
    .delete(orgMembers)
    .where(
      and(
        eq(orgMembers.orgId, orgId),
        eq(orgMembers.userId, userId),
        ne(orgMembers.role, 'owner'),
      ),
    )
    .returning({ userId: orgMembers.userId });
  return rows.length > 0;
}

export async function renameOrganization(
  executor: DbExecutor,
  orgId: string,
  name: string,
): Promise<boolean> {
  const rows = await executor
    .update(organizations)
    .set({ name })
    .where(eq(organizations.id, orgId))
    .returning({ id: organizations.id });
  return rows.length > 0;
}
