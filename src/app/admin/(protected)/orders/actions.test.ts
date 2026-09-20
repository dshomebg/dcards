import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Platform from '@/modules/platform';
import type * as Shop from '@/modules/shop';

const auth = vi.hoisted(() => ({ getCurrentAdmin: vi.fn() }));
const shop = vi.hoisted(() => ({
  transitionOrder: vi.fn(),
  lockOrderForCards: vi.fn(),
  setTrackingNumber: vi.fn(),
}));
const platform = vi.hoisted(() => ({
  assignCardsFromBatch: vi.fn(),
  attachOrderCardsToOrg: vi.fn(),
  releaseOrderCard: vi.fn(),
  releaseOrderCards: vi.fn(),
}));
const rateLimit = vi.hoisted(() => ({
  consume: vi.fn(() => Promise.resolve({ allowed: true, retryAfterSec: 0 })),
}));
const mail = vi.hoisted(() => ({ sendMail: vi.fn() }));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
// Транзакцията подава „tx" = същия фалшив `db`; сервизите са мокнати.
const db = vi.hoisted(() => {
  const fake: { transaction?: unknown } = {};
  fake.transaction = (fn: (tx: unknown) => Promise<unknown>) => fn(fake);
  return fake;
});

// Barrel-ът на `auth` носи `server-only`; `core` отваря пул при импорт.
vi.mock('@/modules/auth', () => auth);
vi.mock('@/modules/core', async () => ({
  db,
  env: () => ({ APP_NAME: 'DCARDS', APP_URL: 'http://localhost:3100' }),
  sendMail: mail.sendMail,
  rateLimit,
  ...(await vi.importActual('@/modules/core/rate-limit/policy')),
}));
vi.mock('@/modules/shop', async (importOriginal) => ({
  ...(await importOriginal<typeof Shop>()),
  ...shop,
}));
vi.mock('@/modules/platform', async (importOriginal) => ({
  ...(await importOriginal<typeof Platform>()),
  ...platform,
}));
vi.mock('next/cache', () => cache);
// `after` изпълнява веднага — тестът чака писмото като част от action-а.
vi.mock('next/server', () => ({ after: (fn: () => Promise<void>) => fn() }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const { OrderError } = await import('@/modules/shop');
const { CardError } = await import('@/modules/platform');
const {
  assignCardsAction,
  releaseCardAction,
  setTrackingNumberAction,
  transitionOrderAction,
} = await import('./actions');

const admin = { id: '019969a0-0000-7000-8000-000000000001', email: 'a@x.bg' };
const ORDER = '019969a0-0000-7000-8000-0000000000aa';
const BATCH = '019969a0-0000-7000-8000-0000000000bb';

const transition = (to: string, extra = {}) => ({
  id: ORDER,
  number: 'DC-2026-000001',
  from: 'in_production',
  to,
  courier: 'econt',
  customerEmail: 'i@x.bg',
  hasAccount: false,
  orgId: null,
  trackingNumber: to === 'shipped' ? '123' : null,
  ...extra,
});

beforeEach(() => {
  auth.getCurrentAdmin.mockReset().mockResolvedValue(admin);
  shop.transitionOrder.mockReset().mockResolvedValue(transition('shipped'));
  shop.lockOrderForCards
    .mockReset()
    .mockResolvedValue({ status: 'cod', orgId: null, quota: 3 });
  shop.setTrackingNumber.mockReset().mockResolvedValue({ number: 'DC-1' });
  platform.assignCardsFromBatch.mockReset().mockResolvedValue(2);
  platform.attachOrderCardsToOrg.mockReset().mockResolvedValue(0);
  platform.releaseOrderCard.mockReset().mockResolvedValue(undefined);
  platform.releaseOrderCards.mockReset().mockResolvedValue(1);
  rateLimit.consume.mockClear();
  rateLimit.consume.mockResolvedValue({ allowed: true, retryAfterSec: 0 });
  mail.sendMail.mockReset().mockResolvedValue(true);
  cache.revalidatePath.mockClear();
});

describe('transitionOrderAction', () => {
  it('rejects a non-UUID id and an unknown status before the session', async () => {
    expect((await transitionOrderAction('abc', 'shipped')).ok).toBe(false);
    expect((await transitionOrderAction(ORDER, 'nope')).ok).toBe(false);
    expect(auth.getCurrentAdmin).not.toHaveBeenCalled();
    expect(shop.transitionOrder).not.toHaveBeenCalled();
  });

  it('redirects to /admin/login without an admin and refuses past the limit', async () => {
    auth.getCurrentAdmin.mockResolvedValue(null);
    await expect(transitionOrderAction(ORDER, 'shipped')).rejects.toThrow(
      'REDIRECT:/admin/login',
    );
    auth.getCurrentAdmin.mockResolvedValue(admin);
    rateLimit.consume.mockResolvedValue({ allowed: false, retryAfterSec: 20 });
    expect((await transitionOrderAction(ORDER, 'shipped')).ok).toBe(false);
    expect(shop.transitionOrder).not.toHaveBeenCalled();
  });

  it('hands the OrderError message back and sends no mail', async () => {
    shop.transitionOrder.mockRejectedValue(
      new OrderError('transition_invalid'),
    );
    const result = await transitionOrderAction(ORDER, 'shipped', '1');
    expect(result).toEqual({
      ok: false,
      message: new OrderError('transition_invalid').message,
    });
    expect(mail.sendMail).not.toHaveBeenCalled();
    expect(cache.revalidatePath).not.toHaveBeenCalled();
  });

  it('hides unexpected errors behind a generic message', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    shop.transitionOrder.mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await transitionOrderAction(ORDER, 'shipped', '1');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).not.toContain('ECONNREFUSED');
    error.mockRestore();
  });

  it('ships: passes the tracking number, mails the customer, revalidates', async () => {
    const result = await transitionOrderAction(ORDER, 'shipped', ' 123 ');
    expect(result).toEqual({ ok: true });
    expect(shop.transitionOrder).toHaveBeenCalledWith(db, {
      id: ORDER,
      to: 'shipped',
      trackingNumber: '123',
    });
    expect(platform.releaseOrderCards).not.toHaveBeenCalled();
    expect(mail.sendMail).toHaveBeenCalledOnce();
    expect(mail.sendMail.mock.calls[0]?.[0]).toMatchObject({
      to: 'i@x.bg',
      subject: 'Поръчка DC-2026-000001 е изпратена — DCARDS',
    });
    expect(mail.sendMail.mock.calls[0]?.[0].text).toContain('123');
    expect(mail.sendMail.mock.calls[0]?.[0].text).not.toContain('/order/');
    for (const path of [
      '/admin/orders',
      `/admin/orders/${ORDER}`,
      '/admin/batches',
      '/order/DC-2026-000001',
      '/app/orders',
    ]) {
      expect(cache.revalidatePath).toHaveBeenCalledWith(path);
    }
  });

  it('links the order in the mail for an account order', async () => {
    shop.transitionOrder.mockResolvedValue(
      transition('shipped', { hasAccount: true, orgId: 'org1' }),
    );
    await transitionOrderAction(ORDER, 'shipped', '123');
    expect(mail.sendMail.mock.calls[0]?.[0].text).toContain(
      'http://localhost:3100/order/DC-2026-000001',
    );
    // Картите влизат в org-а на клиента едва при изпращане.
    expect(platform.attachOrderCardsToOrg).toHaveBeenCalledWith(db, {
      orderId: ORDER,
      orgId: 'org1',
    });
  });

  it('records the status but sends nothing on a bad customer email', async () => {
    shop.transitionOrder.mockResolvedValue(
      transition('shipped', { customerEmail: null }),
    );
    const result = await transitionOrderAction(ORDER, 'shipped', '123');
    expect(result.ok).toBe(true);
    expect(result.ok && result.notice).toContain('писмо не е пратено');
    expect(mail.sendMail).not.toHaveBeenCalled();
  });

  it('cancels: releases the cards in the same transaction, no mail', async () => {
    shop.transitionOrder.mockResolvedValue(transition('cancelled'));
    expect(await transitionOrderAction(ORDER, 'cancelled')).toEqual({
      ok: true,
    });
    expect(platform.releaseOrderCards).toHaveBeenCalledWith(db, ORDER);
    expect(mail.sendMail).not.toHaveBeenCalled();
  });

  it('still succeeds when SMTP fails after the commit', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    mail.sendMail.mockRejectedValue(new Error('ETIMEDOUT'));
    expect(await transitionOrderAction(ORDER, 'shipped', '123')).toEqual({
      ok: true,
    });
    error.mockRestore();
  });
});

