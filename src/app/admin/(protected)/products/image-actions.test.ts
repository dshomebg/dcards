import sharp from 'sharp';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Shop from '@/modules/shop';

import { PRODUCT_ID } from './test-fixtures';

const auth = vi.hoisted(() => ({ getCurrentAdmin: vi.fn() }));
const shop = vi.hoisted(() => ({
  addProductImage: vi.fn(),
  removeProductImage: vi.fn(),
  reorderProductImages: vi.fn(),
}));
type Consumed = { allowed: boolean; retryAfterSec: number };
const rateLimit = vi.hoisted(() => ({
  consume: vi.fn((_key: string): Promise<Consumed> =>
    Promise.resolve({ allowed: true, retryAfterSec: 0 }),
  ),
}));
const storage = vi.hoisted(() => ({
  putObject: vi.fn(),
  deleteObject: vi.fn(),
}));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));

// `core` отваря пул при импорт — sharp и ключовете са истински, дискът е mock.
vi.mock('@/modules/auth', () => auth);
vi.mock('@/modules/core', async () => ({
  db: {},
  rateLimit,
  ...storage,
  ...(await vi.importActual('@/modules/core/rate-limit/policy')),
  ...(await vi.importActual('@/modules/core/image/process')),
  createObjectKey: (kind: string) =>
    `${kind}/00000000-0000-4000-8000-000000000000.webp`,
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
const {
  removeProductImageAction,
  reorderProductImagesAction,
  uploadProductImageAction,
} = await import('./image-actions');

const admin = { id: '019969a0-0000-7000-8000-000000000001', email: 'a@x.bg' };
const NEW_KEY = 'products/00000000-0000-4000-8000-000000000000.webp';
const OLD_KEY = 'products/11111111-1111-4111-8111-111111111111.webp';

async function png(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: '#A67C52' },
  })
    .png()
    .toBuffer();
}

function form(bytes: Uint8Array | Buffer, name = 'p.png', type = 'image/png') {
  const data = new FormData();
  data.set(
    'file',
    new File([bytes as Uint8Array<ArrayBuffer>], name, { type }),
  );
  return data;
}

beforeEach(() => {
  auth.getCurrentAdmin.mockReset().mockResolvedValue(admin);
  shop.addProductImage
    .mockReset()
    .mockResolvedValue({ slug: 'pvc-classic', images: [OLD_KEY, NEW_KEY] });
  shop.removeProductImage
    .mockReset()
    .mockResolvedValue({ slug: 'pvc-classic', images: [] });
  shop.reorderProductImages
    .mockReset()
    .mockResolvedValue({ slug: 'pvc-classic', images: [OLD_KEY] });
  rateLimit.consume.mockClear();
  rateLimit.consume.mockResolvedValue({ allowed: true, retryAfterSec: 0 });
  storage.putObject.mockReset().mockResolvedValue(undefined);
  storage.deleteObject.mockReset().mockResolvedValue(undefined);
  cache.revalidatePath.mockClear();
});

