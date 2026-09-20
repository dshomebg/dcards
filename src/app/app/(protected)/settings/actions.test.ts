import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  changePassword: vi.fn(),
  revokeOtherSessions: vi.fn(),
  findUserById: vi.fn(),
  issueVerificationUrl: vi.fn(),
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
  ...(await vi.importActual('@/modules/auth/account-mail')),
  ...auth,
}));
const mail = vi.hoisted(() => ({ sendMail: vi.fn().mockResolvedValue(true) }));
vi.mock('@/modules/core', async () => ({
  db: {},
  rateLimit,
  env: () => ({ APP_NAME: 'DCARDS', APP_URL: 'http://localhost:3100' }),
  sendMail: mail.sendMail,
  ...(await vi.importActual('@/modules/core/rate-limit/policy')),
}));
vi.mock('next/server', () => ({ after: (fn: () => Promise<void>) => fn() }));
vi.mock('@/modules/platform', () => platform);
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const { changePasswordAction, resendVerificationAction } =
  await import('./actions');

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
    mail.sendMail.mockClear();
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
    expect(mail.sendMail).toHaveBeenCalledOnce();
    expect(mail.sendMail.mock.calls[0]?.[0]).toMatchObject({ to: user.email });
    expect(mail.sendMail.mock.calls[0]?.[0].text).not.toContain('new-secret');
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

describe('resendVerificationAction', () => {
  const account = {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerifiedAt: null,
    isAdmin: false,
    createdAt: new Date(),
  };
  const VERIFY_URL = 'http://localhost:3100/verify-email?token=TOKEN';

  beforeEach(() => {
    auth.getCurrentUser.mockReset().mockResolvedValue(user);
    auth.findUserById.mockReset().mockResolvedValue(account);
    auth.issueVerificationUrl.mockReset().mockResolvedValue(VERIFY_URL);
    platform.findPersonalOrganizationByOwner.mockReset().mockResolvedValue(org);
    rateLimit.consume.mockReset();
    rateLimit.consume.mockResolvedValue({ allowed: true, retryAfterSec: 0 });
    mail.sendMail.mockClear();
  });

  it('redirects to /login without a session', async () => {
    auth.getCurrentUser.mockResolvedValue(null);
    await expect(resendVerificationAction()).rejects.toThrow('REDIRECT:/login');
    expect(auth.issueVerificationUrl).not.toHaveBeenCalled();
  });

  it('issues a fresh token and mails the link without the email in the body', async () => {
    await expect(resendVerificationAction()).resolves.toEqual({ ok: true });
    expect(auth.issueVerificationUrl).toHaveBeenCalledWith(
      user.id,
      'http://localhost:3100',
    );
    expect(mail.sendMail).toHaveBeenCalledOnce();
    const sent = mail.sendMail.mock.calls[0]?.[0] as {
      to: string;
      text: string;
    };
    expect(sent.to).toBe(user.email);
    expect(sent.text).toContain(VERIFY_URL);
    expect(sent.text).not.toContain(user.email);
  });

  it('counts every attempt per user with the resend policy', async () => {
    await resendVerificationAction();
    expect(rateLimit.consume).toHaveBeenCalledWith(
      `rl:action:user:${user.id}`,
      60,
      60,
    );
    expect(rateLimit.consume).toHaveBeenCalledWith(
      `rl:verify-resend:user:${user.id}`,
      3,
      3600,
    );
  });

  it('refuses a limited user before the token and the mail', async () => {
    rateLimit.consume.mockImplementation((key: string) =>
      Promise.resolve(
        key.startsWith('rl:verify-resend:')
          ? { allowed: false, retryAfterSec: 3600 }
          : { allowed: true, retryAfterSec: 0 },
      ),
    );
    await expect(resendVerificationAction()).resolves.toEqual({
      ok: false,
      message: 'Твърде много опити. Опитай след 60 минути.',
    });
    expect(auth.issueVerificationUrl).not.toHaveBeenCalled();
    expect(mail.sendMail).not.toHaveBeenCalled();
  });

  it('sends nothing to an already verified user', async () => {
    auth.findUserById.mockResolvedValue({
      ...account,
      emailVerifiedAt: new Date(),
    });
    await expect(resendVerificationAction()).resolves.toEqual({
      ok: false,
      message: 'Имейлът вече е потвърден.',
    });
    expect(auth.issueVerificationUrl).not.toHaveBeenCalled();
    expect(mail.sendMail).not.toHaveBeenCalled();
  });

  it('reports a Redis failure instead of mailing a dead link', async () => {
    auth.issueVerificationUrl.mockResolvedValue(null);
    const result = await resendVerificationAction();
    expect(result.ok).toBe(false);
    expect(mail.sendMail).not.toHaveBeenCalled();
  });

  it('hides a database failure behind a generic message', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    auth.findUserById.mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await resendVerificationAction();
    expect(result.ok).toBe(false);
    expect(mail.sendMail).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
