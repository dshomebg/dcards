import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const platform = vi.hoisted(() => ({
  findMembership: vi.fn(),
  findPersonalOrganizationByOwner: vi.fn(),
}));
const cookieStore = vi.hoisted(() => ({
  get: vi.fn<(name: string) => { value: string } | undefined>(),
}));

// Barrel-ът на `auth` носи `server-only`; `core` отваря пул при импорт.
vi.mock('@/modules/auth', () => auth);
vi.mock('@/modules/core', () => ({
  db: {},
  env: () => ({ NODE_ENV: 'test' }),
}));
vi.mock('@/modules/platform', () => platform);
vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve(cookieStore),
}));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const { loadCurrent, requireCurrent, requireOwner } = await import('./current');

const user = {
  id: '019969a0-0000-7000-8000-000000000001',
  email: 'k@x.bg',
  name: 'K',
};
const personal = { id: '019969a0-0000-7000-8000-00000000000a', name: 'K' };
const shared = { id: '019969a0-0000-7000-8000-00000000000b', name: 'Студио' };

beforeEach(() => {
  auth.getCurrentUser.mockReset().mockResolvedValue(user);
  platform.findMembership.mockReset().mockResolvedValue(null);
  platform.findPersonalOrganizationByOwner
    .mockReset()
    .mockResolvedValue(personal);
  cookieStore.get.mockReset().mockReturnValue(undefined);
});

describe('loadCurrent', () => {
  it('is null without a session and never reads the cookie', async () => {
    auth.getCurrentUser.mockResolvedValue(null);
    expect(await loadCurrent()).toBeNull();
    expect(cookieStore.get).not.toHaveBeenCalled();
  });

  it('falls back to the personal org as owner without a cookie', async () => {
    expect(await loadCurrent()).toEqual({ user, org: personal, role: 'owner' });
    expect(platform.findMembership).not.toHaveBeenCalled();
  });

  it('uses the cookie org only when the membership row exists', async () => {
    cookieStore.get.mockReturnValue({ value: shared.id });
    platform.findMembership.mockResolvedValue({ org: shared, role: 'editor' });

    expect(await loadCurrent()).toEqual({ user, org: shared, role: 'editor' });
    expect(platform.findMembership).toHaveBeenCalledWith(
      {},
      shared.id,
      user.id,
    );
    expect(platform.findPersonalOrganizationByOwner).not.toHaveBeenCalled();
  });

  it('drops silently to the personal org for a foreign or malformed cookie', async () => {
    cookieStore.get.mockReturnValue({ value: shared.id });
    expect(await loadCurrent()).toEqual({ user, org: personal, role: 'owner' });

    cookieStore.get.mockReturnValue({ value: 'not-a-uuid' });
    platform.findMembership.mockClear();
    expect(await loadCurrent()).toEqual({ user, org: personal, role: 'owner' });
    expect(platform.findMembership).not.toHaveBeenCalled();
  });
});

describe('requireCurrent / requireOwner', () => {
  it('redirects to /login without a session', async () => {
    auth.getCurrentUser.mockResolvedValue(null);
    await expect(requireCurrent()).rejects.toThrow('REDIRECT:/login');
  });

  it('sends an editor to /app and lets the owner through', async () => {
    cookieStore.get.mockReturnValue({ value: shared.id });
    platform.findMembership.mockResolvedValue({ org: shared, role: 'editor' });
    await expect(requireOwner()).rejects.toThrow('REDIRECT:/app');

    platform.findMembership.mockResolvedValue({ org: shared, role: 'owner' });
    expect((await requireOwner()).role).toBe('owner');
  });
});
