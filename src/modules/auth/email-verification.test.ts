import { beforeEach, describe, expect, it, vi } from 'vitest';

const redis = vi.hoisted(() => ({
  set: vi.fn<(...args: unknown[]) => Promise<string | null>>(),
  get: vi.fn<(key: string) => Promise<string | null>>(),
  del: vi.fn(() => Promise.resolve(1)),
}));

vi.mock('@/modules/core', () => ({ redis }));

const {
  consumeVerificationToken,
  issueVerificationToken,
  issueVerificationUrl,
  readVerificationToken,
} = await import('./email-verification');

const USER_ID = '019969a0-0000-7000-8000-000000000001';
const USER_KEY = `email-verify-user:${USER_ID}`;
const DAY = 60 * 60 * 24;
const TOKEN = 'a'.repeat(43);

beforeEach(() => {
  // `SET … GET` връща стария токен; `null` = нямаше.
  redis.set.mockReset().mockResolvedValue(null);
  redis.del.mockClear();
  redis.get.mockReset().mockResolvedValue(null);
});

describe('issueVerificationToken', () => {
  it('stores token → user and user → token with a 24h TTL', async () => {
    const token = await issueVerificationToken(USER_ID);

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(redis.set).toHaveBeenCalledWith(
      `email-verify:${token}`,
      USER_ID,
      'EX',
      DAY,
    );
    expect(redis.set).toHaveBeenCalledWith(USER_KEY, token, 'EX', DAY, 'GET');
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('kills the previous token of the same user atomically via SET GET', async () => {
    redis.set.mockResolvedValueOnce('old-token');
    await issueVerificationToken(USER_ID);
    expect(redis.del).toHaveBeenCalledWith('email-verify:old-token');
  });

  it('throws when Redis is down', async () => {
    redis.set.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(issueVerificationToken(USER_ID)).rejects.toThrow();
  });
});

describe('issueVerificationUrl', () => {
  it('builds the link on the app URL', async () => {
    const url = await issueVerificationUrl(USER_ID, 'http://localhost:3100');
    expect(url).toMatch(
      /^http:\/\/localhost:3100\/verify-email\?token=[A-Za-z0-9_-]{43}$/,
    );
  });

  it('returns null without throwing when Redis is down', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    redis.set.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(
      issueVerificationUrl(USER_ID, 'http://localhost:3100'),
    ).resolves.toBeNull();
    error.mockRestore();
  });
});

describe('readVerificationToken', () => {
  it('rejects a malformed token before Redis', async () => {
    await expect(readVerificationToken('abc')).resolves.toBeNull();
    await expect(readVerificationToken(`${TOKEN}!`)).resolves.toBeNull();
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('returns the user id for a live token and null for a dead one', async () => {
    redis.get.mockResolvedValueOnce(USER_ID);
    await expect(readVerificationToken(TOKEN)).resolves.toBe(USER_ID);
    expect(redis.get).toHaveBeenCalledWith(`email-verify:${TOKEN}`);
    await expect(readVerificationToken(TOKEN)).resolves.toBeNull();
  });

  it('returns null when Redis is down', async () => {
    redis.get.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(readVerificationToken(TOKEN)).resolves.toBeNull();
  });
});

describe('consumeVerificationToken', () => {
  it('deletes both keys in one call', async () => {
    await consumeVerificationToken(TOKEN, USER_ID);
    expect(redis.del).toHaveBeenCalledWith(`email-verify:${TOKEN}`, USER_KEY);
  });

  it('swallows a Redis failure', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    redis.del.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(
      consumeVerificationToken(TOKEN, USER_ID),
    ).resolves.toBeUndefined();
    error.mockRestore();
  });
});
