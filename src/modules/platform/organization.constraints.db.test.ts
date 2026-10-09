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
    .values({ email, passwordHash: 'h', name: 'Член' })
    .returning({ id: users.id });
  const id = rows[0]?.id;
  if (id === undefined) throw new Error('no user row');
  return id;
}

// Drizzle обвива грешката на pg — кодът и constraint-ът са в `cause`.
async function constraintOf(work: Promise<unknown>): Promise<string> {
  try {
    await work;
  } catch (error) {
    const cause = (error as { cause?: { constraint_name?: string } }).cause;
    return cause?.constraint_name ?? 'no constraint';
  }
  return 'no error';
}

describe('organization invariants in the database (ORG-2)', () => {
  it('refuses a second owner, but takes an editor', async () => {
    const owner = await insertUser('one-owner@example.bg');
    const other = await insertUser('two-owner@example.bg');
    const org = await createPersonalOrganization(db, {
      ownerUserId: owner,
      name: 'Org',
    });

    expect(
      await constraintOf(
        db
          .insert(orgMembers)
          .values({ orgId: org.id, userId: other, role: 'owner' }),
      ),
    ).toBe('org_members_one_owner_idx');
    await db
      .insert(orgMembers)
      .values({ orgId: org.id, userId: other, role: 'editor' });
  });

  it('refuses an expiry date on a free plan, allows it on pro', async () => {
    const owner = await insertUser('expiry@example.bg');
    const org = await createPersonalOrganization(db, {
      ownerUserId: owner,
      name: 'Org',
    });
    const at = new Date('2030-01-01T00:00:00Z');

    expect(
      await constraintOf(
        db
          .update(organizations)
          .set({ planExpiresAt: at })
          .where(eq(organizations.id, org.id)),
      ),
    ).toBe('organizations_expiry_only_pro');
    await db
      .update(organizations)
      .set({ plan: 'pro', planExpiresAt: at })
      .where(eq(organizations.id, org.id));
  });
});
