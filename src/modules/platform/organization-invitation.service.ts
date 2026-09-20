// Покани за членство (ORG-1): токенът е капабилност — суров само в писмото,
// в базата стои SHA-256 хешът му; срок 7 дни; ролята е винаги `editor`.

import { createHash, randomBytes } from 'node:crypto';

import type { DbExecutor } from '@/modules/core';

// Относително, като в `shop`: barrel-ът на `core` отваря Redis при импорт.
import { isUniqueViolation } from '../core/db/errors';
import { isOrgMember } from './organization.repository';
import {
  acceptInvitationRow,
  countPendingInvitations,
  deletePendingInvitation,
  findInvitationByHash,
  insertInvitation,
  replaceInvitationToken,
} from './organization-invitation.repository';
import {
  countMembers,
  isMemberByEmail,
} from './organization-member.repository';
import { OrganizationError } from './organization-plan';
import { can, type PlanFields } from './plan';

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// 32 байта base64url са точно 43 знака — друго не стига до базата.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function issueToken(now: Date) {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    tokenHash: hashInvitationToken(token),
    expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
  };
}

export interface InviteMemberInput {
  readonly org: PlanFields & { readonly id: string };
  readonly inviter: { readonly id: string; readonly email: string };
  readonly email: string;
}

/** Каквото трябва на писмото; `token` е единственото място със суровия токен. */
export interface IssuedInvitation {
  readonly id: string;
  readonly email: string;
  readonly token: string;
  readonly expiresAt: Date;
}

/**
 * Собственият адрес и членовете се отказват преди лимита; чакащите се броят
 * към лимита — Free (1 член) е запълнен от owner-а, тоест поканите са Pro.
 */
export async function createInvitation(
  executor: DbExecutor,
  input: InviteMemberInput,
  now = new Date(),
): Promise<IssuedInvitation> {
  const email = input.email.toLowerCase();
  if (email === input.inviter.email.toLowerCase()) {
    throw new OrganizationError('invite_self');
  }
  if (await isMemberByEmail(executor, input.org.id, email)) {
    throw new OrganizationError('already_member');
  }
  const [members, pending] = await Promise.all([
    countMembers(executor, input.org.id),
    countPendingInvitations(executor, input.org.id),
  ]);
  if (!can(input.org, 'members', members + pending, now)) {
    throw new OrganizationError('plan_limit_members');
  }

  const issued = issueToken(now);
  try {
    const row = await insertInvitation(executor, {
      orgId: input.org.id,
      email,
      tokenHash: issued.tokenHash,
      invitedBy: input.inviter.id,
      expiresAt: issued.expiresAt,
    });
    return { id: row.id, email, token: issued.token, expiresAt: row.expiresAt };
  } catch (error) {
    if (isUniqueViolation(error)) throw new OrganizationError('invite_pending');
    throw error;
  }
}

/** „Изпрати пак": нов токен и нов срок върху същия ред. */
export async function resendInvitation(
  executor: DbExecutor,
  orgId: string,
  invitationId: string,
  now = new Date(),
): Promise<IssuedInvitation> {
  const issued = issueToken(now);
  const row = await replaceInvitationToken(executor, orgId, invitationId, {
    tokenHash: issued.tokenHash,
    expiresAt: issued.expiresAt,
  });
  if (row === null) throw new OrganizationError('invite_not_found');
  return {
    id: row.id,
    email: row.email,
    token: issued.token,
    expiresAt: row.expiresAt,
  };
}

export async function cancelInvitation(
  executor: DbExecutor,
  orgId: string,
  invitationId: string,
): Promise<void> {
  if (!(await deletePendingInvitation(executor, orgId, invitationId))) {
    throw new OrganizationError('invite_not_found');
  }
}

export interface InvitationView {
  readonly id: string;
  readonly orgId: string;
  readonly orgName: string;
  readonly email: string;
  readonly expiresAt: Date;
  /** Планът на org-а в момента — при приемане лимитът се проверява отново. */
  readonly org: PlanFields;
}

/** Жива покана по суров токен или `null` — лош формат, няма я, приета, изтекла. */
export async function inspectInvitation(
  executor: DbExecutor,
  token: unknown,
  now = new Date(),
): Promise<InvitationView | null> {
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) return null;
  const row = await findInvitationByHash(executor, hashInvitationToken(token));
  if (row === null || row.acceptedAt !== null || row.expiresAt <= now) {
    return null;
  }
  return {
    id: row.id,
    orgId: row.orgId,
    orgName: row.orgName,
    email: row.email,
    expiresAt: row.expiresAt,
    org: { plan: row.plan, planExpiresAt: row.planExpiresAt },
  };
}

export type AcceptInvitationResult =
  | { readonly status: 'invalid' | 'email_mismatch' | 'plan_limit' }
  | { readonly status: 'accepted' | 'already_member'; readonly orgId: string };

/** Съвпадението на имейла е задължително (§ 7) — без оглед на регистъра. */
export async function acceptInvitation(
  executor: DbExecutor,
  token: unknown,
  user: { readonly id: string; readonly email: string },
  now = new Date(),
): Promise<AcceptInvitationResult> {
  const invitation = await inspectInvitation(executor, token, now);
  if (invitation === null) return { status: 'invalid' };
  if (invitation.email !== user.email.toLowerCase()) {
    return { status: 'email_mismatch' };
  }
  if (await isOrgMember(executor, invitation.orgId, user.id)) {
    return { status: 'already_member', orgId: invitation.orgId };
  }
  // Pro може да е изтекъл след изпращането — Free не бива да получи втори член.
  const members = await countMembers(executor, invitation.orgId);
  if (!can(invitation.org, 'members', members, now)) {
    return { status: 'plan_limit' };
  }

  let accepted: boolean;
  try {
    accepted = await acceptInvitationRow(executor, invitation.id, user.id);
  } catch (error) {
    // Две едновременни „Приеми" — второто удря PK на `org_members`.
    if (isUniqueViolation(error)) {
      return { status: 'already_member', orgId: invitation.orgId };
    }
    throw error;
  }
  return accepted
    ? { status: 'accepted', orgId: invitation.orgId }
    : { status: 'invalid' };
}
