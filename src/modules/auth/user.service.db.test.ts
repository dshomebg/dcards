import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/modules/core';

import { verifyPassword } from './password';
import { findById } from './user.repository';
import { changePassword, createUser } from './user.service';

afterAll(async () => {
  await db.$client.end({ timeout: 5 });
});

async function hashOf(id: string): Promise<string> {
  const user = await findById(db, id);
  if (user === null) throw new Error(`user ${id} missing`);
  return user.passwordHash;
}

describe('changePassword', () => {
  it('keeps the hash when the current password is wrong', async () => {
    const user = await createUser(db, {
      email: 'wrong@example.bg',
      password: 'old-secret-1',
      name: 'W',
    });
    const before = await hashOf(user.id);

    const result = await changePassword(db, user.id, {
      currentPassword: 'not-it-at-all',
      newPassword: 'new-secret-22',
    });

    expect(result).toBe('wrong_current');
    expect(await hashOf(user.id)).toBe(before);
  });

  it('stores a hash that verifies only the new password', async () => {
    const user = await createUser(db, {
      email: 'right@example.bg',
      password: 'old-secret-1',
      name: 'R',
    });

    const result = await changePassword(db, user.id, {
      currentPassword: 'old-secret-1',
      newPassword: 'new-secret-22',
    });

    expect(result).toBe('ok');
    const after = await hashOf(user.id);
    expect(await verifyPassword(after, 'new-secret-22')).toBe(true);
    expect(await verifyPassword(after, 'old-secret-1')).toBe(false);
  });

  it('reports an unknown user', async () => {
    const result = await changePassword(
      db,
      '019969a0-0000-7000-8000-0000000000ff',
      { currentPassword: 'old-secret-1', newPassword: 'new-secret-22' },
    );
    expect(result).toBe('not_found');
  });
});
