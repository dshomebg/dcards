import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Shop from '@/modules/shop';

import { PRODUCT_ID, testProduct } from './test-fixtures';

const auth = vi.hoisted(() => ({ getCurrentAdmin: vi.fn() }));
const shop = vi.hoisted(() => ({
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  replaceVariants: vi.fn(),
  deleteProduct: vi.fn(),
}));
const rateLimit = vi.hoisted(() => ({
  consume: vi.fn(() => Promise.resolve({ allowed: true, retryAfterSec: 0 })),
}));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));

// Barrel-ът на `auth` носи `server-only`; `core` отваря пул при импорт.
vi.mock('@/modules/auth', () => auth);
vi.mock('@/modules/core', async () => ({
  db: { transaction: (fn: (tx: object) => unknown) => fn({}) },
  rateLimit,
  ...(await vi.importActual('@/modules/core/rate-limit/policy')),
}));
vi.mock('@/modules/shop', async (importOriginal) => ({
  ...(await importOriginal<typeof Shop>()),
  ...shop,
}));
vi.mock('next/cache', () => cache);
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const { ProductError } = await import('@/modules/shop');
const { createProductAction, deleteProductAction, saveProductAction } =
  await import('./actions');

const admin = {
  id: '019969a0-0000-7000-8000-000000000001',
  email: 'a@x.bg',
  name: 'A',
};

const input = {
  slug: 'pvc-classic',
  name: ' PVC Classic ',
  description: '',
  material: 'pvc',
  basePrice: '19,90',
  isActive: true,
  variants: [
    {
      id: '019969a0-0000-7000-8000-0000000000b1',
      name: 'Бяла',
      priceDelta: '0',
      sku: 'PVC-B',
      stock: 10,
      isActive: true,
    },
    {
      id: '',
      name: 'Черна',
      priceDelta: '-2.50',
      sku: '',
      stock: 5,
      isActive: false,
    },
  ],
};

const expectedFields = {
  slug: 'pvc-classic',
  name: 'PVC Classic',
  description: null,
  material: 'pvc',
  basePrice: 1990,
  isActive: true,
};
const expectedVariants = [
  {
    id: '019969a0-0000-7000-8000-0000000000b1',
    name: 'Бяла',
    priceDelta: 0,
    sku: 'PVC-B',
    stock: 10,
    isActive: true,
  },
  {
    id: undefined,
    name: 'Черна',
    priceDelta: -250,
    sku: null,
    stock: 5,
    isActive: false,
  },
];

const updated = testProduct({ variants: [] });
const savedVariants = testProduct().variants;

beforeEach(() => {
  auth.getCurrentAdmin.mockReset().mockResolvedValue(admin);
  shop.createProduct.mockReset().mockResolvedValue({ id: PRODUCT_ID });
  shop.updateProduct.mockReset().mockResolvedValue(updated);
  shop.replaceVariants.mockReset().mockResolvedValue(savedVariants);
  shop.deleteProduct.mockReset().mockResolvedValue(undefined);
  rateLimit.consume.mockClear();
  rateLimit.consume.mockResolvedValue({ allowed: true, retryAfterSec: 0 });
  cache.revalidatePath.mockClear();
});

describe('createProductAction', () => {
  it('rejects invalid input before touching the session', async () => {
    for (const bad of [
      { ...input, basePrice: 'abc' },
      { ...input, slug: 'Ab' },
      { ...input, variants: [{ ...input.variants[0], stock: -1 }] },
      'nope',
    ]) {
      expect((await createProductAction(bad)).ok).toBe(false);
    }
    expect(auth.getCurrentAdmin).not.toHaveBeenCalled();
    expect(shop.createProduct).not.toHaveBeenCalled();
  });

  it('redirects to /admin/login without an admin', async () => {
    auth.getCurrentAdmin.mockResolvedValue(null);
    await expect(createProductAction(input)).rejects.toThrow(
      'REDIRECT:/admin/login',
    );
    expect(shop.createProduct).not.toHaveBeenCalled();
  });

  it('counts the action per admin and refuses past the limit', async () => {
    rateLimit.consume.mockResolvedValue({ allowed: false, retryAfterSec: 20 });
    expect(await createProductAction(input)).toEqual({
      ok: false,
      message: 'Твърде много опити. Опитай след 1 минути.',
    });
    expect(rateLimit.consume).toHaveBeenCalledWith(
      `rl:action:user:${admin.id}`,
      60,
      60,
    );
    expect(shop.createProduct).not.toHaveBeenCalled();
  });

  it('creates with minor units and redirects to the editor', async () => {
    await expect(createProductAction(input)).rejects.toThrow(
      `REDIRECT:/admin/products/${PRODUCT_ID}`,
    );
    expect(shop.createProduct).toHaveBeenCalledWith(expect.anything(), {
      fields: expectedFields,
      variants: expectedVariants,
    });
    expect(cache.revalidatePath).toHaveBeenCalledWith('/admin/products');
  });

  it('returns the ProductError message and hides unexpected errors', async () => {
    shop.createProduct.mockRejectedValue(new ProductError('slug_taken'));
    expect(await createProductAction(input)).toEqual({
      ok: false,
      message: 'Този адрес вече е зает от друг продукт.',
    });

    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    shop.createProduct.mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await createProductAction(input);
    expect(result.ok).toBe(false);
    expect(result.message).not.toContain('ECONNREFUSED');
    error.mockRestore();
  });
});

