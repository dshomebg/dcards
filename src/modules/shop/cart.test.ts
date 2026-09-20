import { describe, expect, it } from 'vitest';

import {
  addLine,
  cartCount,
  CartError,
  cartLineInputSchema,
  emptyCart,
  MAX_CART_LINES,
  parseCart,
  removeLine,
  updateLineQuantity,
} from './cart';

const VARIANT = '019969a0-0000-7000-8000-000000000001';

const input = (name: string, quantity = 1) => ({
  variantId: VARIANT,
  quantity,
  personalization: { name, title: null, notes: null },
});

function codeOf(work: () => unknown): string {
  try {
    work();
  } catch (error) {
    if (error instanceof CartError) return error.code;
    throw error;
  }
  throw new Error('expected a CartError');
}

describe('parseCart', () => {
  it('turns bad or foreign input into an empty cart', () => {
    expect(parseCart('nope')).toEqual({ items: [] });
    expect(parseCart({ items: [{ id: 'x' }] })).toEqual({ items: [] });
    expect(parseCart(null)).toEqual({ items: [] });
  });

  it('keeps a valid cart as is', () => {
    const cart = addLine(emptyCart(), input('Иван', 2), 'l1');
    expect(parseCart(JSON.parse(JSON.stringify(cart)))).toEqual(cart);
  });
});

describe('cartLineInputSchema', () => {
  it('turns empty title and notes into null', () => {
    const parsed = cartLineInputSchema.parse({
      variantId: VARIANT,
      quantity: 1,
      personalization: { name: ' Иван ', title: '', notes: '  ' },
    });
    expect(parsed.personalization).toEqual({
      name: 'Иван',
      title: null,
      notes: null,
    });
  });

  it('rejects quantity 0 and 21, an empty name and long notes', () => {
    const bad = (patch: Record<string, unknown>) =>
      cartLineInputSchema.safeParse({ ...input('Иван'), ...patch }).success;
    expect(bad({ quantity: 0 })).toBe(false);
    expect(bad({ quantity: 21 })).toBe(false);
    expect(bad({ quantity: 1.5 })).toBe(false);
    expect(bad({ personalization: { name: '' } })).toBe(false);
    expect(
      bad({ personalization: { name: 'И', notes: 'x'.repeat(301) } }),
    ).toBe(false);
    expect(bad({ variantId: 'not-a-uuid' })).toBe(false);
  });
});

describe('addLine', () => {
  it('keeps the same variant on two lines with different names', () => {
    const cart = addLine(
      addLine(emptyCart(), input('Иван'), 'l1'),
      input('Мария'),
      'l2',
    );
    expect(cart.items.map((line) => line.id)).toEqual(['l1', 'l2']);
    expect(cart.items[1]?.personalization.name).toBe('Мария');
  });

  it('refuses the eleventh line and leaves ten', () => {
    let cart = emptyCart();
    for (let i = 0; i < MAX_CART_LINES; i += 1) {
      cart = addLine(cart, input(`N${i}`), `l${i}`);
    }
    expect(codeOf(() => addLine(cart, input('X'), 'l10'))).toBe('cart_full');
    expect(cart.items).toHaveLength(10);
  });

  it('validates the input even when the caller typed it', () => {
    expect(codeOf(() => addLine(emptyCart(), input('', 1), 'l1'))).toBe(
      'input_invalid',
    );
  });
});

describe('updateLineQuantity / removeLine', () => {
  const cart = addLine(
    addLine(emptyCart(), input('Иван', 2), 'l1'),
    input('Мария', 3),
    'l2',
  );

  it('updates only the addressed line', () => {
    const next = updateLineQuantity(cart, 'l2', 4);
    expect(next.items.map((line) => line.quantity)).toEqual([2, 4]);
    expect(cart.items[1]?.quantity).toBe(3);
  });

  it('rejects a bad quantity and an unknown line', () => {
    expect(codeOf(() => updateLineQuantity(cart, 'l1', 0))).toBe(
      'input_invalid',
    );
    expect(codeOf(() => updateLineQuantity(cart, 'nope', 1))).toBe(
      'line_not_found',
    );
    expect(codeOf(() => removeLine(cart, 'nope'))).toBe('line_not_found');
  });

  it('removes by id and counts pieces, not lines', () => {
    expect(cartCount(cart)).toBe(5);
    const next = removeLine(cart, 'l1');
    expect(next.items.map((line) => line.id)).toEqual(['l2']);
    expect(cartCount(next)).toBe(3);
    expect(cartCount(emptyCart())).toBe(0);
  });
});
