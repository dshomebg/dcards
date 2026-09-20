import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Platform from '@/modules/platform';

const auth = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const platform = vi.hoisted(() => ({
  findPersonalOrganizationByOwner: vi.fn(),
  isOrgMember: vi.fn(),
  createProfile: vi.fn(),
}));
const rateLimit = vi.hoisted(() => ({
  consume: vi.fn(() => Promise.resolve({ allowed: true, retryAfterSec: 0 })),
}));

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
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const { ProfileError } = await import('@/modules/platform');
const { createProfileAction } = await import('./actions');

const user = {
  id: '019969a0-0000-7000-8000-000000000001',
  email: 'k@x.bg',
  name: 'K',
};
const org = { id: '019969a0-0000-7000-8000-00000000000a', plan: 'free' };
const input = { slug: 'kiril', firstName: 'Кирил', lastName: 'Иванов' };

describe('createProfileAction', () => {
  beforeEach(() => {
    auth.getCurrentUser.mockReset().mockResolvedValue(user);
    platform.findPersonalOrganizationByOwner.mockReset().mockResolvedValue(org);
    platform.isOrgMember.mockReset().mockResolvedValue(true);
    platform.createProfile.mockReset().mockResolvedValue({ id: 'p1' });
    rateLimit.consume.mockClear();
    rateLimit.consume.mockResolvedValue({ allowed: true, retryAfterSec: 0 });
  });

  it('counts the action per user after the session check', async () => {
    await expect(createProfileAction(input)).rejects.toThrow('REDIRECT:/app');
    expect(rateLimit.consume).toHaveBeenCalledWith(
      `rl:action:user:${user.id}`,
      60,
      60,
    );
  });

  it('refuses a limited user before the membership check', async () => {
    rateLimit.consume.mockResolvedValue({ allowed: false, retryAfterSec: 40 });
    const result = await createProfileAction(input);
    expect(result).toEqual({
      ok: false,
      message: 'Твърде много опити. Опитай след 1 минути.',
    });
    expect(platform.isOrgMember).not.toHaveBeenCalled();
    expect(platform.createProfile).not.toHaveBeenCalled();
  });

  it('rejects invalid input before touching the session', async () => {
    const result = await createProfileAction({ ...input, slug: 'Ab' });
    expect(result.ok).toBe(false);
    expect(auth.getCurrentUser).not.toHaveBeenCalled();
  });

  it('redirects to /login without a session', async () => {
    auth.getCurrentUser.mockResolvedValue(null);
    await expect(createProfileAction(input)).rejects.toThrow('REDIRECT:/login');
    expect(platform.createProfile).not.toHaveBeenCalled();
  });

  it('refuses a user who is not a member of the organization', async () => {
    platform.isOrgMember.mockResolvedValue(false);
    const result = await createProfileAction(input);
    expect(result.ok).toBe(false);
    expect(platform.createProfile).not.toHaveBeenCalled();
  });

  it('returns the ProfileError message for a plan limit', async () => {
    platform.createProfile.mockRejectedValue(
      new ProfileError('plan_limit_profiles'),
    );
    const result = await createProfileAction(input);
    expect(result).toEqual({
      ok: false,
      message: 'Планът Free позволява един профил.',
    });
  });

  it('hides unexpected errors behind a generic message', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    platform.createProfile.mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await createProfileAction(input);
    expect(result.ok).toBe(false);
    expect(result.message).not.toContain('ECONNREFUSED');
    error.mockRestore();
  });

  it('returns to the card after creation and ignores an invalid card id', async () => {
    await expect(createProfileAction(input, 'abcd2345')).rejects.toThrow(
      'REDIRECT:/c/ABCD2345',
    );
    await expect(createProfileAction(input, 'O1234567')).rejects.toThrow(
      'REDIRECT:/app',
    );
    await expect(createProfileAction(input, null)).rejects.toThrow(
      'REDIRECT:/app',
    );
  });

  it('takes the org from the server, ignoring one in the input, and redirects', async () => {
    await expect(
      createProfileAction({ ...input, orgId: 'forged' }),
    ).rejects.toThrow('REDIRECT:/app');
    expect(platform.isOrgMember).toHaveBeenCalledWith({}, org.id, user.id);
    expect(platform.createProfile).toHaveBeenCalledWith(
      {},
      {
        orgId: org.id,
        ...input,
      },
    );
  });
});
