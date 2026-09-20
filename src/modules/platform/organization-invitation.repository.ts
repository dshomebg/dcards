// Достъп до `org_invitations`. Токенът не влиза тук — само хешът му.

import { and, asc, count, eq, isNull } from 'drizzle-orm';

import type { DbExecutor } from '@/modules/core';

import {
  type Organization,
  organizations,
  type OrgInvitation,
  orgInvitations,
  orgMembers,
} from './organization.schema';

export interface CreateInvitationRow {
  readonly orgId: string;
  readonly email: string;
  readonly tokenHash: string;
  readonly invitedBy: string;
  readonly expiresAt: Date;
}

export async function insertInvitation(
  executor: DbExecutor,
  input: CreateInvitationRow,
): Promise<OrgInvitation> {
  const rows = await executor.insert(orgInvitations).values(input).returning();
  const created = rows[0];
  if (created === undefined) {
    throw new Error('insert org_invitations returned no row');
  }
  return created;
}

export interface InvitationWithOrg extends OrgInvitation {
  readonly orgName: string;
  readonly plan: Organization['plan'];
  readonly planExpiresAt: Date | null;
}

/** По хеш на токена — включително приета/изтекла; състоянието го съди сервизът. */
export async function findInvitationByHash(
  executor: DbExecutor,
  tokenHash: string,
): Promise<InvitationWithOrg | null> {
  const rows = await executor
    .select({
      invitation: orgInvitations,
      orgName: organizations.name,
      plan: organizations.plan,
      planExpiresAt: organizations.planExpiresAt,
    })
    .from(orgInvitations)
    .innerJoin(organizations, eq(organizations.id, orgInvitations.orgId))
    .where(eq(orgInvitations.tokenHash, tokenHash))
    .limit(1);
  const found = rows[0];
  return found === undefined
    ? null
    : {
        ...found.invitation,
        orgName: found.orgName,
        plan: found.plan,
        planExpiresAt: found.planExpiresAt,
      };
}

export interface PendingInvitationRow {
  readonly id: string;
  readonly email: string;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

/** Чакащите (неприети) покани на org, включително изтеклите — за „Изпрати пак". */
export function listPendingInvitations(
  executor: DbExecutor,
  orgId: string,
): Promise<PendingInvitationRow[]> {
  return executor
    .select({
      id: orgInvitations.id,
      email: orgInvitations.email,
      expiresAt: orgInvitations.expiresAt,
      createdAt: orgInvitations.createdAt,
    })
    .from(orgInvitations)
    .where(
      and(eq(orgInvitations.orgId, orgId), isNull(orgInvitations.acceptedAt)),
    )
    .orderBy(asc(orgInvitations.createdAt), asc(orgInvitations.id));
}

export async function countPendingInvitations(
  executor: DbExecutor,
  orgId: string,
): Promise<number> {
  const rows = await executor
    .select({ total: count() })
    .from(orgInvitations)
    .where(
      and(eq(orgInvitations.orgId, orgId), isNull(orgInvitations.acceptedAt)),
    );
  return rows[0]?.total ?? 0;
}

/** Отмяна = изтриване; само чакаща и само в тази org (`orgId` е от сесията). */
export async function deletePendingInvitation(
  executor: DbExecutor,
  orgId: string,
  invitationId: string,
): Promise<boolean> {
  const rows = await executor
    .delete(orgInvitations)
    .where(
      and(
        eq(orgInvitations.id, invitationId),
        eq(orgInvitations.orgId, orgId),
        isNull(orgInvitations.acceptedAt),
      ),
    )
    .returning({ id: orgInvitations.id });
  return rows.length > 0;
}

/** „Изпрати пак": нов хеш и срок върху същия ред — старият линк умира. */
export async function replaceInvitationToken(
  executor: DbExecutor,
  orgId: string,
  invitationId: string,
  next: { readonly tokenHash: string; readonly expiresAt: Date },
): Promise<OrgInvitation | null> {
  const rows = await executor
    .update(orgInvitations)
    .set(next)
    .where(
      and(
        eq(orgInvitations.id, invitationId),
        eq(orgInvitations.orgId, orgId),
        isNull(orgInvitations.acceptedAt),
      ),
    )
    .returning();
  return rows[0] ?? null;
}

/**
 * Членство + `accepted_at` в една транзакция. `WHERE accepted_at IS NULL`
 * пази от двоен „Приеми" — второто натискане не намира ред и връща `false`.
 */
export function acceptInvitationRow(
  executor: DbExecutor,
  invitationId: string,
  userId: string,
): Promise<boolean> {
  return executor.transaction(async (tx) => {
    const rows = await tx
      .update(orgInvitations)
      .set({ acceptedAt: new Date() })
      .where(
        and(
          eq(orgInvitations.id, invitationId),
          isNull(orgInvitations.acceptedAt),
        ),
      )
      .returning({ orgId: orgInvitations.orgId, role: orgInvitations.role });
    const accepted = rows[0];
    if (accepted === undefined) return false;

    await tx
      .insert(orgMembers)
      .values({ orgId: accepted.orgId, userId, role: accepted.role });
    return true;
  });
}
