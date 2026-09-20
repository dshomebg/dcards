import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  changePassword: vi.fn(),
  revokeOtherSessions: vi.fn(),
}));
const platform = vi.hoisted(() => ({
  findPersonalOrganizationByOwner: vi.fn(),
}));
const rateLimit = vi.hoisted(() => ({
  consume: vi.fn<
    (key: string) => Promise<{ allowed: boolean; retryAfterSec: number }>
  >(() => Promise.resolve({ allowed: true, retryAfterSec: 0 })),
}));

// Barrel-ът на `auth` носи `server-only`; `core` отваря пул при импорт.
// Схемата е истинска, за да е тя, която спира лошия вход.
vi.mock('@/modules/auth', async () => ({
  ...(await vi.importActual('@/modules/auth/schema')),
  ...auth,
}));
vi.mock('@/modules/core', async () => ({
  db: {},
  rateLimit,
  ...(await vi.importActual('@/modules/core/rate-limit/policy')),
}));
vi.mock('@/modules/platform', () => platform);
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const { changePasswordAction } = await import('./actions');

const user = {
  id: '019969a0-0000-7000-8000-000000000001',
  email: 'k@x.bg',
  name: 'K',
};
const org = { id: '019969a0-0000-7000-8000-00000000000a', plan: 'free' };
const input = {
  currentPassword: 'old-secret-1',
  newPassword: 'new-secret-22',
  confirmPassword: 'new-secret-22',
};

describe('changePasswordAction', () => {
  beforeEach(() => {
    auth.getCurrentUser.mockReset().mockResolvedValue(user);
    auth.changePassword.mockReset().mockResolvedValue('ok');
    auth.revokeOtherSessions.mockReset().mockResolvedValue(undefined);
    platform.findPersonalOrganizationByOwner.mockReset().mockResolvedValue(org);
    rateLimit.consume.mockClear();
    rateLimit.consume.mockResolvedValue({ allowed: true, retryAfterSec: 0 });
  });

  it('rejects invalid input before touching the session', async () => {
    const result = await changePasswordAction({
      ...input,
      confirmPassword: 'other',
    });
    expect(result).toEqual({ ok: false, message: 'Паролите не съвпадат.' });
    expect(auth.getCurrentUser).not.toHaveBeenCalled();
    expect(auth.changePassword).not.toHaveBeenCalled();
  });

  it('redirects to /login without a session', async () => {
    auth.getCurrentUser.mockResolvedValue(null);
    await expect(changePasswordAction(input)).rejects.toThrow(
      'REDIRECT:/login',
    );
    expect(auth.changePassword).not.toHaveBeenCalled();
  });

  it('counts every attempt per user with the password policy, even a successful one', async () => {
    await changePasswordAction(input);
    expect(rateLimit.consume).toHaveBeenCalledWith(
      `rl:action:user:${user.id}`,
      60,
      60,
    );
    expect(rateLimit.consume).toHaveBeenCalledWith(
      `rl:password:user:${user.id}`,
      5,
      900,
    );
  });

  it('refuses a limited user before the service runs', async () => {
    rateLimit.consume.mockImplementation((key: string) =>
      Promise.resolve(
        key.startsWith('rl:password:')
          ? { allowed: false, retryAfterSec: 700 }
          : { allowed: true, retryAfterSec: 0 },
      ),
    );
    const result = await changePasswordAction(input);
    expect(result).toEqual({
      ok: false,
      message: 'Твърде много опити. Опитай след 12 минути.',
    });
    expect(auth.changePassword).not.toHaveBeenCalled();
  });

  it('reports a wrong current password with the exact message', async () => {
    auth.changePassword.mockResolvedValue('wrong_current');
    const result = await changePasswordAction(input);
    expect(result).toEqual({
      ok: false,
      message: 'Текущата парола не е вярна.',
    });
    expect(auth.revokeOtherSessions).not.toHaveBeenCalled();
  });

  it('asks for a fresh login when the account row is gone', async () => {
    auth.changePassword.mockResolvedValue('not_found');
    const result = await changePasswordAction(input);
    expect(result).toEqual({
      ok: false,
      message: 'Акаунтът не е намерен — влез отново.',
    });
  });

  it('calls the service for the current user and revokes the other sessions once', async () => {
    const result = await changePasswordAction(input);
    expect(result).toEqual({ ok: true });
    expect(auth.changePassword).toHaveBeenCalledWith(
      {},
      user.id,
      expect.objectContaining({
        currentPassword: 'old-secret-1',
        newPassword: 'new-secret-22',
      }),
    );
    expect(auth.revokeOtherSessions).toHaveBeenCalledTimes(1);
    expect(auth.revokeOtherSessions).toHaveBeenCalledWith(user.id);
  });

  it('hides unexpected errors behind a generic message and never logs the input', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    auth.changePassword.mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await changePasswordAction(input);
    expect(result).toEqual({
      ok: false,
      message: 'Паролата не беше сменена — опитай пак след малко.',
    });
    const logged = JSON.stringify(error.mock.calls);
    expect(logged).not.toContain('old-secret-1');
    expect(logged).not.toContain('new-secret-22');
    expect(auth.revokeOtherSessions).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('keeps the success when revoking the other sessions fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    auth.revokeOtherSessions.mockRejectedValue(new Error('Redis down'));
    const result = await changePasswordAction(input);
    expect(result).toEqual({ ok: true });
    expect(JSON.stringify(error.mock.calls)).not.toContain('old-secret-1');
    error.mockRestore();
  });
});
