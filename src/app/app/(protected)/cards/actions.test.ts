import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Platform from '@/modules/platform';

const auth = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const platform = vi.hoisted(() => ({
  findPersonalOrganizationByOwner: vi.fn(),
  isOrgMember: vi.fn(),
  activateCard: vi.fn(),
  assignCardProfile: vi.fn(),
  claimCardByCode: vi.fn(),
  disableCardByOrg: vi.fn(),
  unassignCardProfile: vi.fn(),
}));
const rateLimit = vi.hoisted(() => ({
  consume: vi.fn(() => Promise.resolve({ allowed: true, retryAfterSec: 0 })),
}));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));

// Barrel-ът на `auth` носи `server-only`; `core` отваря пул при импорт.
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
const {
  activateFromChipAction,
  assignCardProfileAction,
  claimCardAction,
  disableCardAction,
  unassignCardAction,
} = await import('./actions');

const user = {
  id: '019969a0-0000-7000-8000-000000000001',
  email: 'k@x.bg',
  name: 'K',
};
const org = { id: '019969a0-0000-7000-8000-00000000000a', plan: 'free' };
const PROFILE = '019969a0-0000-7000-8000-0000000000b1';
const TOO_MANY = 'Твърде много опити. Опитай след 60 минути.';

beforeEach(() => {
  auth.getCurrentUser.mockReset().mockResolvedValue(user);
  platform.findPersonalOrganizationByOwner.mockReset().mockResolvedValue(org);
  platform.isOrgMember.mockReset().mockResolvedValue(true);
  for (const fn of [
    platform.activateCard,
    platform.assignCardProfile,
    platform.claimCardByCode,
    platform.disableCardByOrg,
    platform.unassignCardProfile,
  ]) {
    fn.mockReset().mockResolvedValue(undefined);
  }
  platform.activateCard.mockResolvedValue({ slug: 'ivan' });
  rateLimit.consume.mockClear();
  rateLimit.consume.mockResolvedValue({ allowed: true, retryAfterSec: 0 });
  cache.revalidatePath.mockClear();
});

describe('claimCardAction', () => {
  it('rejects a bad id or code before touching the session', async () => {
    expect(
      (await claimCardAction({ cardId: 'O1234567', code: '123456' })).ok,
    ).toBe(false);
    expect(
      (await claimCardAction({ cardId: 'ABCD2345', code: '12345' })).ok,
    ).toBe(false);
    expect(auth.getCurrentUser).not.toHaveBeenCalled();
  });

  it('redirects to /login without a session', async () => {
    auth.getCurrentUser.mockResolvedValue(null);
    await expect(
      claimCardAction({ cardId: 'ABCD2345', code: '123456' }),
    ).rejects.toThrow('REDIRECT:/login');
  });

  it('counts per user and per card, then claims in the session org', async () => {
    expect(
      await claimCardAction({ cardId: ' abcd2345 ', code: '000123' }),
    ).toEqual({ ok: true });

    expect(rateLimit.consume).toHaveBeenCalledWith(
      `rl:claim:user:${user.id}`,
      10,
      3600,
    );
    expect(rateLimit.consume).toHaveBeenCalledWith(
      'rl:claim:card:ABCD2345',
      5,
      3600,
    );
    expect(platform.claimCardByCode).toHaveBeenCalledWith(
      {},
      { cardId: 'ABCD2345', activationCode: '000123', orgId: org.id },
    );
    expect(cache.revalidatePath).toHaveBeenCalledWith('/app/cards');
  });

  it('refuses past the limit before the membership check', async () => {
    rateLimit.consume.mockResolvedValue({
      allowed: false,
      retryAfterSec: 3600,
    });
    expect(
      await claimCardAction({ cardId: 'ABCD2345', code: '123456' }),
    ).toEqual({ ok: false, message: TOO_MANY });
    expect(platform.isOrgMember).not.toHaveBeenCalled();
    expect(platform.claimCardByCode).not.toHaveBeenCalled();
  });

  it('refuses a non-member and returns the CardError message', async () => {
    platform.isOrgMember.mockResolvedValue(false);
    expect(
      (await claimCardAction({ cardId: 'ABCD2345', code: '123456' })).ok,
    ).toBe(false);
    expect(platform.claimCardByCode).not.toHaveBeenCalled();

    platform.isOrgMember.mockResolvedValue(true);
    platform.claimCardByCode.mockRejectedValue(
      new CardError('card_unclaimable'),
    );
    expect(
      await claimCardAction({ cardId: 'ABCD2345', code: '123456' }),
    ).toEqual({ ok: false, message: 'Картата или кодът не съвпадат.' });
  });

  it('hides unexpected errors behind a generic message', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    platform.claimCardByCode.mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await claimCardAction({ cardId: 'ABCD2345', code: '1' });
    expect(result.ok).toBe(false);
    const failed = await claimCardAction({
      cardId: 'ABCD2345',
      code: '123456',
    });
    if (!failed.ok) expect(failed.message).not.toContain('ECONNREFUSED');
    error.mockRestore();
  });
});

