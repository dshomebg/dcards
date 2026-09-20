import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Platform from '@/modules/platform';

const auth = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const platform = vi.hoisted(() => ({
  findMembership: vi.fn(),
  findPersonalOrganizationByOwner: vi.fn(),
  createInvitation: vi.fn(),
  resendInvitation: vi.fn(),
  cancelInvitation: vi.fn(),
  removeMember: vi.fn(),
  renameOrganization: vi.fn(),
}));
const rateLimit = vi.hoisted(() => ({
  consume: vi.fn<
    (key: string) => Promise<{ allowed: boolean; retryAfterSec: number }>
  >(() => Promise.resolve({ allowed: true, retryAfterSec: 0 })),
}));
const mail = vi.hoisted(() => ({ sendMail: vi.fn().mockResolvedValue(true) }));
const cookieStore = vi.hoisted(() => ({
  get: vi.fn<(name: string) => { value: string } | undefined>(),
}));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));

// Barrel-ът на `auth` носи `server-only`; `core` отваря пул при импорт.
vi.mock('@/modules/auth', () => auth);
vi.mock('@/modules/core', async () => ({
  db: {},
  rateLimit,
  env: () => ({ APP_NAME: 'DCARDS', APP_URL: 'http://localhost:3100' }),
  sendMail: mail.sendMail,
  ...(await vi.importActual('@/modules/core/rate-limit/policy')),
}));
vi.mock('@/modules/platform', async (importOriginal) => ({
  ...(await importOriginal<typeof Platform>()),
  ...platform,
}));
vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve(cookieStore),
}));
vi.mock('next/cache', () => cache);
vi.mock('next/server', () => ({ after: (fn: () => Promise<void>) => fn() }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const { OrganizationError } = await import('@/modules/platform');
const {
  cancelInvitationAction,
  inviteMemberAction,
  removeMemberAction,
  renameOrganizationAction,
  resendInvitationAction,
} = await import('./actions');

const user = {
  id: '019969a0-0000-7000-8000-000000000001',
  email: 'k@x.bg',
  name: 'K',
};
const org = {
  id: '019969a0-0000-7000-8000-00000000000a',
  name: 'Студио',
  plan: 'pro',
  planExpiresAt: null,
};
const INVITATION = '019969a0-0000-7000-8000-0000000000c1';
const MEMBER = '019969a0-0000-7000-8000-0000000000d1';
const TOKEN = 'T'.repeat(43);

function asEditor(): void {
  cookieStore.get.mockReturnValue({ value: org.id });
  platform.findMembership.mockResolvedValue({ org, role: 'editor' });
}

beforeEach(() => {
  auth.getCurrentUser.mockReset().mockResolvedValue(user);
  platform.findMembership.mockReset().mockResolvedValue(null);
  platform.findPersonalOrganizationByOwner.mockReset().mockResolvedValue(org);
  platform.createInvitation.mockReset().mockResolvedValue({
    id: INVITATION,
    email: 'guest@x.bg',
    token: TOKEN,
    expiresAt: new Date(),
  });
  platform.resendInvitation.mockReset().mockResolvedValue({
    id: INVITATION,
    email: 'guest@x.bg',
    token: TOKEN,
    expiresAt: new Date(),
  });
  platform.cancelInvitation.mockReset().mockResolvedValue(undefined);
  platform.removeMember.mockReset().mockResolvedValue(true);
  platform.renameOrganization.mockReset().mockResolvedValue(true);
  cookieStore.get.mockReset().mockReturnValue(undefined);
  rateLimit.consume.mockClear();
  rateLimit.consume.mockResolvedValue({ allowed: true, retryAfterSec: 0 });
  mail.sendMail.mockClear();
  cache.revalidatePath.mockClear();
});

describe('owner gate', () => {
  it('refuses every action for an editor before any service call', async () => {
    asEditor();
    await expect(renameOrganizationAction({ name: 'X Y' })).rejects.toThrow(
      'REDIRECT:/app',
    );
    await expect(inviteMemberAction({ email: 'g@x.bg' })).rejects.toThrow(
      'REDIRECT:/app',
    );
    await expect(resendInvitationAction(INVITATION)).rejects.toThrow(
      'REDIRECT:/app',
    );
    await expect(cancelInvitationAction(INVITATION)).rejects.toThrow(
      'REDIRECT:/app',
    );
    await expect(removeMemberAction(MEMBER)).rejects.toThrow('REDIRECT:/app');

    for (const fn of Object.values(platform).slice(2)) {
      expect(fn).not.toHaveBeenCalled();
    }
    expect(mail.sendMail).not.toHaveBeenCalled();
  });

  it('redirects to /login without a session', async () => {
    auth.getCurrentUser.mockResolvedValue(null);
    await expect(inviteMemberAction({ email: 'g@x.bg' })).rejects.toThrow(
      'REDIRECT:/login',
    );
  });
});

describe('inviteMemberAction', () => {
  it('rejects a bad email before touching the session', async () => {
    const result = await inviteMemberAction({ email: 'nope' });
    expect(result).toEqual({ ok: false, message: 'Въведи валиден имейл.' });
    expect(auth.getCurrentUser).not.toHaveBeenCalled();
  });

  it('creates the invitation in the current org and mails the link without the email', async () => {
    expect(await inviteMemberAction({ email: 'Guest@x.bg' })).toEqual({
      ok: true,
    });
    expect(platform.createInvitation).toHaveBeenCalledWith(
      {},
      { org, inviter: { id: user.id, email: user.email }, email: 'Guest@x.bg' },
    );
    expect(mail.sendMail).toHaveBeenCalledOnce();
    const sent = mail.sendMail.mock.calls[0]?.[0] as {
      to: string;
      text: string;
    };
    expect(sent.to).toBe('guest@x.bg');
    expect(sent.text).toContain(`http://localhost:3100/invite?token=${TOKEN}`);
    expect(sent.text).not.toContain('guest@x.bg');
    expect(cache.revalidatePath).toHaveBeenCalledWith('/app/org');
  });

  it('counts per user and 10/h per org', async () => {
    await inviteMemberAction({ email: 'g@x.bg' });
    expect(rateLimit.consume).toHaveBeenCalledWith(
      `rl:action:user:${user.id}`,
      60,
      60,
    );
    expect(rateLimit.consume).toHaveBeenCalledWith(
      `rl:invite:org:${org.id}`,
      10,
      3600,
    );
  });

  it('refuses past the org limit before the service and the mail', async () => {
    rateLimit.consume.mockImplementation((key: string) =>
      Promise.resolve(
        key.startsWith('rl:invite:')
          ? { allowed: false, retryAfterSec: 3600 }
          : { allowed: true, retryAfterSec: 0 },
      ),
    );
    expect(await inviteMemberAction({ email: 'g@x.bg' })).toEqual({
      ok: false,
      message: 'Твърде много опити. Опитай след 60 минути.',
    });
    expect(platform.createInvitation).not.toHaveBeenCalled();
    expect(mail.sendMail).not.toHaveBeenCalled();
  });

  it('returns the plan message on Free and sends nothing', async () => {
    platform.createInvitation.mockRejectedValue(
      new OrganizationError('plan_limit_members'),
    );
    expect(await inviteMemberAction({ email: 'g@x.bg' })).toEqual({
      ok: false,
      message: 'Поканите за членове са част от плана Pro.',
    });
    expect(mail.sendMail).not.toHaveBeenCalled();
  });

  it('hides unexpected errors and never logs the email or token', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    platform.createInvitation.mockRejectedValue(new Error('guest@x.bg'));
    const result = await inviteMemberAction({ email: 'guest@x.bg' });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(error.mock.calls)).not.toContain('guest@x.bg');
    error.mockRestore();
  });
});

