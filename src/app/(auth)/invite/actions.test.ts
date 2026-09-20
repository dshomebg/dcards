import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ getCurrentPublicUser: vi.fn() }));
const platform = vi.hoisted(() => ({ acceptInvitation: vi.fn() }));
const rateLimit = vi.hoisted(() => ({
  consume: vi.fn(() => Promise.resolve({ allowed: true, retryAfterSec: 0 })),
}));
const cookieStore = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
}));

// Barrel-ът на `auth` носи `server-only`; `core` отваря пул при импорт.
vi.mock('@/modules/auth', () => auth);
vi.mock('@/modules/core', async () => ({
  db: {},
  rateLimit,
  env: () => ({ NODE_ENV: 'test' }),
  clientIpFrom: () => '203.0.113.9',
  ...(await vi.importActual('@/modules/core/rate-limit/policy')),
}));
vi.mock('@/modules/platform', () => platform);
vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve(cookieStore),
  headers: () => Promise.resolve(new Headers()),
}));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const { acceptInvitationAction } = await import('./actions');

const user = {
  id: '019969a0-0000-7000-8000-000000000001',
  email: 'k@x.bg',
  name: 'K',
  emailVerifiedAt: new Date('2026-09-01'),
};
const ORG = '019969a0-0000-7000-8000-00000000000b';
const TOKEN = 'T'.repeat(43);

beforeEach(() => {
  auth.getCurrentPublicUser.mockReset().mockResolvedValue(user);
  platform.acceptInvitation
    .mockReset()
    .mockResolvedValue({ status: 'accepted', orgId: ORG });
  rateLimit.consume.mockClear();
  rateLimit.consume.mockResolvedValue({ allowed: true, retryAfterSec: 0 });
  cookieStore.set.mockClear();
});

describe('acceptInvitationAction', () => {
  it('limits by IP before the session and by user after it', async () => {
    await expect(acceptInvitationAction(TOKEN)).rejects.toThrow(
      'REDIRECT:/app',
    );
    expect(rateLimit.consume).toHaveBeenCalledWith(
      'rl:invite:ip:203.0.113.9',
      30,
      900,
    );
    expect(rateLimit.consume).toHaveBeenCalledWith(
      `rl:action:user:${user.id}`,
      60,
      60,
    );
  });

  it('refuses an unverified email: the match proves nothing without it', async () => {
    auth.getCurrentPublicUser.mockResolvedValue({
      ...user,
      emailVerifiedAt: null,
    });
    const result = await acceptInvitationAction(TOKEN);
    expect(result.ok).toBe(false);
    expect(platform.acceptInvitation).not.toHaveBeenCalled();
  });

  it('asks for a login without a session and calls nothing', async () => {
    auth.getCurrentPublicUser.mockResolvedValue(null);
    const result = await acceptInvitationAction(TOKEN);
    expect(result.ok).toBe(false);
    expect(platform.acceptInvitation).not.toHaveBeenCalled();
  });

  it('sets the org cookie and redirects on accept and on already-member', async () => {
    await expect(acceptInvitationAction(TOKEN)).rejects.toThrow(
      'REDIRECT:/app',
    );
    expect(platform.acceptInvitation).toHaveBeenCalledWith({}, TOKEN, user);
    expect(cookieStore.set).toHaveBeenCalledWith(
      'current_org',
      ORG,
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    );

    platform.acceptInvitation.mockResolvedValue({
      status: 'already_member',
      orgId: ORG,
    });
    await expect(acceptInvitationAction(TOKEN)).rejects.toThrow(
      'REDIRECT:/app',
    );
  });

  it('returns one message for invalid and another for a foreign email, without the address', async () => {
    platform.acceptInvitation.mockResolvedValue({ status: 'invalid' });
    expect(await acceptInvitationAction('bad')).toEqual({
      ok: false,
      message: 'Поканата е невалидна, изтекла или отменена.',
    });
    platform.acceptInvitation.mockResolvedValue({ status: 'email_mismatch' });
    const result = await acceptInvitationAction(TOKEN);
    expect(result).toEqual({
      ok: false,
      message: 'Поканата е за друг имейл адрес.',
    });
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it('hides a database failure and never logs the token', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    platform.acceptInvitation.mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await acceptInvitationAction(TOKEN);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(error.mock.calls)).not.toContain(TOKEN);
    error.mockRestore();
  });
});
