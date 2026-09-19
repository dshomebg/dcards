import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { users } from '@/modules/auth/user.schema';
import { db } from '@/modules/core';
import {
  organizations,
  orgMembers,
} from '@/modules/platform/organization.schema';

import { seedAdmin } from './seed-admin';

afterAll(async () => {
  await db.$client.end({ timeout: 5 });
});

async function userRow(email: string) {
  const rows = await db.select().from(users).where(eq(users.email, email));
  return rows[0];
}

describe('seedAdmin', () => {
  it('creates a verified admin with a personal organization and owner membership', async () => {
    const result = await seedAdmin(db, {
      email: 'Admin@Example.BG',
      password: 'correct-horse-1',
      name: 'Първи',
    });

    expect(result.status).toBe('created');
    if (result.status !== 'created') return;

    const user = await userRow('admin@example.bg');
    expect(user).toMatchObject({
      id: result.userId,
      isAdmin: true,
      name: 'Първи',
    });
    expect(user?.emailVerifiedAt).toBeInstanceOf(Date);
    expect(user?.passwordHash).toMatch(/^\$argon2id\$/);

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, result.orgId));
    expect(org).toMatchObject({
      type: 'personal',
      plan: 'free',
      ownerUserId: result.userId,
      name: 'Първи',
    });

    const members = await db
      .select()
      .from(orgMembers)
      .where(eq(orgMembers.orgId, result.orgId));
    expect(members).toEqual([
      expect.objectContaining({ userId: result.userId, role: 'owner' }),
    ]);
  });

  it('is idempotent: a second run with another letter case changes nothing', async () => {
    await seedAdmin(db, {
      email: 'twice@example.bg',
      password: 'first-password-1',
    });
    const before = await userRow('twice@example.bg');

    const result = await seedAdmin(db, {
      email: 'TWICE@Example.bg',
      password: 'other-password-2',
      name: 'Друг',
    });

    expect(result).toEqual({ status: 'exists' });
    const after = await userRow('twice@example.bg');
    expect(after).toEqual(before);
    const orgs = await db
      .select()
      .from(organizations)
      .where(eq(organizations.ownerUserId, before?.id ?? ''));
    expect(orgs).toHaveLength(1);
  });

  it('refuses a weak password or an invalid email without writing anything', async () => {
    await expect(
      seedAdmin(db, { email: 'weak@example.bg', password: 'short' }),
    ).rejects.toThrow();
    await expect(
      seedAdmin(db, { email: 'not-an-email', password: 'long-enough-1' }),
    ).rejects.toThrow();

    expect(await userRow('weak@example.bg')).toBeUndefined();
  });

  it('applies the default name when none is given', async () => {
    const result = await seedAdmin(db, {
      email: 'noname@example.bg',
      password: 'correct-horse-1',
    });

    expect(result.status).toBe('created');
    expect((await userRow('noname@example.bg'))?.name).toBe('Администратор');
  });
});
