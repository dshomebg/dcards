import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Platform from '@/modules/platform';

const auth = vi.hoisted(() => ({ getCurrentAdmin: vi.fn() }));
const platform = vi.hoisted(() => ({
  detachCardProfile: vi.fn(),
  disableCard: vi.fn(),
}));
const rateLimit = vi.hoisted(() => ({
  consume: vi.fn(() => Promise.resolve({ allowed: true, retryAfterSec: 0 })),
}));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));

vi.mock('@/modules/auth', () => auth);
vi.mock('@/modules/core', async () => ({
  db: {},
  rateLimit,
  ...(await vi.importActual('@/modules/core/rate-limit/policy')),
}));
vi.mock('@/modules/platform', async (importOriginal) => ({
  ...(await importOriginal<typeof Platform>()),
  ...platform,
}));
vi.mock('next/cache', () => cache);
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const { CardError } = await import('@/modules/platform');
const { detachCardAction, disableCardAction } = await import('./actions');

const admin = {
  id: '019969a0-0000-7000-8000-000000000001',
  email: 'a@x.bg',
  name: 'A',
};

beforeEach(() => {
  auth.getCurrentAdmin.mockReset().mockResolvedValue(admin);
  platform.detachCardProfile.mockReset().mockResolvedValue(undefined);
  platform.disableCard.mockReset().mockResolvedValue(undefined);
  rateLimit.consume.mockClear();
  rateLimit.consume.mockResolvedValue({ allowed: true, retryAfterSec: 0 });
  cache.revalidatePath.mockClear();
});

describe('card actions', () => {
  it('rejects an id outside the alphabet before touching the session', async () => {
    expect(await detachCardAction('O1234567')).toEqual({
      ok: false,
      message: 'Няма такава карта.',
    });
    expect((await disableCardAction('')).ok).toBe(false);
    expect(auth.getCurrentAdmin).not.toHaveBeenCalled();
    expect(platform.detachCardProfile).not.toHaveBeenCalled();
    expect(platform.disableCard).not.toHaveBeenCalled();
  });

  it('redirects to /admin/login without an admin', async () => {
    auth.getCurrentAdmin.mockResolvedValue(null);
    await expect(detachCardAction('ABCD2345')).rejects.toThrow(
      'REDIRECT:/admin/login',
    );
    await expect(disableCardAction('ABCD2345')).rejects.toThrow(
      'REDIRECT:/admin/login',
    );
  });

  it('counts per admin and refuses past the limit', async () => {
    rateLimit.consume.mockResolvedValue({ allowed: false, retryAfterSec: 20 });
    expect(await disableCardAction('ABCD2345')).toEqual({
      ok: false,
      message: 'Твърде много опити. Опитай след 1 минути.',
    });
    expect(rateLimit.consume).toHaveBeenCalledWith(
      `rl:action:user:${admin.id}`,
      60,
      60,
    );
    expect(platform.disableCard).not.toHaveBeenCalled();
  });

  it('upper-cases the id, calls the service and revalidates', async () => {
    expect(await detachCardAction(' abcd2345 ')).toEqual({ ok: true });
    expect(platform.detachCardProfile).toHaveBeenCalledWith({}, 'ABCD2345');

    expect(await disableCardAction('abcd2345')).toEqual({ ok: true });
    expect(platform.disableCard).toHaveBeenCalledWith({}, 'ABCD2345');
    expect(cache.revalidatePath).toHaveBeenCalledWith('/admin/cards');
  });

  it('returns the CardError message and hides unexpected errors', async () => {
    platform.disableCard.mockRejectedValue(new CardError('card_not_found'));
    expect(await disableCardAction('ABCD2345')).toEqual({
      ok: false,
      message: 'Няма такава карта.',
    });

    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    platform.detachCardProfile.mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await detachCardAction('ABCD2345');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).not.toContain('ECONNREFUSED');
    error.mockRestore();
  });
});
