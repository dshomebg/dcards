import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/modules/core';

import { addLine, emptyCart } from './cart';
import { placeOrder } from './order.service';
import { products, productVariants } from './product.schema';
import { createProduct, ProductError } from './product.service';
import {
  deleteProduct,
  getProductForEdit,
  replaceVariants,
  updateProduct,
} from './product-edit.service';

afterAll(async () => {
  await db.$client.end({ timeout: 5 });
});

const fields = {
  name: 'PVC Classic',
  description: null,
  material: 'pvc',
  basePrice: 1990,
  isActive: true,
} as const;

const variant = (name: string, priceDelta = 0, sku: string | null = null) => ({
  name,
  priceDelta,
  sku,
  stock: 5,
  isActive: true,
});

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ProductError) return error.code;
    throw error;
  }
  throw new Error('expected a ProductError');
}

async function seed(slug: string) {
  const product = await createProduct(db, {
    fields: { ...fields, slug },
    variants: [variant('Бяла', 0, `${slug}-B`), variant('Черна', 250)],
  });
  const dto = await getProductForEdit(db, product.id);
  if (dto === null) throw new Error('seed missing');
  return dto;
}

const rowsOf = (productId: string) =>
  db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, productId))
    .orderBy(productVariants.sortOrder);

const MISSING = '019969a0-0000-7000-8000-0000000000ff';

describe('getProductForEdit', () => {
  it('returns all fields and variants by sortOrder; null when missing', async () => {
    const dto = await seed('edit-one');
    expect(dto).toMatchObject({ slug: 'edit-one', basePrice: 1990 });
    expect(dto.variants.map((v) => [v.name, v.sortOrder, v.sku])).toEqual([
      ['Бяла', 0, 'edit-one-B'],
      ['Черна', 1, null],
    ]);
    expect(dto).not.toHaveProperty('images');
    expect(await getProductForEdit(db, MISSING)).toBeNull();
  });
});

describe('updateProduct', () => {
  it('updates fields and bumps updatedAt', async () => {
    const dto = await seed('upd-one');
    await new Promise((resolve) => setTimeout(resolve, 5));
    const updated = await updateProduct(db, dto.id, {
      ...fields,
      slug: 'upd-one-2',
      basePrice: 2500,
      isActive: false,
    });
    expect(updated).toMatchObject({
      slug: 'upd-one-2',
      basePrice: 2500,
      isActive: false,
    });
    expect(updated.updatedAt.getTime()).toBeGreaterThan(
      dto.updatedAt.getTime(),
    );
    expect(updated.variants).toHaveLength(2);
  });

  it('product_not_found, slug_taken, slug_invalid', async () => {
    await seed('upd-taken');
    const dto = await seed('upd-mine');
    await expect(
      codeOf(updateProduct(db, MISSING, { ...fields, slug: 'x-y' })),
    ).resolves.toBe('product_not_found');
    await expect(
      codeOf(updateProduct(db, dto.id, { ...fields, slug: 'upd-taken' })),
    ).resolves.toBe('slug_taken');
    await expect(
      codeOf(updateProduct(db, dto.id, { ...fields, slug: 'Ab' })),
    ).resolves.toBe('slug_invalid');
  });

  it('price_negative when the new base price drops a variant below zero', async () => {
    const dto = await seed('upd-neg');
    await replaceVariants(db, dto.id, [variant('Евтина', -1500)]);
    await expect(
      codeOf(
        updateProduct(db, dto.id, {
          ...fields,
          slug: 'upd-neg',
          basePrice: 1000,
        }),
      ),
    ).resolves.toBe('price_negative');
  });
});

