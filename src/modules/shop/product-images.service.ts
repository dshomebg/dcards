// Добавяне, премахване и подреждане на снимките на продукт. Всяка операция чете
// и пише `images` под `lockProduct` — паралелни качвания не се презаписват и не
// минават тавана. Файловете на диска са работа на извикващия.

import { z } from 'zod';

import type { DbExecutor } from '@/modules/core';

import { lockProduct, updateProductImages } from './product.repository';
import { ProductError } from './product.service';
import {
  isProductImageKey,
  MAX_PRODUCT_IMAGES,
  readProductImages,
} from './product-images';

/** `slug` е за опресняването на витрината след записа. */
export interface ProductImages {
  readonly slug: string;
  readonly images: readonly string[];
}

const keySchema = z.string().refine(isProductImageKey);
const orderSchema = z.array(keySchema).max(MAX_PRODUCT_IMAGES);

type Change = (current: readonly string[]) => readonly string[];

async function changeImages(
  executor: DbExecutor,
  productId: string,
  change: Change,
): Promise<ProductImages> {
  return executor.transaction(async (tx) => {
    const product = await lockProduct(tx, productId);
    if (product === null) throw new ProductError('product_not_found');
    const images = change(readProductImages(product.images));
    await updateProductImages(tx, productId, images);
    return { slug: product.slug, images };
  });
}

/** Ключът е издаден от сървъра (`createObjectKey`), не идва от клиента. */
export async function addProductImage(
  executor: DbExecutor,
  productId: string,
  key: string,
): Promise<ProductImages> {
  if (!keySchema.safeParse(key).success) {
    throw new ProductError('input_invalid');
  }
  return changeImages(executor, productId, (current) => {
    if (current.length >= MAX_PRODUCT_IMAGES) {
      throw new ProductError('images_full');
    }
    return [...current, key];
  });
}

/** Чужд ключ → отказ; файлът се трие от извикващия СЛЕД успешния запис. */
export async function removeProductImage(
  executor: DbExecutor,
  productId: string,
  key: string,
): Promise<ProductImages> {
  return changeImages(executor, productId, (current) => {
    if (!current.includes(key)) throw new ProductError('image_foreign');
    return current.filter((item) => item !== key);
  });
}

function isPermutation(
  current: readonly string[],
  next: readonly string[],
): boolean {
  const given = new Set(next);
  return (
    next.length === current.length &&
    given.size === next.length &&
    current.every((key) => given.has(key))
  );
}

/** Само пермутация на текущите — иначе отказ и редът остава непроменен. */
export async function reorderProductImages(
  executor: DbExecutor,
  productId: string,
  keys: readonly string[],
): Promise<ProductImages> {
  const parsed = orderSchema.safeParse(keys);
  if (!parsed.success) throw new ProductError('image_order_invalid');
  return changeImages(executor, productId, (current) => {
    if (!isPermutation(current, parsed.data)) {
      throw new ProductError('image_order_invalid');
    }
    return parsed.data;
  });
}
