import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/modules/core';

import { users } from '../auth/user.schema';
import { seedOrg } from './card-activation.db-fixtures';
import {
  organizations,
  orgInvitations,
  orgMembers,
} from './organization.schema';
import {
  countPendingInvitations,
  listPendingInvitations,
} from './organization-invitation.repository';
import {
  acceptInvitation,
  cancelInvitation,
  createInvitation,
  hashInvitationToken,
  inspectInvitation,
  INVITATION_TTL_MS,
  resendInvitation,
} from './organization-invitation.service';
import { OrganizationError } from './organization-plan';

afterAll(async () => {
  await db.$client.end({ timeout: 5 });
});

async function seedProOrg(slug: string) {
  const seeded = await seedOrg(slug);
  await db
    .update(organizations)
    .set({ plan: 'pro' })
    .where(eq(organizations.id, seeded.org.id));
  const rows = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, seeded.org.id));
  const org = rows[0];
  if (org === undefined) throw new Error('no org');
  const owner = (
    await db.select().from(users).where(eq(users.id, seeded.userId))
  )[0];
  if (owner === undefined) throw new Error('no owner');
  return { org, owner };
}

async function insertUser(email: string) {
  const rows = await db
    .insert(users)
    .values({ email, passwordHash: 'h', name: 'Гост' })
    .returning({ id: users.id, email: users.email });
  const user = rows[0];
  if (user === undefined) throw new Error('no user row');
  return user;
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof OrganizationError) return error.code;
    throw error;
  }
  throw new Error('expected an OrganizationError');
}