describe('uploadProductImageAction', () => {
  it('stores a 1200 px WebP under products/ and revalidates the storefront', async () => {
    const result = await uploadProductImageAction(
      PRODUCT_ID,
      form(await png(2400, 1200)),
    );
    expect(result).toEqual({ ok: true, images: [OLD_KEY, NEW_KEY] });
    const [key, data] = storage.putObject.mock.calls[0] as [string, Buffer];
    expect(key).toBe(NEW_KEY);
    const meta = await sharp(data).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', 1200, 600]);
    expect(shop.addProductImage).toHaveBeenCalledWith({}, PRODUCT_ID, NEW_KEY);
    for (const path of [
      `/admin/products/${PRODUCT_ID}`,
      '/products',
      '/products/pvc-classic',
      '/',
    ]) {
      expect(cache.revalidatePath).toHaveBeenCalledWith(path);
    }
    expect(rateLimit.consume.mock.calls.map(([k]) => k)).toEqual([
      `rl:action:user:${admin.id}`,
      `rl:image-upload:admin:${admin.id}`,
    ]);
  });

  it('rejects a bad id, no file and a big file before the session and the limit', async () => {
    const big = form(Buffer.alloc(2 * 1024 * 1024 + 1));
    for (const [id, data] of [
      ['abc', form(await png(10, 10))],
      [PRODUCT_ID, new FormData()],
      [PRODUCT_ID, big],
    ] as const) {
      expect((await uploadProductImageAction(id, data)).ok).toBe(false);
    }
    expect(auth.getCurrentAdmin).not.toHaveBeenCalled();
    expect(rateLimit.consume).not.toHaveBeenCalled();
  });

  it('redirects to /admin/login without an admin and writes nothing', async () => {
    auth.getCurrentAdmin.mockResolvedValue(null);
    await expect(
      uploadProductImageAction(PRODUCT_ID, form(await png(10, 10))),
    ).rejects.toThrow('REDIRECT:/admin/login');
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(shop.addProductImage).not.toHaveBeenCalled();
  });

  it('refuses past the upload cap before sharp and the disk', async () => {
    rateLimit.consume.mockImplementation((key: string) =>
      Promise.resolve({
        allowed: !key.startsWith('rl:image-upload:'),
        retryAfterSec: 600,
      }),
    );
    const result = await uploadProductImageAction(
      PRODUCT_ID,
      form(await png(10, 10)),
    );
    expect(result).toEqual({
      ok: false,
      message: 'Твърде много опити. Опитай след 10 минути.',
    });
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('returns the ImageError message for SVG and an unreadable file', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
    );
    expect(
      await uploadProductImageAction(PRODUCT_ID, form(svg, 'x.svg')),
    ).toEqual({ ok: false, message: 'Приемат се само PNG, JPEG или WebP.' });
    expect(
      await uploadProductImageAction(PRODUCT_ID, form(Buffer.from('nope'))),
    ).toEqual({
      ok: false,
      message: 'Файлът не може да бъде прочетен като изображение.',
    });
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('deletes the new file when the write fails — at the cap too', async () => {
    shop.addProductImage.mockRejectedValue(new ProductError('images_full'));
    const full = await uploadProductImageAction(
      PRODUCT_ID,
      form(await png(10, 10)),
    );
    expect(full).toEqual({
      ok: false,
      message: 'Продуктът може да има до 6 снимки.',
    });
    expect(storage.deleteObject).toHaveBeenCalledWith(NEW_KEY);

    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    storage.deleteObject.mockClear();
    shop.addProductImage.mockRejectedValue(new Error('ECONNREFUSED'));
    const failed = await uploadProductImageAction(
      PRODUCT_ID,
      form(await png(10, 10)),
    );
    expect(failed.ok).toBe(false);
    if (!failed.ok) expect(failed.message).not.toContain('ECONNREFUSED');
    expect(storage.deleteObject).toHaveBeenCalledWith(NEW_KEY);
    error.mockRestore();
  });
});

describe('removeProductImageAction', () => {
  it('deletes the file only after the row is written', async () => {
    expect(await removeProductImageAction(PRODUCT_ID, OLD_KEY)).toEqual({
      ok: true,
      images: [],
    });
    expect(shop.removeProductImage).toHaveBeenCalledWith(
      {},
      PRODUCT_ID,
      OLD_KEY,
    );
    expect(storage.deleteObject).toHaveBeenCalledWith(OLD_KEY);
  });

  it('a foreign key is refused and no file is deleted', async () => {
    shop.removeProductImage.mockRejectedValue(
      new ProductError('image_foreign'),
    );
    expect(await removeProductImageAction(PRODUCT_ID, OLD_KEY)).toEqual({
      ok: false,
      message: 'Снимката не принадлежи на този продукт.',
    });
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('rejects a bad id or key before the session', async () => {
    expect((await removeProductImageAction('abc', OLD_KEY)).ok).toBe(false);
    expect((await removeProductImageAction(PRODUCT_ID, 42)).ok).toBe(false);
    expect(auth.getCurrentAdmin).not.toHaveBeenCalled();
  });
});

describe('reorderProductImagesAction', () => {
  it('passes the order to the service and returns what was saved', async () => {
    expect(await reorderProductImagesAction(PRODUCT_ID, [OLD_KEY])).toEqual({
      ok: true,
      images: [OLD_KEY],
    });
    expect(shop.reorderProductImages).toHaveBeenCalledWith({}, PRODUCT_ID, [
      OLD_KEY,
    ]);
  });

  it('rejects a non-array or too long list before the session', async () => {
    for (const bad of ['x', [1], Array.from({ length: 7 }, () => OLD_KEY)]) {
      expect((await reorderProductImagesAction(PRODUCT_ID, bad)).ok).toBe(
        false,
      );
    }
    expect(auth.getCurrentAdmin).not.toHaveBeenCalled();
  });
});