describe('resend / cancel / remove', () => {
  it('resends with a fresh token and counts against the org limit', async () => {
    expect(await resendInvitationAction(INVITATION)).toEqual({ ok: true });
    expect(platform.resendInvitation).toHaveBeenCalledWith(
      {},
      org.id,
      INVITATION,
    );
    expect(mail.sendMail).toHaveBeenCalledOnce();
    expect(rateLimit.consume).toHaveBeenCalledWith(
      `rl:invite:org:${org.id}`,
      10,
      3600,
    );
  });

  it('cancels only in the current org and reports a missing row', async () => {
    expect(await cancelInvitationAction(INVITATION)).toEqual({ ok: true });
    expect(platform.cancelInvitation).toHaveBeenCalledWith(
      {},
      org.id,
      INVITATION,
    );
    expect(await cancelInvitationAction('nope')).toEqual({
      ok: false,
      message: 'Записът не съществува.',
    });
  });

  it('removes a member and refuses the owner (repository says false)', async () => {
    expect(await removeMemberAction(MEMBER)).toEqual({ ok: true });
    expect(platform.removeMember).toHaveBeenCalledWith({}, org.id, MEMBER);

    platform.removeMember.mockResolvedValue(false);
    expect(await removeMemberAction(user.id)).toEqual({
      ok: false,
      message: 'Този член не е в организацията.',
    });
  });

  it('renames with the schema bounds', async () => {
    expect(await renameOrganizationAction({ name: ' A ' })).toEqual({
      ok: false,
      message: 'Името трябва да е поне 2 знака.',
    });
    expect(await renameOrganizationAction({ name: ' Ново ' })).toEqual({
      ok: true,
    });
    expect(platform.renameOrganization).toHaveBeenCalledWith(
      {},
      org.id,
      'Ново',
    );
  });
});