describe('createInvitation', () => {
  it('stores only the hash, lowercases the email and sets a 7-day expiry', async () => {
    const { org, owner } = await seedProOrg('inv-create');
    const now = new Date('2026-09-20T10:00:00Z');

    const issued = await createInvitation(
      db,
      { org, inviter: owner, email: 'Guest@Example.bg' },
      now,
    );

    expect(issued.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(issued.email).toBe('guest@example.bg');
    expect(issued.expiresAt.getTime()).toBe(now.getTime() + INVITATION_TTL_MS);

    const rows = await db
      .select()
      .from(orgInvitations)
      .where(eq(orgInvitations.id, issued.id));
    expect(rows[0]).toMatchObject({
      orgId: org.id,
      email: 'guest@example.bg',
      role: 'editor',
      tokenHash: hashInvitationToken(issued.token),
      invitedBy: owner.id,
      acceptedAt: null,
    });
    expect(rows[0]?.tokenHash).not.toBe(issued.token);
  });

  it('refuses the inviter, an existing member and a second pending invite', async () => {
    const { org, owner } = await seedProOrg('inv-refuse');
    await createInvitation(db, { org, inviter: owner, email: 'a@x.bg' });

    expect(
      await codeOf(
        createInvitation(db, {
          org,
          inviter: owner,
          email: owner.email.toUpperCase(),
        }),
      ),
    ).toBe('invite_self');
    expect(
      await codeOf(
        createInvitation(db, { org, inviter: owner, email: 'A@x.bg' }),
      ),
    ).toBe('invite_pending');

    const member = await insertUser('member@x.bg');
    await db
      .insert(orgMembers)
      .values({ orgId: org.id, userId: member.id, role: 'editor' });
    expect(
      await codeOf(
        createInvitation(db, { org, inviter: owner, email: 'MEMBER@x.bg' }),
      ),
    ).toBe('already_member');
  });

  it('refuses on Free — the owner already fills the single seat', async () => {
    const seeded = await seedOrg('inv-free');
    const org = seeded.org;
    const owner = { id: seeded.userId, email: 'owner-free@x.bg' };
    expect(
      await codeOf(
        createInvitation(db, { org, inviter: owner, email: 'b@x.bg' }),
      ),
    ).toBe('plan_limit_members');
    expect(await countPendingInvitations(db, org.id)).toBe(0);
  });
});

describe('inspectInvitation', () => {
  it('returns null for a bad token, an expired one and after cancel', async () => {
    const { org, owner } = await seedProOrg('inv-inspect');
    const issued = await createInvitation(db, {
      org,
      inviter: owner,
      email: 'c@x.bg',
    });

    expect(await inspectInvitation(db, 'short')).toBeNull();
    expect(await inspectInvitation(db, 'A'.repeat(43))).toBeNull();
    expect(await inspectInvitation(db, issued.token)).toMatchObject({
      id: issued.id,
      orgId: org.id,
      orgName: org.name,
      email: 'c@x.bg',
    });
    const later = new Date(issued.expiresAt.getTime() + 1);
    expect(await inspectInvitation(db, issued.token, later)).toBeNull();

    await cancelInvitation(db, org.id, issued.id);
    expect(await inspectInvitation(db, issued.token)).toBeNull();
    expect(await codeOf(cancelInvitation(db, org.id, issued.id))).toBe(
      'invite_not_found',
    );
  });

  it('resend replaces the token so the old link dies', async () => {
    const { org, owner } = await seedProOrg('inv-resend');
    const first = await createInvitation(db, {
      org,
      inviter: owner,
      email: 'd@x.bg',
    });
    const second = await resendInvitation(db, org.id, first.id);

    expect(second.id).toBe(first.id);
    expect(second.token).not.toBe(first.token);
    expect(await inspectInvitation(db, first.token)).toBeNull();
    expect(await inspectInvitation(db, second.token)).not.toBeNull();
    expect(await listPendingInvitations(db, org.id)).toHaveLength(1);

    const foreign = await seedProOrg('inv-resend-foreign');
    expect(await codeOf(resendInvitation(db, foreign.org.id, first.id))).toBe(
      'invite_not_found',
    );
  });
});

describe('acceptInvitation', () => {
  it('adds an editor membership and marks the row accepted — once', async () => {
    const { org, owner } = await seedProOrg('inv-accept');
    const issued = await createInvitation(db, {
      org,
      inviter: owner,
      email: 'e@x.bg',
    });
    const guest = await insertUser('E@x.bg');

    const result = await acceptInvitation(db, issued.token, guest);
    expect(result).toEqual({ status: 'accepted', orgId: org.id });

    const members = await db
      .select()
      .from(orgMembers)
      .where(eq(orgMembers.userId, guest.id));
    expect(members).toEqual([
      expect.objectContaining({ orgId: org.id, role: 'editor' }),
    ]);
    const rows = await db
      .select()
      .from(orgInvitations)
      .where(eq(orgInvitations.id, issued.id));
    expect(rows[0]?.acceptedAt).toBeInstanceOf(Date);

    // Втори път по същия линк: поканата е приета → невалидна; членството остава едно.
    expect(await acceptInvitation(db, issued.token, guest)).toEqual({
      status: 'invalid',
    });
  });

  it('refuses to accept once Pro has expired — Free keeps a single seat', async () => {
    const { org, owner } = await seedProOrg('inv-expired-plan');
    const issued = await createInvitation(db, {
      org,
      inviter: owner,
      email: 'late@x.bg',
    });
    await db
      .update(organizations)
      .set({ plan: 'free', planExpiresAt: null })
      .where(eq(organizations.id, org.id));
    const guest = await insertUser('late@x.bg');

    expect(await acceptInvitation(db, issued.token, guest)).toEqual({
      status: 'plan_limit',
    });
    const members = await db
      .select()
      .from(orgMembers)
      .where(eq(orgMembers.userId, guest.id));
    expect(members).toHaveLength(0);
  });

  it('refuses another email without touching the membership', async () => {
    const { org, owner } = await seedProOrg('inv-mismatch');
    const issued = await createInvitation(db, {
      org,
      inviter: owner,
      email: 'f@x.bg',
    });
    const stranger = await insertUser('g@x.bg');

    expect(await acceptInvitation(db, issued.token, stranger)).toEqual({
      status: 'email_mismatch',
    });
    expect(await acceptInvitation(db, 'bad', stranger)).toEqual({
      status: 'invalid',
    });
    const members = await db
      .select()
      .from(orgMembers)
      .where(eq(orgMembers.userId, stranger.id));
    expect(members).toHaveLength(0);
  });

  it('reports an existing member instead of inserting twice', async () => {
    const { org, owner } = await seedProOrg('inv-member');
    const issued = await createInvitation(db, {
      org,
      inviter: owner,
      email: 'h@x.bg',
    });
    const guest = await insertUser('h@x.bg');
    await db
      .insert(orgMembers)
      .values({ orgId: org.id, userId: guest.id, role: 'editor' });

    expect(await acceptInvitation(db, issued.token, guest)).toEqual({
      status: 'already_member',
      orgId: org.id,
    });
  });
});
