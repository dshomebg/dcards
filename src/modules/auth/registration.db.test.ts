import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/modules/core';

import { organizations, orgMembers } from '../platform/organization.schema';
import { registerAccount } from './registration';
import { findByEmailWithHash } from './user.repository';
import { users } from './user.schema';

afterAll(async () => {
  await db.$client.end({ timeout: 5 });
});

describe('registerAccount', () => {
  it('creates a plain user with a personal organization owned by them', async () => {
    const result = await registerAccount(db, {
      name: 'Кирил',
      email: 'Kiril@Example.BG',
      password: 'correct-horse-1',
    });

    expect(result.status).toBe('created');
    if (result.status !== 'created') return;

    const row = await findByEmailWithHash(db, 'kiril@example.bg');
    expect(row).toMatchObject({
      id: result.user.id,
      isAdmin: false,
      emailVerifiedAt: null,
      name: 'Кирил',
    });
    expect(row?.passwordHash).toContain('$argon2id$');

    const orgs = await db
      .select()
      .from(organizations)
      .where(eq(organizations.ownerUserId, result.user.id));
    expect(orgs).toHaveLength(1);
    expect(orgs[0]).toMatchObject({ type: 'personal', name: 'Кирил' });

    const members = await db
      .select()
      .from(orgMembers)
      .where(eq(orgMembers.userId, result.user.id));
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ orgId: orgs[0]?.id, role: 'owner' });
  });

  it('reports a taken email regardless of letter case and leaves no org behind', async () => {
    const input = {
      name: 'A',
      email: 'dup@example.bg',
      password: 'correct-horse-1',
    };
    const first = await registerAccount(db, input);
    expect(first.status).toBe('created');

    const orgsBefore = await db.select().from(organizations);
    const second = await registerAccount(db, {
      ...input,
      name: 'B',
      email: 'DUP@EXAMPLE.BG',
    });
    expect(second).toEqual({ status: 'email_taken' });

    const orgsAfter = await db.select().from(organizations);
    expect(orgsAfter).toHaveLength(orgsBefore.length);
    expect(
      await db.select().from(users).where(eq(users.email, 'dup@example.bg')),
    ).toHaveLength(1);
  });
});
