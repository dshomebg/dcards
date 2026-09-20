import { DrizzleQueryError } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Platform from '@/modules/platform';

const auth = vi.hoisted(() => ({ getCurrentAdmin: vi.fn() }));
const platform = vi.hoisted(() => ({ updateOrganizationPlan: vi.fn() }));
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

const { OrganizationError } = await import('@/modules/platform');
const { setOrgPlanAction } = await import('./actions');

const ORG_ID = '019969a0-0000-7000-8000-000000000002';
const admin = {
  id: '019969a0-0000-7000-8000-000000000001',
  email: 'a@x.bg',
  name: 'A',
};

beforeEach(() => {
  auth.getCurrentAdmin.mockReset().mockResolvedValue(admin);
  platform.updateOrganizationPlan.mockReset().mockResolvedValue({});
  rateLimit.consume.mockClear();
  rateLimit.consume.mockResolvedValue({ allowed: true, retryAfterSec: 0 });
  cache.revalidatePath.mockClear();
});

describe('setOrgPlanAction', () => {
  it('rejects bad input before touching the session', async () => {
    expect(await setOrgPlanAction('abc', 'pro', '')).toEqual({
      ok: false,
      message: 'Организацията не съществува.',
    });
    expect((await setOrgPlanAction(ORG_ID, 'pro', '2000-01-01')).ok).toBe(
      false,
    );
    expect(auth.getCurrentAdmin).not.toHaveBeenCalled();
    expect(platform.updateOrganizationPlan).not.toHaveBeenCalled();
  });

  it('redirects to /admin/login without an admin', async () => {
    auth.getCurrentAdmin.mockResolvedValue(null);
    await expect(setOrgPlanAction(ORG_ID, 'free', '')).rejects.toThrow(
      'REDIRECT:/admin/login',
    );
    expect(platform.updateOrganizationPlan).not.toHaveBeenCalled();
  });

  it('counts per admin and refuses past the limit', async () => {
    rateLimit.consume.mockResolvedValue({ allowed: false, retryAfterSec: 20 });
    expect(await setOrgPlanAction(ORG_ID, 'free', '')).toEqual({
      ok: false,
      message: 'Твърде много опити. Опитай след 1 минути.',
    });
    expect(rateLimit.consume).toHaveBeenCalledWith(
      `rl:action:user:${admin.id}`,
      60,
      60,
    );
    expect(platform.updateOrganizationPlan).not.toHaveBeenCalled();
  });

  it('writes the plan, nulls the date for free and revalidates both paths', async () => {
    expect(await setOrgPlanAction(ORG_ID, 'pro', '2099-12-31')).toEqual({
      ok: true,
    });
    expect(platform.updateOrganizationPlan).toHaveBeenCalledWith({}, ORG_ID, {
      plan: 'pro',
      expiresOn: '2099-12-31',
    });

    expect(await setOrgPlanAction(ORG_ID, 'free', '2099-12-31')).toEqual({
      ok: true,
    });
    expect(platform.updateOrganizationPlan).toHaveBeenLastCalledWith(
      {},
      ORG_ID,
      { plan: 'free', expiresOn: null },
    );
    expect(cache.revalidatePath).toHaveBeenCalledWith('/admin/orgs');
    expect(cache.revalidatePath).toHaveBeenCalledWith(`/admin/orgs/${ORG_ID}`);
  });

  it('returns the OrganizationError message and hides DB errors (no email in the log)', async () => {
    platform.updateOrganizationPlan.mockRejectedValue(
      new OrganizationError('org_not_found'),
    );
    expect(await setOrgPlanAction(ORG_ID, 'pro', '')).toEqual({
      ok: false,
      message: 'Организацията не съществува.',
    });

    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    platform.updateOrganizationPlan.mockRejectedValue(
      new DrizzleQueryError(
        'update organizations set plan = $1 where owner = ivan@example.bg',
        [],
        Object.assign(new Error('detail: (ivan@example.bg)'), {
          code: '22007',
          constraint_name: undefined,
        }),
      ),
    );
    const result = await setOrgPlanAction(ORG_ID, 'pro', '');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).not.toContain('ivan@example.bg');
    expect(JSON.stringify(error.mock.calls)).not.toContain('ivan@example.bg');
    expect(JSON.stringify(error.mock.calls)).toContain('22007');
    error.mockRestore();
  });
});
