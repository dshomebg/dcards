import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/modules/core';

import { users } from '../auth/user.schema';
import { seedOrg } from './card-activation.db-fixtures';
import { orgMembers } from './organization.schema';
import {
  countMembers,
  findMembership,
  isMemberByEmail,
  listMembers,
  listMembershipsForUser,
  removeMember,
  renameOrganization,
} from './organization-member.repository';

afterAll(async () => {
  await db.$client.end({ timeout: 5 });
});

async function insertUser(email: string): Promise<string> {
  const rows = await db
    .insert(users)
    .values({ email, passwordHash: 'h', name: 'Редактор' })
    .returning({ id: users.id });
  const id = rows[0]?.id;
  if (id === undefined) throw new Error('no user row');
  return id;
}

describe('findMembership / listMembershipsForUser', () => {
  it('returns org + role for a member and null for a stranger', async () => {
    const a = await seedOrg('mem-a');
    const b = await seedOrg('mem-b');
    await db
      .insert(orgMembers)
      .values({ orgId: a.org.id, userId: b.userId, role: 'editor' });

    expect(await findMembership(db, a.org.id, a.userId)).toMatchObject({
      org: { id: a.org.id },
      role: 'owner',
    });
    expect(await findMembership(db, a.org.id, b.userId)).toMatchObject({
      org: { id: a.org.id },
      role: 'editor',
    });
    expect(await findMembership(db, b.org.id, a.userId)).toBeNull();

    const memberships = await listMembershipsForUser(db, b.userId);
    expect(memberships.map((m) => [m.orgId, m.role])).toEqual([
      [b.org.id, 'owner'],
      [a.org.id, 'editor'],
    ]);
    expect(await countMembers(db, a.org.id)).toBe(2);
    // `seedOrg` номерира имейлите от 1 в рамките на файла — b е `a2@`.
    expect(await isMemberByEmail(db, a.org.id, 'A2@EXAMPLE.BG')).toBe(true);
    expect(await isMemberByEmail(db, a.org.id, 'nobody@example.bg')).toBe(
      false,
    );
  });
});

describe('removeMember', () => {
  it('removes an editor but never the owner', async () => {
    const { org, userId: ownerId } = await seedOrg('mem-remove');
    const editorId = await insertUser('editor@example.bg');
    await db
      .insert(orgMembers)
      .values({ orgId: org.id, userId: editorId, role: 'editor' });

    expect(await removeMember(db, org.id, ownerId)).toBe(false);
    expect(await removeMember(db, org.id, editorId)).toBe(true);
    expect(await removeMember(db, org.id, editorId)).toBe(false);

    const members = await listMembers(db, org.id);
    expect(members.map((m) => m.userId)).toEqual([ownerId]);
    expect(members[0]).toMatchObject({ role: 'owner', name: 'A' });
  });
});

describe('renameOrganization', () => {
  it('renames an existing org and reports a missing one', async () => {
    const { org } = await seedOrg('mem-rename');
    expect(await renameOrganization(db, org.id, 'Ново име')).toBe(true);
    expect((await findMembership(db, org.id, org.ownerUserId))?.org.name).toBe(
      'Ново име',
    );
    expect(
      await renameOrganization(db, '019969a0-0000-7000-8000-0000000000ff', 'X'),
    ).toBe(false);
  });
});
