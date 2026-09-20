import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/modules/core';

import { users } from '../auth/user.schema';
import {
  createPersonalOrganization,
  getOrganizationForAdmin,
  isOrgMember,
  listMembershipsForUsers,
  searchOrganizations,
  updateOrganizationPlan,
} from './organization.repository';
import { organizations, orgMembers } from './organization.schema';
import { OrganizationError } from './organization-plan';
import { createProfile } from './profile.service';

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

describe('isOrgMember', () => {
  it('is true for the owner and false for a stranger or an unknown org', async () => {
    const ownerId = await insertUser('member-owner@example.bg');
    const strangerId = await insertUser('stranger@example.bg');
    const org = await createPersonalOrganization(db, {
      ownerUserId: ownerId,
      name: 'M',
    });

    expect(await isOrgMember(db, org.id, ownerId)).toBe(true);
    expect(await isOrgMember(db, org.id, strangerId)).toBe(false);
    expect(
      await isOrgMember(db, '00000000-0000-7000-8000-000000000000', ownerId),
    ).toBe(false);
  });
});

describe('updateOrganizationPlan', () => {
  it('pro + date stores 00:00 Sofia of the next day; empty date = open-ended', async () => {
    const userId = await insertUser('plan@example.bg');
    const org = await createPersonalOrganization(db, {
      ownerUserId: userId,
      name: 'P',
    });

    const dated = await updateOrganizationPlan(db, org.id, {
      plan: 'pro',
      expiresOn: '2026-12-31',
    });
    expect(dated.plan).toBe('pro');
    // 2027-01-01 00:00 EET = 2026-12-31 22:00 UTC.
    expect(dated.planExpiresAt?.toISOString()).toBe('2026-12-31T22:00:00.000Z');

    const summer = await updateOrganizationPlan(db, org.id, {
      plan: 'pro',
      expiresOn: '2026-07-15',
    });
    expect(summer.planExpiresAt?.toISOString()).toBe(
      '2026-07-15T21:00:00.000Z',
    );

    const open = await updateOrganizationPlan(db, org.id, {
      plan: 'pro',
      expiresOn: null,
    });
    expect(open).toMatchObject({ plan: 'pro', planExpiresAt: null });
  });

  it('free clears the date even when one is given', async () => {
    const userId = await insertUser('free@example.bg');
    const org = await createPersonalOrganization(db, {
      ownerUserId: userId,
      name: 'F',
    });
    await updateOrganizationPlan(db, org.id, {
      plan: 'pro',
      expiresOn: '2030-01-01',
    });

    const freed = await updateOrganizationPlan(db, org.id, {
      plan: 'free',
      expiresOn: '2030-01-01',
    });
    expect(freed).toMatchObject({ plan: 'free', planExpiresAt: null });
  });

  it('throws org_not_found for an unknown id', async () => {
    await expect(
      updateOrganizationPlan(db, '00000000-0000-7000-8000-000000000000', {
        plan: 'pro',
        expiresOn: null,
      }),
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof OrganizationError && error.code === 'org_not_found',
    );
  });
});

describe('searchOrganizations', () => {
  it('matches name or owner email, filters by plan and counts profiles', async () => {
    const annaId = await insertUser('anna.search@example.bg');
    const borisId = await insertUser('boris.search@example.bg');
    const anna = await createPersonalOrganization(db, {
      ownerUserId: annaId,
      name: 'Фирма Alpha',
    });
    await createPersonalOrganization(db, {
      ownerUserId: borisId,
      name: 'Beta',
    });
    await createProfile(db, {
      orgId: anna.id,
      slug: 'anna-search',
      firstName: 'Анна',
      lastName: 'А',
    });
    await updateOrganizationPlan(db, anna.id, { plan: 'pro', expiresOn: null });

    const byName = await searchOrganizations(db, { query: 'alpha', limit: 10 });
    expect(byName.map((row) => row.id)).toEqual([anna.id]);
    expect(byName[0]).toMatchObject({
      ownerEmail: 'anna.search@example.bg',
      profileCount: 1,
      plan: 'pro',
    });

    const byEmail = await searchOrganizations(db, {
      query: 'BORIS.search',
      limit: 10,
    });
    expect(byEmail.map((row) => row.name)).toEqual(['Beta']);
    expect(byEmail[0]?.profileCount).toBe(0);

    const pro = await searchOrganizations(db, {
      query: '.search@',
      plan: 'pro',
      limit: 10,
    });
    expect(pro.map((row) => row.id)).toEqual([anna.id]);
  });

  it('treats %, _ and backslash literally', async () => {
    const userId = await insertUser('escape@example.bg');
    await createPersonalOrganization(db, {
      ownerUserId: userId,
      name: '100% a_b c\\d',
    });

    expect(
      await searchOrganizations(db, { query: '%', limit: 10 }),
    ).toHaveLength(1);
    expect(
      await searchOrganizations(db, { query: '_', limit: 10 }),
    ).toHaveLength(1);
    expect(
      await searchOrganizations(db, { query: 'c\\d', limit: 10 }),
    ).toHaveLength(1);
    expect(
      await searchOrganizations(db, { query: 'axb', limit: 10 }),
    ).toHaveLength(0);
  });
});

describe('getOrganizationForAdmin / listMembershipsForUsers', () => {
  it('returns owner, members and memberships; null for unknown', async () => {
    const userId = await insertUser('detail@example.bg');
    const org = await createPersonalOrganization(db, {
      ownerUserId: userId,
      name: 'D',
    });

    const detail = await getOrganizationForAdmin(db, org.id);
    expect(detail).toMatchObject({
      id: org.id,
      ownerEmail: 'detail@example.bg',
      ownerName: 'Собственик',
    });
    expect(detail?.members).toEqual([
      {
        userId,
        email: 'detail@example.bg',
        name: 'Собственик',
        role: 'owner',
      },
    ]);
    expect(
      await getOrganizationForAdmin(db, '00000000-0000-7000-8000-000000000000'),
    ).toBeNull();

    expect(await listMembershipsForUsers(db, [userId])).toEqual([
      { userId, orgId: org.id, orgName: 'D', role: 'owner' },
    ]);
    expect(await listMembershipsForUsers(db, [])).toEqual([]);
  });
});
