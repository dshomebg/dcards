import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createLimiter, type RateLimitStore } from './limiter';

// Фалшив store: брои в паметта, `ttl` е фиксиран — проверяват се командите, не Redis.
function fakeStore(ttl = 42) {
  const counts = new Map<string, number>();
  const store = {
    incr: vi.fn((key: string) => {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return Promise.resolve(next);
    }),
    expire: vi.fn(() => Promise.resolve(1)),
    ttl: vi.fn(() => Promise.resolve(ttl)),
  };
  return store as unknown as RateLimitStore & typeof store;
}

describe('createLimiter', () => {
  const error = vi.fn();

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(error);
    error.mockClear();
  });
  afterEach(() => vi.restoreAllMocks());

  it('allows up to the limit and sets the window only on the first hit', async () => {
    const store = fakeStore();
    const limiter = createLimiter(store);

    for (let i = 0; i < 3; i += 1) {
      await expect(limiter.consume('k', 3, 60)).resolves.toEqual({
        allowed: true,
        retryAfterSec: 0,
      });
    }
    expect(store.expire).toHaveBeenCalledTimes(3);
    expect(store.expire).toHaveBeenCalledWith('k', 60, 'NX');
    expect(store.ttl).not.toHaveBeenCalled();
  });

  it('refuses past the limit with the remaining TTL as retryAfterSec', async () => {
    const store = fakeStore(42);
    const limiter = createLimiter(store);

    for (let i = 0; i < 3; i += 1) await limiter.consume('k', 3, 60);
    await expect(limiter.consume('k', 3, 60)).resolves.toEqual({
      allowed: false,
      retryAfterSec: 42,
    });
    expect(store.ttl).toHaveBeenCalledWith('k');
  });

  it('falls back to the window when the key has no TTL', async () => {
    const store = fakeStore(-1);
    const limiter = createLimiter(store);

    await limiter.consume('k', 1, 60);
    await expect(limiter.consume('k', 1, 60)).resolves.toEqual({
      allowed: false,
      retryAfterSec: 60,
    });
  });

  it('counts each key on its own', async () => {
    const store = fakeStore();
    const limiter = createLimiter(store);

    await limiter.consume('a', 1, 60);
    await expect(limiter.consume('b', 1, 60)).resolves.toMatchObject({
      allowed: true,
    });
    await expect(limiter.consume('a', 1, 60)).resolves.toMatchObject({
      allowed: false,
    });
  });

  it('fails open and logs when the store throws', async () => {
    const store = fakeStore();
    store.incr.mockRejectedValue(new Error('ECONNREFUSED'));
    const limiter = createLimiter(store);

    await expect(limiter.consume('k', 1, 60)).resolves.toEqual({
      allowed: true,
      retryAfterSec: 0,
    });
    expect(error).toHaveBeenCalledWith(
      'rate-limit: store unavailable',
      expect.any(Error),
    );
  });

  it('fails open quickly when the store hangs', async () => {
    vi.useFakeTimers();
    const hanging = {
      incr: () => new Promise<number>(() => undefined),
    } as never;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const pending = createLimiter(hanging).consume('rl:x', 1, 60);
    await vi.advanceTimersByTimeAsync(300);
    await expect(pending).resolves.toEqual({ allowed: true, retryAfterSec: 0 });
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
    vi.useRealTimers();
  });
});