describe('assignCardsAction / releaseCardAction', () => {
  it('validates before the session and passes org and quota from the lock', async () => {
    expect((await assignCardsAction(ORDER, BATCH, 0)).ok).toBe(false);
    expect((await assignCardsAction(ORDER, 'x', 1)).ok).toBe(false);
    expect((await releaseCardAction(ORDER, 'bad id')).ok).toBe(false);
    expect(auth.getCurrentAdmin).not.toHaveBeenCalled();

    shop.lockOrderForCards.mockResolvedValue({
      status: 'cod',
      orgId: 'org1',
      quota: 5,
    });
    expect(await assignCardsAction(ORDER, BATCH, 2)).toEqual({ ok: true });
    expect(platform.assignCardsFromBatch).toHaveBeenCalledWith(db, {
      batchId: BATCH,
      quantity: 2,
      orderId: ORDER,
      quota: 5,
    });
    expect(cache.revalidatePath).toHaveBeenCalledWith('/admin/batches');
    expect(cache.revalidatePath).not.toHaveBeenCalledWith('/app/orders');
  });

  it('returns CardError and OrderError messages as failures', async () => {
    platform.assignCardsFromBatch.mockRejectedValue(
      new CardError('batch_short'),
    );
    expect(await assignCardsAction(ORDER, BATCH, 2)).toEqual({
      ok: false,
      message: new CardError('batch_short').message,
    });
    shop.lockOrderForCards.mockRejectedValue(new OrderError('cards_locked'));
    expect(await releaseCardAction(ORDER, 'ABCD2345')).toEqual({
      ok: false,
      message: new OrderError('cards_locked').message,
    });
    expect(platform.releaseOrderCard).not.toHaveBeenCalled();
  });

  it('releases a card after locking the order', async () => {
    expect(await releaseCardAction(ORDER, 'abcd2345')).toEqual({ ok: true });
    expect(shop.lockOrderForCards).toHaveBeenCalledWith(db, ORDER);
    expect(platform.releaseOrderCard).toHaveBeenCalledWith(db, {
      cardId: 'ABCD2345',
      orderId: ORDER,
    });
  });
});

describe('setTrackingNumberAction', () => {
  it('trims, records and revalidates the order page without mail', async () => {
    expect((await setTrackingNumberAction(ORDER, '   ')).ok).toBe(false);
    expect(await setTrackingNumberAction(ORDER, ' T-9 ')).toEqual({
      ok: true,
    });
    expect(shop.setTrackingNumber).toHaveBeenCalledWith(db, ORDER, 'T-9');
    expect(cache.revalidatePath).toHaveBeenCalledWith('/order/DC-1');
    expect(mail.sendMail).not.toHaveBeenCalled();
  });
});
