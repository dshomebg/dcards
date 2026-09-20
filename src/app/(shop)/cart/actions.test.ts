import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Shop from '@/modules/shop';

const rateLimit = vi.hoisted(() => ({
  consume: vi.fn(() => Promise.resolve({ allowed: true, retryAfterSec: 0 })),
}));
const shop = vi.hoisted(() => ({ isVariantActive: vi.fn() }));
const store = vi.hoisted(() => ({
  readCart: vi.fn(),
  writeCart: vi.fn(),
  hasCartCookie: vi.fn(() => Promise.resolve(true)),
}));
const revalidatePath = vi.hoisted(() => vi.fn());

// `core` отваря пул при импорт; `store` носи `server-only` и `cookies()`.
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
vi.mock('./store', () => store);
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(new Headers({ 'x-real-ip': '203.0.113.9' })),
}));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const { addToCartAction, removeCartLineAction, updateCartLineAction } =
  await import('./actions');

const VARIANT = '019969a0-0000-7000-8000-000000000001';
const input = {
  variantId: VARIANT,
  quantity: 3,
  personalization: { name: 'Иван Петров', title: 'CEO', notes: '' },
};

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

beforeEach(() => {
  rateLimit.consume.mockClear();
  rateLimit.consume.mockResolvedValue({ allowed: true, retryAfterSec: 0 });
  shop.isVariantActive.mockReset().mockResolvedValue(true);
  store.readCart.mockReset().mockResolvedValue({ items: [] });
  store.writeCart.mockReset().mockResolvedValue(undefined);
  revalidatePath.mockClear();
});

describe('addToCartAction', () => {
  it('writes the line, refreshes the layout and redirects to the cart', async () => {
    await expect(addToCartAction(input)).rejects.toThrow('REDIRECT:/cart');
    expect(rateLimit.consume).toHaveBeenCalledWith(
      'rl:cart:ip:203.0.113.9',
      60,
      60,
    );
    expect(store.writeCart).toHaveBeenCalledTimes(1);
    const cart = store.writeCart.mock.calls[0]?.[0] as Shop.Cart;
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]).toMatchObject({
      variantId: VARIANT,
      quantity: 3,
      personalization: { name: 'Иван Петров', title: 'CEO', notes: null },
    });
    expect(cart.items[0]?.id).toBeTruthy();
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('returns the limit message and writes nothing', async () => {
    rateLimit.consume.mockResolvedValue({ allowed: false, retryAfterSec: 30 });
    const result = await addToCartAction(input);
    expect(result).toEqual({
      ok: false,
      message: 'Твърде много опити. Опитай след 1 минути.',
    });
    expect(shop.isVariantActive).not.toHaveBeenCalled();
    expect(store.writeCart).not.toHaveBeenCalled();
  });

  it('rejects invalid input before the limit and without a write', async () => {
    for (const bad of [
      { ...input, quantity: 0 },
      { ...input, quantity: 21 },
      { ...input, personalization: { name: '' } },
      { ...input, personalization: { name: 'И', notes: 'x'.repeat(301) } },
    ]) {
      const result = await addToCartAction(bad);
      expect(result.ok).toBe(false);
    }
    expect(rateLimit.consume).not.toHaveBeenCalled();
    expect(store.writeCart).not.toHaveBeenCalled();
  });

  it('refuses an unknown or inactive variant with a message', async () => {
    shop.isVariantActive.mockResolvedValue(false);
    const result = await addToCartAction(input);
    expect(result).toEqual({
      ok: false,
      message: 'Този вариант вече не се предлага.',
    });
    expect(store.writeCart).not.toHaveBeenCalled();
  });

  it('refuses the eleventh line with the cart message', async () => {
    store.readCart.mockResolvedValue({
      items: Array.from({ length: 10 }, (_, i) => ({
        id: `l${i}`,
        ...input,
        personalization: { name: 'И', title: null, notes: null },
      })),
    });
    const result = await addToCartAction(input);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('10');
    expect(store.writeCart).not.toHaveBeenCalled();
  });

  it('hides unexpected errors behind a generic message', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    store.writeCart.mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await addToCartAction(input);
    expect(result.ok).toBe(false);
    expect(result.message).not.toContain('ECONNREFUSED');
    error.mockRestore();
  });
});

describe('updateCartLineAction / removeCartLineAction', () => {
  it('updates the quantity of the addressed line', async () => {
    store.readCart.mockResolvedValue({
      items: [{ id: 'l1', ...input, personalization: { name: 'И' } }],
    });
    await expect(
      updateCartLineAction(form({ lineId: 'l1', quantity: '4' })),
    ).rejects.toThrow('REDIRECT:/cart');
    const cart = store.writeCart.mock.calls[0]?.[0] as Shop.Cart;
    expect(cart.items[0]?.quantity).toBe(4);
  });

  it('redirects silently for an unknown line without a write', async () => {
    await expect(
      removeCartLineAction(form({ lineId: 'nope' })),
    ).rejects.toThrow('REDIRECT:/cart');
    expect(store.writeCart).not.toHaveBeenCalled();
  });

  it('carries the limit to the cart page as a query', async () => {
    rateLimit.consume.mockResolvedValue({ allowed: false, retryAfterSec: 30 });
    await expect(removeCartLineAction(form({ lineId: 'l1' }))).rejects.toThrow(
      'REDIRECT:/cart?error=limited',
    );
    expect(store.readCart).not.toHaveBeenCalled();
  });
});

describe('addToCartAction — new cart', () => {
  it('applies the strict new-cart limit only when there is no cart cookie', async () => {
    store.hasCartCookie.mockResolvedValueOnce(false);
    rateLimit.consume
      .mockResolvedValueOnce({ allowed: true, retryAfterSec: 0 })
      .mockResolvedValueOnce({ allowed: false, retryAfterSec: 3600 });
    const { addToCartAction } = await import('./actions');
    const result = await addToCartAction({
      variantId: '00000000-0000-7000-8000-000000000001',
      quantity: 1,
      personalization: { name: 'Иван', title: null, notes: null },
    });
    expect(result.ok).toBe(false);
    expect(rateLimit.consume).toHaveBeenLastCalledWith(
      'rl:cart-new:ip:203.0.113.9',
      10,
      3600,
    );
    expect(store.writeCart).not.toHaveBeenCalled();
  });
});
