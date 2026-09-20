import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Platform from '@/modules/platform';

const auth = vi.hoisted(() => ({ getCurrentAdmin: vi.fn() }));
const platform = vi.hoisted(() => ({
  createBatch: vi.fn(),
  markBatchWritten: vi.fn(),
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
const { createBatchAction, markBatchWrittenAction } = await import('./actions');

const admin = {
  id: '019969a0-0000-7000-8000-000000000001',
  email: 'a@x.bg',
  name: 'A',
};
const batchId = '019969a0-0000-7000-8000-0000000000bb';

beforeEach(() => {
  auth.getCurrentAdmin.mockReset().mockResolvedValue(admin);
  platform.createBatch.mockReset().mockResolvedValue({ id: batchId });
  platform.markBatchWritten.mockReset().mockResolvedValue(20);
  rateLimit.consume.mockClear();
  rateLimit.consume.mockResolvedValue({ allowed: true, retryAfterSec: 0 });
  cache.revalidatePath.mockClear();
});

describe('createBatchAction', () => {
  it('rejects invalid input before touching the session', async () => {
    for (const quantity of [0, 1001, 2.5, Number.NaN]) {
      const result = await createBatchAction({ name: 'Първа', quantity });
      expect(result.ok).toBe(false);
    }
    expect((await createBatchAction({ name: '  ', quantity: 5 })).ok).toBe(
      false,
    );
    expect(auth.getCurrentAdmin).not.toHaveBeenCalled();
    expect(platform.createBatch).not.toHaveBeenCalled();
  });

  it('redirects to /admin/login without an admin', async () => {
    auth.getCurrentAdmin.mockResolvedValue(null);
    await expect(
      createBatchAction({ name: 'Първа', quantity: 20 }),
    ).rejects.toThrow('REDIRECT:/admin/login');
    expect(platform.createBatch).not.toHaveBeenCalled();
  });

  it('counts the action per admin and refuses past the limit', async () => {
    rateLimit.consume.mockResolvedValue({ allowed: false, retryAfterSec: 20 });
    const result = await createBatchAction({ name: 'Първа', quantity: 20 });
    expect(result).toEqual({
      ok: false,
      message: 'Твърде много опити. Опитай след 1 минути.',
    });
    expect(rateLimit.consume).toHaveBeenCalledWith(
      `rl:action:user:${admin.id}`,
      60,
      60,
    );
    expect(platform.createBatch).not.toHaveBeenCalled();
  });

  it('creates with createdBy from the session (never the input) and redirects to the detail', async () => {
    await expect(
      createBatchAction({ name: ' Първа ', quantity: 20, createdBy: 'forged' }),
    ).rejects.toThrow(`REDIRECT:/admin/batches/${batchId}`);
    expect(platform.createBatch).toHaveBeenCalledWith(
      {},
      { name: 'Първа', quantity: 20, createdBy: admin.id },
    );
    expect(cache.revalidatePath).toHaveBeenCalledWith('/admin/batches');
  });

  it('returns the CardError message and hides unexpected errors', async () => {
    platform.createBatch.mockRejectedValue(new CardError('id_collision'));
    expect(await createBatchAction({ name: 'Първа', quantity: 20 })).toEqual({
      ok: false,
      message: 'Не се намери свободен набор от id — опитай пак.',
    });

    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    platform.createBatch.mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await createBatchAction({ name: 'Първа', quantity: 20 });
    expect(result.ok).toBe(false);
    expect(result.message).not.toContain('ECONNREFUSED');
    error.mockRestore();
  });
});

describe('markBatchWrittenAction', () => {
  it('rejects a non-UUID id before touching the session', async () => {
    const result = await markBatchWrittenAction('abc');
    expect(result.ok).toBe(false);
    expect(auth.getCurrentAdmin).not.toHaveBeenCalled();
  });

  it('redirects to /admin/login without an admin', async () => {
    auth.getCurrentAdmin.mockResolvedValue(null);
    await expect(markBatchWrittenAction(batchId)).rejects.toThrow(
      'REDIRECT:/admin/login',
    );
  });

  it('refuses past the limit', async () => {
    rateLimit.consume.mockResolvedValue({ allowed: false, retryAfterSec: 20 });
    expect((await markBatchWrittenAction(batchId)).ok).toBe(false);
    expect(platform.markBatchWritten).not.toHaveBeenCalled();
  });

  it('returns the count and revalidates the list and the detail', async () => {
    expect(await markBatchWrittenAction(batchId)).toEqual({
      ok: true,
      written: 20,
    });
    expect(platform.markBatchWritten).toHaveBeenCalledWith({}, batchId);
    expect(cache.revalidatePath).toHaveBeenCalledWith('/admin/batches');
    expect(cache.revalidatePath).toHaveBeenCalledWith(
      `/admin/batches/${batchId}`,
    );
  });
});
