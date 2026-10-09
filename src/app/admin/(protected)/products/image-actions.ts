'use server';

// Снимките на продукта се записват ВЕДНАГА, извън „Запази" (както PLT-6):
// файл → sharp → диск → ключ в базата. Приема файл, ключ от клиента — само за
// премахване и подредба, и само ако вече е в масива на продукта.

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { deleteFilesQuietly } from '@/lib/delete-files';
import { logUnexpected } from '@/lib/log-unexpected';
import {
  createObjectKey,
  db,
  IMAGE_MAX_BYTES,
  ImageError,
  processProductImage,
  putObject,
  tooManyMessage,
} from '@/modules/core';
import {
  addProductImage,
  MAX_PRODUCT_IMAGES,
  ProductError,
  type ProductImages,
  removeProductImage,
  reorderProductImages,
} from '@/modules/shop';

import { requireAdmin } from '../current';
import { adminActionLimit, adminImageUploadLimit } from '../rate-limit';

interface Failure {
  readonly ok: false;
  readonly message: string;
}

export type ProductImagesResult =
  { readonly ok: true; readonly images: readonly string[] } | Failure;

const failure = (message: string): Failure => ({ ok: false, message });

const ID_INVALID = 'Продуктът не съществува.';
const FAILED = 'Снимките не бяха записани — опитай пак след малко.';

const keySchema = z.string().max(80);
const orderSchema = z.array(keySchema).max(MAX_PRODUCT_IMAGES);

/** `redirect` при липсваща сесия хвърля — затова се вика извън `try`. */
async function guard(upload: boolean): Promise<Failure | null> {
  const admin = await requireAdmin();
  const retryAfter =
    (await adminActionLimit(admin.id)) ??
    (upload ? await adminImageUploadLimit(admin.id) : null);
  return retryAfter === null ? null : failure(tooManyMessage(retryAfter));
}

function refresh(productId: string, { slug, images }: ProductImages) {
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath('/products');
  revalidatePath(`/products/${slug}`);
  revalidatePath('/');
  return { ok: true as const, images };
}

function toFailure(action: string, error: unknown): Failure {
  if (error instanceof ImageError || error instanceof ProductError) {
    return failure(error.message);
  }
  logUnexpected(action, error);
  return failure(FAILED);
}

async function store(productId: string, file: File): Promise<ProductImages> {
  const webp = await processProductImage(Buffer.from(await file.arrayBuffer()));
  const key = createObjectKey('products');
  await putObject(key, webp);
  try {
    return await addProductImage(db, productId, key);
  } catch (error) {
    // Записът в базата не мина (и при тавана) — новият файл не остава сираче.
    await deleteFilesQuietly([key]);
    throw error;
  }
}

export async function uploadProductImageAction(
  productId: unknown,
  formData: FormData,
): Promise<ProductImagesResult> {
  const id = z.uuid().safeParse(productId);
  if (!id.success) return failure(ID_INVALID);
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return failure('Избери файл с изображение.');
  }
  // Преди лимита: отказът на голям файл не струва нищо и не бива да брои.
  if (file.size > IMAGE_MAX_BYTES) return failure('Файлът е до 2 MB.');

  const limited = await guard(true);
  if (limited !== null) return limited;

  try {
    return refresh(id.data, await store(id.data, file));
  } catch (error) {
    return toFailure('uploadProductImageAction', error);
  }
}

export async function removeProductImageAction(
  productId: unknown,
  key: unknown,
): Promise<ProductImagesResult> {
  const id = z.uuid().safeParse(productId);
  const image = keySchema.safeParse(key);
  if (!id.success || !image.success) return failure(ID_INVALID);
  const limited = await guard(false);
  if (limited !== null) return limited;

  try {
    const saved = await removeProductImage(db, id.data, image.data);
    await deleteFilesQuietly([image.data]);
    return refresh(id.data, saved);
  } catch (error) {
    return toFailure('removeProductImageAction', error);
  }
}

export async function reorderProductImagesAction(
  productId: unknown,
  keys: unknown,
): Promise<ProductImagesResult> {
  const id = z.uuid().safeParse(productId);
  const order = orderSchema.safeParse(keys);
  if (!id.success) return failure(ID_INVALID);
  if (!order.success) {
    return failure(new ProductError('image_order_invalid').message);
  }
  const limited = await guard(false);
  if (limited !== null) return limited;

  try {
    return refresh(
      id.data,
      await reorderProductImages(db, id.data, order.data),
    );
  } catch (error) {
    return toFailure('reorderProductImagesAction', error);
  }
}
