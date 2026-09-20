import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Shop from '@/modules/shop';

const rateLimit = vi.hoisted(() => ({
  consume: vi.fn((_key: string, _limit: number, _windowSec: number) =>
    Promise.resolve({ allowed: true, retryAfterSec: 0 }),
  ),
}));
const shop = vi.hoisted(() => ({ placeOrder: vi.fn() }));
const store = vi.hoisted(() => ({
  readCart: vi.fn(),
  writeCart: vi.fn(),
  acquireCheckoutLock: vi.fn(),
  releaseCheckoutLock: vi.fn(),
}));
const orderView = vi.hoisted(() => ({ issueOrderViewToken: vi.fn() }));
const current = vi.hoisted(() => ({ loadCurrent: vi.fn() }));
const revalidatePath = vi.hoisted(() => vi.fn());

// `core` отваря пул при импорт; `store` и `order-view` носят `server-only`.
vi.mock('@/modules/core', async () => ({
  db: {},
  rateLimit,
  ...(await vi.importActual('@/modules/core/rate-limit/policy')),
  ...(await vi.importActual('@/modules/core/rate-limit/client-ip')),
}));
vi.mock('@/modules/shop', async (importOriginal) => ({
  ...(await importOriginal<typeof Shop>()),
  ...shop,
}));
vi.mock('../cart/store', () => store);
vi.mock('./order-view', () => orderView);
vi.mock('@/app/app/(protected)/current', () => current);
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(new Headers({ 'x-real-ip': '203.0.113.9' })),
}));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const { placeOrderAction } = await import('./actions');
const { OrderError } = await import('@/modules/shop');

const VARIANT = '019969a0-0000-7000-8000-000000000001';
const cart = {
  items: [
    {
      id: 'l1',
      variantId: VARIANT,
      quantity: 2,
      personalization: { name: 'Иван', title: null, notes: null },
    },
  ],
};

const input = {
  name: 'Иван Петров',
  phone: '+359 88 123 4567',
  email: 'Ivan@X.bg',
  courier: 'econt',
  deliveryKind: 'office',
  address: '',
  office: 'Еконт София Център',
  note: '',
  paymentMethod: 'cod',
};

beforeEach(() => {
  rateLimit.consume.mockClear();
  rateLimit.consume.mockResolvedValue({ allowed: true, retryAfterSec: 0 });
  shop.placeOrder.mockReset().mockResolvedValue({
    id: 'o1',
    number: 'DC-2026-000001',
  });
  store.readCart.mockReset().mockResolvedValue(cart);
  store.writeCart.mockReset().mockResolvedValue(undefined);
  store.acquireCheckoutLock.mockReset().mockResolvedValue(true);
  store.releaseCheckoutLock.mockReset().mockResolvedValue(undefined);
  orderView.issueOrderViewToken.mockReset().mockResolvedValue(undefined);
  current.loadCurrent.mockReset().mockResolvedValue(null);
  revalidatePath.mockClear();
});

describe('placeOrderAction', () => {
  it('rejects invalid input before the limit and the database', async () => {
    for (const bad of [
      { ...input, phone: 'abc' },
      { ...input, deliveryKind: 'address', address: '' },
      { ...input, paymentMethod: 'card' },
      { ...input, email: 'not-an-email' },
      { ...input, name: '' },
    ]) {
      const result = await placeOrderAction(bad);
      expect(result.ok).toBe(false);
    }
    expect(rateLimit.consume).not.toHaveBeenCalled();
    expect(shop.placeOrder).not.toHaveBeenCalled();
  });

  it('returns the limit message and places nothing', async () => {
    rateLimit.consume.mockResolvedValue({ allowed: false, retryAfterSec: 30 });
    const result = await placeOrderAction(input);
    expect(result).toEqual({
      ok: false,
      message: 'Твърде много опити. Опитай след 1 минути.',
    });
    expect(shop.placeOrder).not.toHaveBeenCalled();
  });

  it('does not spend the limit on an empty cart', async () => {
    store.readCart.mockResolvedValue({ items: [] });
    const result = await placeOrderAction(input);
    expect(result).toEqual({ ok: false, message: 'Количката е празна.' });
    expect(rateLimit.consume).not.toHaveBeenCalled();
    expect(shop.placeOrder).not.toHaveBeenCalled();
  });

  it('refuses a second submit while the cart is being processed', async () => {
    store.acquireCheckoutLock.mockResolvedValue(false);
    const result = await placeOrderAction(input);
    expect(result.ok).toBe(false);
    expect(shop.placeOrder).not.toHaveBeenCalled();
    expect(store.releaseCheckoutLock).not.toHaveBeenCalled();
  });

  it('counts IP first, then the lowercased email, and stops at the email', async () => {
    rateLimit.consume
      .mockResolvedValueOnce({ allowed: true, retryAfterSec: 0 })
      .mockResolvedValueOnce({ allowed: false, retryAfterSec: 3600 });
    const result = await placeOrderAction(input);
    expect(result.ok).toBe(false);
    expect(rateLimit.consume.mock.calls.map((call) => call[0])).toEqual([
      'rl:checkout:ip:203.0.113.9',
      'rl:checkout:email:ivan@x.bg',
    ]);
  });

  it('hands the OrderError message back as a failure', async () => {
    shop.placeOrder.mockRejectedValue(new OrderError('out_of_stock', 'Бяла'));
    const result = await placeOrderAction(input);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Бяла');
    expect(orderView.issueOrderViewToken).not.toHaveBeenCalled();
    expect(store.writeCart).not.toHaveBeenCalled();
    expect(store.releaseCheckoutLock).toHaveBeenCalledOnce();
  });

  it('hides unexpected errors behind a generic message', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    shop.placeOrder.mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await placeOrderAction(input);
    expect(result.ok).toBe(false);
    expect(result.message).not.toContain('ECONNREFUSED');
    error.mockRestore();
  });

  it('places the order as a guest, issues the token, empties the cart, redirects', async () => {
    await expect(placeOrderAction(input)).rejects.toThrow(
      'REDIRECT:/order/DC-2026-000001',
    );
    expect(shop.placeOrder).toHaveBeenCalledWith(expect.anything(), {
      cart,
      customer: {
        name: 'Иван Петров',
        phone: '+359 88 123 4567',
        email: 'Ivan@X.bg',
      },
      shipping: {
        courier: 'econt',
        address: null,
        office: 'Еконт София Център',
        note: null,
      },
      actor: null,
    });
    expect(orderView.issueOrderViewToken).toHaveBeenCalledWith(
      'DC-2026-000001',
    );
    expect(store.writeCart).toHaveBeenCalledWith({ items: [] });
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('passes the signed-in actor and issues no guest token', async () => {
    current.loadCurrent.mockResolvedValue({
      user: { id: 'u1', email: 'a@x.bg', name: 'A' },
      org: { id: 'org1' },
    });
    await expect(placeOrderAction(input)).rejects.toThrow('REDIRECT:');
    expect(shop.placeOrder.mock.calls[0]?.[1]).toMatchObject({
      actor: { userId: 'u1', orgId: 'org1' },
    });
    expect(orderView.issueOrderViewToken).not.toHaveBeenCalled();
    expect(store.writeCart).toHaveBeenCalledWith({ items: [] });
  });

  it('still redirects when Redis fails after the commit', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    orderView.issueOrderViewToken.mockRejectedValue(new Error('ECONNRESET'));
    store.writeCart.mockRejectedValue(new Error('ECONNRESET'));
    await expect(placeOrderAction(input)).rejects.toThrow(
      'REDIRECT:/order/DC-2026-000001',
    );
    error.mockRestore();
  });
});
