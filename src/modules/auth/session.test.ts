import { beforeEach, describe, expect, it, vi } from 'vitest';

const redis = vi.hoisted(() => ({
  set: vi.fn(() => Promise.resolve('OK')),
  get: vi.fn<(key: string) => Promise<string | null>>(),
  expire: vi.fn(() => Promise.resolve(1)),
  del: vi.fn(() => Promise.resolve(1)),
  sadd: vi.fn(() => Promise.resolve(1)),
  smembers: vi.fn<(key: string) => Promise<string[]>>(),
  srem: vi.fn(() => Promise.resolve(1)),
}));
const cookieStore = vi.hoisted(() => ({
  values: new Map<string, string>(),
  get(name: string) {
    const value = this.values.get(name);
    return value === undefined ? undefined : { name, value };
  },
  set(name: string, value: string) {
    this.values.set(name, value);
  },
  delete(name: string) {
    this.values.delete(name);
  },
}));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve(cookieStore),
}));
vi.mock('@/modules/core', () => ({
  redis,
  env: () => ({ NODE_ENV: 'test' }),
}));

const { createSession, readSession, revokeOtherSessions } =
  await import('./session');

const user = {
  id: '019969a0-0000-7000-8000-000000000001',
  email: 'k@x.bg',
  name: 'K',
};
const USER_KEY = `user-sessions:${user.id}`;
const WEEK = 60 * 60 * 24 * 7;

describe('createSession', () => {
  beforeEach(() => {
    cookieStore.values.clear();
    redis.set.mockClear();
    redis.sadd.mockClear();
    redis.expire.mockClear();
  });

  it('indexes the new id under the user and gives the set the session TTL', async () => {
    await createSession(user);

    const id = cookieStore.get('session')?.value;
    expect(id).toBeDefined();
    expect(redis.set).toHaveBeenCalledWith(
      `session:${id}`,
      JSON.stringify(user),
      'EX',
      WEEK,
    );
    expect(redis.sadd).toHaveBeenCalledWith(USER_KEY, id);
    expect(redis.expire).toHaveBeenCalledWith(USER_KEY, WEEK);
  });
});

describe('readSession', () => {
  beforeEach(() => {
    cookieStore.values.clear();
    cookieStore.set('session', 'abc');
    redis.get.mockReset().mockResolvedValue(JSON.stringify(user));
    redis.expire.mockReset().mockResolvedValue(1);
  });

  it('slides both the session key and the user index', async () => {
    await expect(readSession()).resolves.toEqual(user);
    expect(redis.expire).toHaveBeenCalledWith('session:abc', WEEK);
    expect(redis.expire).toHaveBeenCalledWith(USER_KEY, WEEK);
  });

  it('returns null when Redis is down', async () => {
    redis.get.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(readSession()).resolves.toBeNull();
  });
});

describe('revokeOtherSessions', () => {
  beforeEach(() => {
    cookieStore.values.clear();
    cookieStore.set('session', 'current');
    redis.del.mockClear();
    redis.srem.mockClear();
    redis.smembers.mockReset().mockResolvedValue(['old-1', 'current', 'old-2']);
  });

  it('deletes every session but the current one and prunes the index', async () => {
    await revokeOtherSessions(user.id);

    expect(redis.del).toHaveBeenCalledTimes(1);
    expect(redis.del).toHaveBeenCalledWith('session:old-1', 'session:old-2');
    expect(redis.srem).toHaveBeenCalledWith(USER_KEY, 'old-1', 'old-2');
  });

  it('touches nothing when the user has no other sessions', async () => {
    redis.smembers.mockResolvedValue(['current']);
    await revokeOtherSessions(user.id);

    expect(redis.del).not.toHaveBeenCalled();
    expect(redis.srem).not.toHaveBeenCalled();
  });
});