describe('replaceVariants', () => {
  it('keeps ids of given rows, deletes missing, inserts new, reorders', async () => {
    const dto = await seed('rep-one');
    const [white, black] = dto.variants;
    if (white === undefined || black === undefined) throw new Error('seed');

    const saved = await replaceVariants(db, dto.id, [
      { id: black.id, ...variant('Черна', 300, 'REP-C') },
      { ...variant('Зелена'), stock: 1 },
    ]);
    expect(saved.map((v) => [v.id === black.id, v.name, v.sortOrder])).toEqual([
      [true, 'Черна', 0],
      [false, 'Зелена', 1],
    ]);
    const rows = await rowsOf(dto.id);
    expect(rows.map((row) => row.id)).not.toContain(white.id);
    expect(rows.map((row) => [row.name, row.priceDelta, row.sku])).toEqual([
      ['Черна', 300, 'REP-C'],
      ['Зелена', 0, null],
    ]);
  });

  it('variant_foreign for an id of another product; nothing is written', async () => {
    const other = await seed('rep-other');
    const dto = await seed('rep-mine');
    const foreign = other.variants[0]?.id;
    if (foreign === undefined) throw new Error('seed');
    const before = await rowsOf(dto.id);
    await expect(
      codeOf(
        replaceVariants(db, dto.id, [
          variant('Нова'),
          { id: foreign, ...variant('Чужда') },
        ]),
      ),
    ).resolves.toBe('variant_foreign');
    expect(await rowsOf(dto.id)).toEqual(before);
    expect(await rowsOf(other.id)).toHaveLength(2);
  });

  it('price_negative, sku_duplicate, sku_taken, product_not_found; input untouched', async () => {
    await seed('rep-sku');
    const dto = await seed('rep-errors');
    const before = await rowsOf(dto.id);
    const cases = [
      [[variant('X', -2000)], 'price_negative'],
      [[variant('A', 0, 'D'), variant('B', 0, 'D')], 'sku_duplicate'],
      [[variant('A', 0, 'rep-sku-B')], 'sku_taken'],
    ] as const;
    for (const [input, code] of cases) {
      await expect(codeOf(replaceVariants(db, dto.id, input))).resolves.toBe(
        code,
      );
      expect(await rowsOf(dto.id)).toEqual(before);
    }
    await expect(
      codeOf(replaceVariants(db, MISSING, [variant('A')])),
    ).resolves.toBe('product_not_found');
  });

  it('empties the list', async () => {
    const dto = await seed('rep-empty');
    expect(await replaceVariants(db, dto.id, [])).toEqual([]);
    expect(await rowsOf(dto.id)).toHaveLength(0);
  });
});

describe('deleteProduct', () => {
  it('deletes the product with its variants; product_not_found when missing', async () => {
    const dto = await seed('del-one');
    await deleteProduct(db, dto.id);
    expect(
      await db.select().from(products).where(eq(products.id, dto.id)),
    ).toHaveLength(0);
    expect(await rowsOf(dto.id)).toHaveLength(0);
    await expect(codeOf(deleteProduct(db, dto.id))).resolves.toBe(
      'product_not_found',
    );
  });
});

describe('restrict from order_items', () => {
  it('refuses to delete a variant or product with orders and keeps the product', async () => {
    const dto = await seed('del-ordered');
    const [white, black] = dto.variants;
    if (white === undefined || black === undefined) throw new Error('seed');
    await placeOrder(db, {
      cart: addLine(
        emptyCart(),
        {
          variantId: white.id,
          quantity: 1,
          personalization: {
            name: 'А',
            title: null,
            notes: null,
            logoKey: null,
          },
        },
        'l1',
      ),
      customer: { name: 'Иван', phone: '+359881234567', email: 'i@x.bg' },
      shipping: { courier: 'econt', address: null, office: 'Офис', note: null },
      actor: null,
    });

    expect(
      await codeOf(
        replaceVariants(db, dto.id, [
          { ...variant('Черна', 250), id: black.id },
        ]),
      ),
    ).toBe('has_orders');
    expect(await rowsOf(dto.id)).toHaveLength(2);

    expect(await codeOf(deleteProduct(db, dto.id))).toBe('has_orders');
    expect(
      await db.select().from(products).where(eq(products.id, dto.id)),
    ).toHaveLength(1);
  });
});
