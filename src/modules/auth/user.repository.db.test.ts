import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/modules/core';

import {
  findByEmailWithHash,
  findById,
  insert,
  markEmailVerified,
} from './user.repository';

afterAll(async () => {
  await db.$client.end({ timeout: 5 });
});

describe('user.repository', () => {
  it('stores the email in lower case and finds it regardless of case', async () => {
    const created = await insert(db, {
      email: 'Ivan@Example.BG',
      passwordHash: 'hash',
      name: 'Иван',
    });

    expect(created.email).toBe('ivan@example.bg');
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.isAdmin).toBe(false);
    expect(created.emailVerifiedAt).toBeNull();
    expect(created.createdAt).toBeInstanceOf(Date);

    const found = await findByEmailWithHash(db, 'IVAN@example.bg');
    expect(found?.id).toBe(created.id);
    expect(found?.passwordHash).toBe('hash');
  });

  it('returns null for an unknown email', async () => {
    expect(await findByEmailWithHash(db, 'nobody@example.bg')).toBeNull();
  });

  it('rejects a second account that differs only by letter case', async () => {
    await insert(db, { email: 'dup@example.bg', passwordHash: 'h', name: 'A' });

    // Drizzle увива грешката на драйвера; ограничението е в `cause`.
    await expect(
      insert(db, { email: 'DUP@example.bg', passwordHash: 'h', name: 'B' }),
    ).rejects.toSatisfy((error: Error) =>
      String(error.cause).includes('users_email_lower_idx'),
    );
  });

  it('marks the email verified once and keeps the first date', async () => {
    const created = await insert(db, {
      email: 'verify@example.bg',
      passwordHash: 'h',
      name: 'V',
    });

    expect(await markEmailVerified(db, created.id)).toBe(true);
    const first = (await findById(db, created.id))?.emailVerifiedAt;
    expect(first).toBeInstanceOf(Date);

    expect(await markEmailVerified(db, created.id)).toBe(false);
    expect((await findById(db, created.id))?.emailVerifiedAt).toEqual(first);
  });

  it('reports false for an unknown user', async () => {
    expect(
      await markEmailVerified(db, '019969a0-0000-7000-8000-0000000000ff'),
    ).toBe(false);
  });
});