describe('saveProductAction', () => {
  it('rejects a non-UUID id and invalid input before touching the session', async () => {
    expect((await saveProductAction('abc', input)).ok).toBe(false);
    expect(
      (await saveProductAction(PRODUCT_ID, { ...input, name: '' })).ok,
    ).toBe(false);
    expect(auth.getCurrentAdmin).not.toHaveBeenCalled();
  });

  it('redirects to /admin/login without an admin', async () => {
    auth.getCurrentAdmin.mockResolvedValue(null);
    await expect(saveProductAction(PRODUCT_ID, input)).rejects.toThrow(
      'REDIRECT:/admin/login',
    );
  });

  it('refuses past the limit', async () => {
    rateLimit.consume.mockResolvedValue({ allowed: false, retryAfterSec: 20 });
    expect((await saveProductAction(PRODUCT_ID, input)).ok).toBe(false);
    expect(shop.updateProduct).not.toHaveBeenCalled();
  });

  it('saves fields and variants in one transaction and returns the DTO', async () => {
    expect(await saveProductAction(PRODUCT_ID, input)).toEqual({
      ok: true,
      product: { ...updated, variants: savedVariants },
    });
    // `{}` е `tx` от мока на `db.transaction` — сервизите делят една транзакция.
    expect(shop.updateProduct).toHaveBeenCalledWith(
      {},
      PRODUCT_ID,
      expectedFields,
      { variantsFollow: true },
    );
    expect(shop.replaceVariants).toHaveBeenCalledWith(
      {},
      PRODUCT_ID,
      expectedVariants,
    );
    expect(cache.revalidatePath).toHaveBeenCalledWith('/admin/products');
    expect(cache.revalidatePath).toHaveBeenCalledWith(
      `/admin/products/${PRODUCT_ID}`,
    );
  });

  it('returns the ProductError message from the variants step', async () => {
    shop.replaceVariants.mockRejectedValue(new ProductError('price_negative'));
    expect(await saveProductAction(PRODUCT_ID, input)).toEqual({
      ok: false,
      message: 'Цената на вариант не може да е под нула.',
    });
  });

  it('hides unexpected errors behind a generic message', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    shop.updateProduct.mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await saveProductAction(PRODUCT_ID, input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).not.toContain('ECONNREFUSED');
    error.mockRestore();
  });
});

describe('deleteProductAction', () => {
  it('rejects a non-UUID id before touching the session', async () => {
    expect((await deleteProductAction('abc')).ok).toBe(false);
    expect(auth.getCurrentAdmin).not.toHaveBeenCalled();
  });

  it('redirects to /admin/login without an admin', async () => {
    auth.getCurrentAdmin.mockResolvedValue(null);
    await expect(deleteProductAction(PRODUCT_ID)).rejects.toThrow(
      'REDIRECT:/admin/login',
    );
  });

  it('refuses past the limit', async () => {
    rateLimit.consume.mockResolvedValue({ allowed: false, retryAfterSec: 20 });
    expect((await deleteProductAction(PRODUCT_ID)).ok).toBe(false);
    expect(shop.deleteProduct).not.toHaveBeenCalled();
  });

  it('returns the ProductError message for a missing product', async () => {
    shop.deleteProduct.mockRejectedValue(new ProductError('product_not_found'));
    expect(await deleteProductAction(PRODUCT_ID)).toEqual({
      ok: false,
      message: 'Продуктът не съществува.',
    });
  });

  it('deletes and redirects to the list', async () => {
    await expect(deleteProductAction(PRODUCT_ID)).rejects.toThrow(
      'REDIRECT:/admin/products',
    );
    expect(shop.deleteProduct).toHaveBeenCalledWith(
      expect.anything(),
      PRODUCT_ID,
    );
    expect(cache.revalidatePath).toHaveBeenCalledWith('/admin/products');
  });
});
