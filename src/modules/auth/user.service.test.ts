import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DbExecutor } from '@/modules/core';

import type { User } from './user.schema';

const verification = vi.hoisted(() => ({
  readVerificationToken: vi.fn<(token: string) => Promise<string | null>>(),
  consumeVerificationToken: vi.fn(() => Promise.resolve()),
}));
const repository = vi.hoisted(() => ({
  markEmailVerified: vi.fn<(db: unknown, id: string) => Promise<boolean>>(),
  findById: vi.fn<(db: unknown, id: string) => Promise<User | null>>(),
}));

vi.mock('./email-verification', () => verification);
vi.mock('./user.repository', () => repository);
vi.mock('@/modules/core', () => ({}));

const { verifyEmailByToken } = await import('./user.service');

const db = {} as DbExecutor;
const USER_ID = '019969a0-0000-7000-8000-000000000001';
const TOKEN = 'a'.repeat(43);
const row: User = {
  id: USER_ID,
  email: 'k@x.bg',
  name: 'K',
  passwordHash: 'h',
  emailVerifiedAt: new Date(),
  isAdmin: false,
  createdAt: new Date(),
};

describe('verifyEmailByToken', () => {
  beforeEach(() => {
    verification.readVerificationToken.mockReset().mockResolvedValue(USER_ID);
    verification.consumeVerificationToken.mockClear();
    repository.markEmailVerified.mockReset().mockResolvedValue(true);
    repository.findById.mockReset().mockResolvedValue(row);
  });

  it('marks the user and consumes the token', async () => {
    await expect(verifyEmailByToken(db, TOKEN)).resolves.toBe('verified');
    expect(repository.markEmailVerified).toHaveBeenCalledWith(db, USER_ID);
    expect(verification.consumeVerificationToken).toHaveBeenCalledWith(
      TOKEN,
      USER_ID,
    );
  });

  it('is idempotent for an already verified user and still burns the token', async () => {
    repository.markEmailVerified.mockResolvedValue(false);
    await expect(verifyEmailByToken(db, TOKEN)).resolves.toBe('already');
    expect(verification.consumeVerificationToken).toHaveBeenCalledOnce();
  });

  it('treats a token for a vanished user as invalid', async () => {
    repository.markEmailVerified.mockResolvedValue(false);
    repository.findById.mockResolvedValue(null);
    await expect(verifyEmailByToken(db, TOKEN)).resolves.toBe('invalid');
    expect(verification.consumeVerificationToken).not.toHaveBeenCalled();
  });

  it('rejects a non-string or unknown token without touching the database', async () => {
    await expect(verifyEmailByToken(db, undefined)).resolves.toBe('invalid');
    await expect(verifyEmailByToken(db, ['a'])).resolves.toBe('invalid');
    verification.readVerificationToken.mockResolvedValue(null);
    await expect(verifyEmailByToken(db, TOKEN)).resolves.toBe('invalid');
    expect(repository.markEmailVerified).not.toHaveBeenCalled();
  });

  it('lets a database failure surface so the token is not burnt', async () => {
    repository.markEmailVerified.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(verifyEmailByToken(db, TOKEN)).rejects.toThrow();
    expect(verification.consumeVerificationToken).not.toHaveBeenCalled();
  });
});
