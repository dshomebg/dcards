import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/modules/core';

import { products, productVariants } from './product.schema';
import {
  createProduct,
  getActiveProductBySlug,
  listActiveProducts,
  listProductsForAdmin,
  ProductError,
  variantsInputSchema,
} from './product.service';

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

const variantsOf = (productId: string) =>
  db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, productId))
    .orderBy(productVariants.sortOrder);

/** Името на нарушения CHECK — драйверът го носи в `cause.constraint_name`. */
async function constraintOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    const cause = (error as { cause?: { constraint_name?: string } }).cause;
    return cause?.constraint_name ?? 'none';
  }
  throw new Error('expected a db error');
}

describe('schema constraints', () => {
  it('rejects a bad slug, a negative base price and a negative stock', async () => {
    for (const slug of ['Ab', '-abc', 'ab']) {
      await expect(
        constraintOf(db.insert(products).values({ ...fields, slug })),
      ).resolves.toBe('products_slug_format');
    }
    await expect(
      constraintOf(
        db.insert(products).values({ ...fields, slug: 'neg', basePrice: -1 }),
      ),
    ).resolves.toBe('products_base_price_nonneg');

    const product = await createProduct(db, {
      fields: { ...fields, slug: 'stock' },
    });
    await expect(
      constraintOf(
        db
          .insert(productVariants)
          .values({ productId: product.id, name: 'x', stock: -1 }),
      ),
    ).resolves.toBe('product_variants_stock_nonneg');
  });
});

describe('createProduct', () => {
  it('inserts the product and its variants in input order; images is []', async () => {
    const product = await createProduct(db, {
      fields: { ...fields, slug: 'pvc-classic', description: 'Хубава.' },
      variants: [variant('Бяла'), variant('Черна', 250, 'PVC-C')],
    });
    expect(product).toMatchObject({
      slug: 'pvc-classic',
      basePrice: 1990,
      images: [],
    });
    const rows = await variantsOf(product.id);
    expect(rows.map((row) => [row.name, row.sortOrder, row.sku])).toEqual([
      ['Бяла', 0, null],
      ['Черна', 1, 'PVC-C'],
    ]);
  });

  it('slug_invalid and input_invalid before any query', async () => {
    await expect(
      codeOf(createProduct(db, { fields: { ...fields, slug: 'Ab' } })),
    ).resolves.toBe('slug_invalid');
    await expect(
      codeOf(
        createProduct(db, { fields: { ...fields, slug: 'x-ok', name: '' } }),
      ),
    ).resolves.toBe('input_invalid');
  });

  it('slug_taken for a second product with the same slug', async () => {
    await createProduct(db, { fields: { ...fields, slug: 'taken' } });
    await expect(
      codeOf(createProduct(db, { fields: { ...fields, slug: 'taken' } })),
    ).resolves.toBe('slug_taken');
  });

  it('sku_taken across products; sku_duplicate within one input (no row written)', async () => {
    await createProduct(db, {
      fields: { ...fields, slug: 'sku-a' },
      variants: [variant('A', 0, 'SKU-1')],
    });
    await expect(
      codeOf(
        createProduct(db, {
          fields: { ...fields, slug: 'sku-b' },
          variants: [variant('B', 0, 'SKU-1')],
        }),
      ),
    ).resolves.toBe('sku_taken');
    expect(
      await db.select().from(products).where(eq(products.slug, 'sku-b')),
    ).toHaveLength(0);

    await expect(
      codeOf(
        createProduct(db, {
          fields: { ...fields, slug: 'sku-c' },
          variants: [variant('C1', 0, 'SKU-2'), variant('C2', 0, 'SKU-2')],
        }),
      ),
    ).resolves.toBe('sku_duplicate');
    expect(
      await db.select().from(products).where(eq(products.slug, 'sku-c')),
    ).toHaveLength(0);
  });

  it('accepts several variants with sku = null and empty sku → null', async () => {
    const product = await createProduct(db, {
      fields: { ...fields, slug: 'null-sku' },
      variants: [variant('A'), variant('B'), { ...variant('C'), sku: '' }],
    });
    const rows = await variantsOf(product.id);
    expect(rows.map((row) => row.sku)).toEqual([null, null, null]);
  });

  it('price_negative when basePrice + priceDelta < 0', async () => {
    await expect(
      codeOf(
        createProduct(db, {
          fields: { ...fields, slug: 'neg-delta' },
          variants: [variant('X', -2000)],
        }),
      ),
    ).resolves.toBe('price_negative');
  });
});

describe('variantsInputSchema', () => {
  it('flags duplicated non-null SKUs, ignores nulls', () => {
    expect(
      variantsInputSchema.safeParse([variant('a'), variant('b')]).success,
    ).toBe(true);
    expect(
      variantsInputSchema.safeParse([
        variant('a', 0, 'S'),
        variant('b', 0, 'S'),
      ]).success,
    ).toBe(false);
  });
});

describe('listProductsForAdmin / public reads', () => {
  it('lists with variant counts; public reads skip inactive product and variants', async () => {
    const active = await createProduct(db, {
      fields: { ...fields, slug: 'pub-active' },
      variants: [
        variant('On', 250, 'PUB-1'),
        { ...variant('Off', 0, 'PUB-2'), isActive: false },
        { ...variant('Out', 0, 'PUB-3'), stock: 0 },
      ],
    });
    await createProduct(db, {
      fields: { ...fields, slug: 'pub-hidden', isActive: false },
      variants: [variant('H')],
    });

    const admin = await listProductsForAdmin(db);
    expect(admin.find((row) => row.id === active.id)).toMatchObject({
      slug: 'pub-active',
      variantCount: 3,
      isActive: true,
    });
    expect(admin.find((row) => row.slug === 'pub-hidden')?.variantCount).toBe(
      1,
    );

    const summaries = await listActiveProducts(db);
    expect(summaries.some((row) => row.slug === 'pub-hidden')).toBe(false);
    expect(summaries.find((row) => row.slug === 'pub-active')).toEqual({
      slug: 'pub-active',
      name: 'PVC Classic',
      material: 'pvc',
      basePrice: 1990,
    });

    expect(await getActiveProductBySlug(db, 'pub-hidden')).toBeNull();
    expect(await getActiveProductBySlug(db, 'nope')).toBeNull();
    const dto = await getActiveProductBySlug(db, 'pub-active');
    expect(dto?.variants.map((v) => [v.name, v.price, v.inStock])).toEqual([
      ['On', 2240, true],
      ['Out', 1990, false],
    ]);
    expect(dto?.variants[0]).not.toHaveProperty('stock');
    expect(dto?.variants[0]).not.toHaveProperty('sku');
  });
});
