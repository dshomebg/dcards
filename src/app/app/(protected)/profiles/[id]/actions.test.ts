import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Platform from '@/modules/platform';

const auth = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const platform = vi.hoisted(() => ({
  findPersonalOrganizationByOwner: vi.fn(),
  isOrgMember: vi.fn(),
  updateProfile: vi.fn(),
  replaceProfileLinks: vi.fn(),
  deleteProfile: vi.fn(),
}));

// Barrel-ът на `auth` носи `server-only`; `core` отваря пул при импорт.
vi.mock('@/modules/auth', () => auth);
vi.mock('@/modules/core', () => ({
  db: { transaction: (fn: (tx: object) => unknown) => fn({}) },
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
const { deleteProfileAction, saveProfileAction } = await import('./actions');

const user = {
  id: '019969a0-0000-7000-8000-000000000001',
  email: 'k@x.bg',
  name: 'K',
};
const org = { id: '019969a0-0000-7000-8000-00000000000a', plan: 'free' };
const profileId = '019969a0-0000-7000-8000-0000000000aa';

const input = {
  slug: 'kiril',
  firstName: 'Кирил',
  lastName: 'Иванов',
  title: '',
  company: 'Демо',
  bio: '',
  theme: { preset: 'dark', primaryColor: null, layout: 'default' },
  isPublic: true,
  links: [
    { type: 'email', label: '', value: 'k@x.bg', isVisible: true },
    { type: 'phone', label: 'Мобилен', value: '1', isVisible: false },
  ],
};

const updated = {
  id: profileId,
  slug: 'kiril',
  firstName: 'Кирил',
  lastName: 'Иванов',
  title: null,
  company: 'Демо',
  bio: null,
  theme: input.theme,
  isPublic: true,
  updatedAt: new Date(),
  links: [],
};
const savedLinks = [
  { id: 'l1', type: 'email', label: null, value: 'k@x.bg', isVisible: true },
];

beforeEach(() => {
  auth.getCurrentUser.mockReset().mockResolvedValue(user);
  platform.findPersonalOrganizationByOwner.mockReset().mockResolvedValue(org);
  platform.isOrgMember.mockReset().mockResolvedValue(true);
  platform.updateProfile.mockReset().mockResolvedValue(updated);
  platform.replaceProfileLinks.mockReset().mockResolvedValue(savedLinks);
  platform.deleteProfile.mockReset().mockResolvedValue(undefined);
});

describe('saveProfileAction', () => {
  it('rejects a non-UUID profileId before touching the session', async () => {
    const result = await saveProfileAction('abc', input);
    expect(result).toEqual({ ok: false, message: 'Профилът не съществува.' });
    expect(auth.getCurrentUser).not.toHaveBeenCalled();
  });

  it('rejects invalid input before touching the session', async () => {
    const result = await saveProfileAction(profileId, { ...input, slug: 'Ab' });
    expect(result.ok).toBe(false);
    expect(auth.getCurrentUser).not.toHaveBeenCalled();
  });

  it('redirects to /login without a session', async () => {
    auth.getCurrentUser.mockResolvedValue(null);
    await expect(saveProfileAction(profileId, input)).rejects.toThrow(
      'REDIRECT:/login',
    );
    expect(platform.updateProfile).not.toHaveBeenCalled();
  });

  it('refuses a user who is not a member of the organization', async () => {
    platform.isOrgMember.mockResolvedValue(false);
    const result = await saveProfileAction(profileId, input);
    expect(result.ok).toBe(false);
    expect(platform.updateProfile).not.toHaveBeenCalled();
  });

  it('returns the ProfileError message, not a 404', async () => {
    platform.updateProfile.mockRejectedValue(
      new ProfileError('profile_not_found'),
    );
    const result = await saveProfileAction(profileId, input);
    expect(result).toEqual({ ok: false, message: 'Профилът не съществува.' });
    expect(platform.replaceProfileLinks).not.toHaveBeenCalled();
  });

  it('hides unexpected errors behind a generic message', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    platform.replaceProfileLinks.mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await saveProfileAction(profileId, input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).not.toContain('ECONNREFUSED');
    error.mockRestore();
  });

  it('saves fields and links in one transaction with the server org; empty → null', async () => {
    const result = await saveProfileAction(profileId, {
      ...input,
      orgId: 'forged',
    });
    expect(result).toEqual({
      ok: true,
      profile: { ...updated, links: savedLinks },
    });
    expect(platform.isOrgMember).toHaveBeenCalledWith(
      expect.anything(),
      org.id,
      user.id,
    );
    // `{}` е `tx` от мока на `db.transaction` — сервизите делят една транзакция.
    expect(platform.updateProfile).toHaveBeenCalledWith({}, org.id, profileId, {
      slug: 'kiril',
      firstName: 'Кирил',
      lastName: 'Иванов',
      title: null,
      company: 'Демо',
      bio: null,
      theme: input.theme,
      isPublic: true,
    });
    expect(platform.replaceProfileLinks).toHaveBeenCalledWith(
      {},
      org.id,
      profileId,
      [
        { type: 'email', value: 'k@x.bg', label: null, isVisible: true },
        { type: 'phone', value: '1', label: 'Мобилен', isVisible: false },
      ],
    );
  });
});

describe('deleteProfileAction', () => {
  it('rejects a non-UUID profileId before touching the session', async () => {
    const result = await deleteProfileAction('abc');
    expect(result.ok).toBe(false);
    expect(auth.getCurrentUser).not.toHaveBeenCalled();
  });

  it('redirects to /login without a session', async () => {
    auth.getCurrentUser.mockResolvedValue(null);
    await expect(deleteProfileAction(profileId)).rejects.toThrow(
      'REDIRECT:/login',
    );
  });

  it('returns the ProfileError message for a foreign profile', async () => {
    platform.deleteProfile.mockRejectedValue(
      new ProfileError('profile_not_found'),
    );
    const result = await deleteProfileAction(profileId);
    expect(result).toEqual({ ok: false, message: 'Профилът не съществува.' });
  });

  it('deletes with the server org and redirects to /app', async () => {
    await expect(deleteProfileAction(profileId)).rejects.toThrow(
      'REDIRECT:/app',
    );
    expect(platform.deleteProfile).toHaveBeenCalledWith(
      { transaction: expect.any(Function) as unknown },
      org.id,
      profileId,
    );
  });
});