describe('assign / unassign / disable', () => {
  it('validates ids, counts per user and passes the session org', async () => {
    expect(await assignCardProfileAction('ABCD2345', 'nope')).toEqual({
      ok: false,
      message: 'Няма такава карта.',
    });
    expect((await unassignCardAction('x')).ok).toBe(false);
    expect((await disableCardAction('')).ok).toBe(false);
    expect(auth.getCurrentUser).not.toHaveBeenCalled();

    expect(await assignCardProfileAction('abcd2345', PROFILE)).toEqual({
      ok: true,
    });
    expect(platform.assignCardProfile).toHaveBeenCalledWith(
      {},
      { cardId: 'ABCD2345', orgId: org.id, profileId: PROFILE },
    );
    expect(rateLimit.consume).toHaveBeenCalledWith(
      `rl:action:user:${user.id}`,
      60,
      60,
    );

    expect(await unassignCardAction('ABCD2345')).toEqual({ ok: true });
    expect(platform.unassignCardProfile).toHaveBeenCalledWith(
      {},
      { cardId: 'ABCD2345', orgId: org.id },
    );
    expect(await disableCardAction('ABCD2345')).toEqual({ ok: true });
    expect(platform.disableCardByOrg).toHaveBeenCalledWith(
      {},
      { cardId: 'ABCD2345', orgId: org.id },
    );
    expect(cache.revalidatePath).toHaveBeenCalledTimes(3);
  });

  it('returns the CardError message for a foreign card', async () => {
    platform.unassignCardProfile.mockRejectedValue(
      new CardError('card_not_found'),
    );
    expect(await unassignCardAction('ABCD2345')).toEqual({
      ok: false,
      message: 'Няма такава карта.',
    });
  });
});

describe('activateFromChipAction', () => {
  it('activates in the session org and redirects to the profile', async () => {
    await expect(activateFromChipAction('abcd2345', PROFILE)).rejects.toThrow(
      'REDIRECT:/ivan',
    );
    expect(platform.activateCard).toHaveBeenCalledWith(
      {},
      { cardId: 'ABCD2345', orgId: org.id, profileId: PROFILE },
    );
  });

  it('returns the service refusal instead of redirecting', async () => {
    platform.activateCard.mockRejectedValue(new CardError('card_foreign_org'));
    expect(await activateFromChipAction('ABCD2345', PROFILE)).toEqual({
      ok: false,
      message: 'Картата принадлежи на друга организация.',
    });
  });

  it('redirects to /login without a session', async () => {
    auth.getCurrentUser.mockResolvedValue(null);
    await expect(activateFromChipAction('ABCD2345', PROFILE)).rejects.toThrow(
      'REDIRECT:/login',
    );
  });
});
