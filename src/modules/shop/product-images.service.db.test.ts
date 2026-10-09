import { eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/modules/core';

import { addLine, emptyCart } from './cart';
import { priceCart } from './cart.service';
import { placeOrder } from './order.service';
import { products, productVariants } from './product.schema';
import {
  createProduct,
  getActiveProductBySlug,
  listActiveProducts,
  ProductError,
} from './product.service';
import { deleteProduct, getProductForEdit } from './product-edit.service';
import {
  addProductImage,
  removeProductImage,
  reorderProductImages,
} from './product-images.service';

afterAll(async () => {
  await db.$client.end({ timeout: 5 });
});

const MISSING = '019969a0-0000-7000-8000-0000000000ff';

const key = (n: number) =>
  `products/00000000-0000-4000-8000-${String(n).padStart(12, '0')}.webp`;

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ProductError) return error.code;
    throw error;
  }
  throw new Error('expected a ProductError');
}

async function seed(slug: string, images: readonly string[] = []) {
  const product = await createProduct(db, {
    fields: {
      slug,
      name: 'PVC Classic',
      description: null,
      material: 'pvc',
      basePrice: 1990,
      isActive: true,
    },
    variants: [
      { name: 'Бяла', priceDelta: 0, sku: null, stock: 5, isActive: true },
    ],
  });
  if (images.length > 0) {
    await db
      .update(products)
      .set({ images: [...images] })
      .where(eq(products.id, product.id));
  }
  return product.id;
}

const lineFor = (variantId: string) => ({
  variantId,
  quantity: 1,
  personalization: { name: 'Иван', title: null, notes: null, logoKey: null },
});

const imagesOf = async (id: string) =>
  (await getProductForEdit(db, id))?.images ?? null;

describe('addProductImage', () => {
  it('appends a server key and returns the slug for revalidation', async () => {
    const id = await seed('img-add');
    expect(await addProductImage(db, id, key(1))).toEqual({
      slug: 'img-add',
      images: [key(1)],
    });
    await addProductImage(db, id, key(2));
    expect(await imagesOf(id)).toEqual([key(1), key(2)]);
  });

  it('refuses a non-product key and a missing product', async () => {
    const id = await seed('img-bad-key');
    for (const bad of [
      'logos/00000000-0000-4000-8000-000000000001.webp',
      'products/../x',
      'products/x.webp',
    ]) {
      expect(await codeOf(addProductImage(db, id, bad))).toBe('input_invalid');
    }
    expect(await codeOf(addProductImage(db, MISSING, key(1)))).toBe(
      'product_not_found',
    );
    expect(await imagesOf(id)).toEqual([]);
  });

  it('caps at six under the lock, also for parallel uploads', async () => {
    const id = await seed('img-cap', [1, 2, 3, 4].map(key));
    const results = await Promise.allSettled(
      [5, 6, 7, 8].map((n) => addProductImage(db, id, key(n))),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
    const refused = results.filter((r) => r.status === 'rejected');
    expect(refused).toHaveLength(2);
    for (const r of refused) {
      expect((r.reason as ProductError).code).toBe('images_full');
    }
    expect(await imagesOf(id)).toHaveLength(6);
  });

  it('keeps both of two parallel uploads', async () => {
    const id = await seed('img-parallel');
    await Promise.all([
      addProductImage(db, id, key(1)),
      addProductImage(db, id, key(2)),
    ]);
    expect(await imagesOf(id)).toEqual(
      expect.arrayContaining([key(1), key(2)]),
    );
    expect(await imagesOf(id)).toHaveLength(2);
  });
});

describe('removeProductImage', () => {
  it('removes own key; a foreign key is refused and nothing changes', async () => {
    const id = await seed('img-remove', [key(1), key(2)]);
    const other = await seed('img-remove-other', [key(9)]);
    expect(await codeOf(removeProductImage(db, id, key(9)))).toBe(
      'image_foreign',
    );
    expect(await imagesOf(id)).toEqual([key(1), key(2)]);
    expect(await imagesOf(other)).toEqual([key(9)]);

    expect((await removeProductImage(db, id, key(1))).images).toEqual([key(2)]);
    expect(await imagesOf(id)).toEqual([key(2)]);
  });
});

describe('reorderProductImages', () => {
  it('accepts only a permutation of the current images', async () => {
    const id = await seed('img-order', [key(1), key(2), key(3)]);
    for (const bad of [
      [key(1), key(2)],
      [key(1), key(2), key(3), key(4)],
      [key(1), key(1), key(2)],
      [key(1), key(2), key(4)],
      ['../etc/passwd', key(2), key(3)],
    ]) {
      expect(await codeOf(reorderProductImages(db, id, bad))).toBe(
        'image_order_invalid',
      );
    }
    expect(await imagesOf(id)).toEqual([key(1), key(2), key(3)]);

    await reorderProductImages(db, id, [key(3), key(1), key(2)]);
    expect(await imagesOf(id)).toEqual([key(3), key(1), key(2)]);
  });
});

describe('deleteProduct', () => {
  it('returns the image keys of the deleted row', async () => {
    const id = await seed('img-delete', [key(1), key(2)]);
    expect(await deleteProduct(db, id)).toEqual([key(1), key(2)]);
  });

  it('keeps the row and returns nothing when the product has orders', async () => {
    const id = await seed('img-delete-orders', [key(1)]);
    const [variant] = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, id));
    if (variant === undefined) throw new Error('seed');
    await placeOrder(db, {
      cart: addLine(emptyCart(), lineFor(variant.id), 'l1'),
      customer: { name: 'Иван', phone: '+359881234567', email: 'i@x.bg' },
      shipping: { courier: 'econt', address: null, office: 'Офис', note: null },
      actor: null,
    });
    expect(await codeOf(deleteProduct(db, id))).toBe('has_orders');
    expect(await imagesOf(id)).toEqual([key(1)]);
  });
});

describe('public reads', () => {
  it('show the primary image and all images in order; bad elements are skipped', async () => {
    const bad = [42, 'logos/00000000-0000-4000-8000-000000000001.webp', '../x'];
    const id = await seed('img-public', [
      ...(bad as unknown as string[]),
      key(2),
      key(1),
    ]);

    const summary = (await listActiveProducts(db)).find(
      (row) => row.slug === 'img-public',
    );
    expect(summary?.imageKey).toBe(key(2));
    expect((await getActiveProductBySlug(db, 'img-public'))?.images).toEqual([
      key(2),
      key(1),
    ]);
    expect(await imagesOf(id)).toEqual([key(2), key(1)]);
  });

  it('a non-array value reads as no images, not a 500', async () => {
    const id = await seed('img-scalar');
    await db
      .update(products)
      .set({ images: sql`'{"x":1}'::jsonb` })
      .where(eq(products.id, id));
    expect((await getActiveProductBySlug(db, 'img-scalar'))?.images).toEqual(
      [],
    );
    const summary = (await listActiveProducts(db)).find(
      (row) => row.slug === 'img-scalar',
    );
    expect(summary?.imageKey).toBeNull();
  });

  it('the cart line carries the primary image', async () => {
    const id = await seed('img-cart', [key(3), key(4)]);
    const [variant] = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, id));
    if (variant === undefined) throw new Error('seed');
    const view = await priceCart(
      db,
      addLine(emptyCart(), lineFor(variant.id), 'l1'),
    );
    expect(view.lines[0]?.imageKey).toBe(key(3));
  });
});
