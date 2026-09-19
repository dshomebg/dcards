import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/modules/core';

import { users } from '../auth/user.schema';
import { createPersonalOrganization } from './organization.repository';
import { organizations, orgMembers } from './organization.schema';

afterAll(async () => {
  await db.$client.end({ timeout: 5 });
});

async function insertUser(email: string): Promise<string> {
  const rows = await db
    .insert(users)
    .values({ email, passwordHash: 'h', name: 'Собственик' })
    .returning({ id: users.id });
  const id = rows[0]?.id;
  if (id === undefined) throw new Error('no user row');
  return id;
}

describe('createPersonalOrganization', () => {
  it('creates a personal free organization owned by the user with an owner membership', async () => {
    const userId = await insertUser('owner@example.bg');

    const org = await createPersonalOrganization(db, {
      ownerUserId: userId,
      name: 'Собственик',
    });

    expect(org).toMatchObject({
      type: 'personal',
      plan: 'free',
      planExpiresAt: null,
      ownerUserId: userId,
      name: 'Собственик',
    });

    const members = await db
      .select()
      .from(orgMembers)
      .where(eq(orgMembers.orgId, org.id));
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ userId, role: 'owner' });
  });

  it('shares the caller transaction — a rollback leaves nothing behind', async () => {
    const userId = await insertUser('rollback@example.bg');

    await expect(
      db.transaction(async (tx) => {
        await createPersonalOrganization(tx, {
          ownerUserId: userId,
          name: 'X',
        });
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');

    const orgs = await db
      .select()
      .from(organizations)
      .where(eq(organizations.ownerUserId, userId));
    expect(orgs).toHaveLength(0);
  });

  it('refuses an owner that does not exist', async () => {
    await expect(
      createPersonalOrganization(db, {
        ownerUserId: '00000000-0000-7000-8000-000000000000',
        name: 'Никой',
      }),
    ).rejects.toSatisfy((error: Error) =>
      String(error.cause).includes('organizations_owner_user_id_users_id_fk'),
    );
  });
});
