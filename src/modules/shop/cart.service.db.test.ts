import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/modules/core';

import { addLine, emptyCart } from './cart';
import { isVariantActive, priceCart } from './cart.service';
import { productVariants } from './product.schema';
import { createProduct } from './product.service';

afterAll(async () => {
  await db.$client.end({ timeout: 5 });
});

const UNKNOWN_ID = '019969a0-0000-7000-8000-0000000000ff';

const fields = (slug: string, isActive = true) => ({
  slug,
  name: 'PVC Classic',
  description: null,
  material: 'pvc' as const,
  basePrice: 1990,
  isActive,
});

const variant = (name: string, priceDelta: number, stock: number) => ({
  name,
  priceDelta,
  sku: null,
  stock,
  isActive: true,
});

const line = (variantId: string, quantity: number, name = 'Иван') => ({
  variantId,
  quantity,
  personalization: { name, title: null, notes: null },
});

async function seed(slug: string, isActive = true) {
  const product = await createProduct(db, {
    fields: fields(slug, isActive),
    variants: [variant('Бяла', 0, 5), variant('Черна', 250, 0)],
  });
  const rows = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, product.id))
    .orderBy(productVariants.sortOrder);
  const [white, black] = rows;
  if (white === undefined || black === undefined) throw new Error('seed');
  return { product, white, black };
}

describe('priceCart', () => {
  it('prices from basePrice + priceDelta and sums only available lines', async () => {
    const { white, black } = await seed('price-cart');
    const cart = addLine(
      addLine(emptyCart(), line(white.id, 2), 'l1'),
      line(black.id, 1, 'Мария'),
      'l2',
    );

    const view = await priceCart(db, cart);
    expect(view.lines.map((l) => l.id)).toEqual(['l1', 'l2']);
    expect(view.lines[0]).toMatchObject({
      productSlug: 'price-cart',
      productName: 'PVC Classic',
      variantName: 'Бяла',
      unitPrice: 1990,
      quantity: 2,
      lineTotal: 3980,
      available: true,
    });
    expect(view.lines[1]).toMatchObject({
      variantName: 'Черна',
      unitPrice: 2240,
      lineTotal: 0,
      available: false,
      reason: 'out_of_stock',
    });
    expect(view.subtotal).toBe(3980);
    expect(view.count).toBe(3);
  });

  it('marks stock below quantity as out of stock without leaking the number', async () => {
    const { white } = await seed('price-stock');
    const view = await priceCart(
      db,
      addLine(emptyCart(), line(white.id, 6), 'l1'),
    );
    expect(view.lines[0]?.available).toBe(false);
    expect(view.lines[0]?.reason).toBe('out_of_stock');
    expect(view.subtotal).toBe(0);
    expect(Object.keys(view.lines[0] ?? {})).not.toContain('stock');
  });

  it('marks an inactive product, inactive variant or unknown id as unavailable', async () => {
    const inactive = await seed('price-inactive', false);
    const { white } = await seed('price-variant');
    await db
      .update(productVariants)
      .set({ isActive: false })
      .where(eq(productVariants.id, white.id));

    const cart = addLine(
      addLine(
        addLine(emptyCart(), line(inactive.white.id, 1), 'l1'),
        line(white.id, 1),
        'l2',
      ),
      line(UNKNOWN_ID, 1),
      'l3',
    );
    const view = await priceCart(db, cart);
    expect(view.lines.map((l) => l.reason)).toEqual([
      'unavailable',
      'unavailable',
      'unavailable',
    ]);
    expect(view.lines[2]?.productSlug).toBe('');
    expect(view.subtotal).toBe(0);
  });

  it('returns an empty view for an empty cart without a query error', async () => {
    expect(await priceCart(db, emptyCart())).toEqual({
      lines: [],
      subtotal: 0,
      count: 0,
    });
  });
});

describe('isVariantActive', () => {
  it('is true only for an active variant of an active product', async () => {
    const { white, black } = await seed('active-check');
    const inactive = await seed('active-check-off', false);
    expect(await isVariantActive(db, white.id)).toBe(true);
    // Изчерпан, но активен — наличността се решава в количката.
    expect(await isVariantActive(db, black.id)).toBe(true);
    expect(await isVariantActive(db, inactive.white.id)).toBe(false);
    expect(await isVariantActive(db, UNKNOWN_ID)).toBe(false);
  });
});
