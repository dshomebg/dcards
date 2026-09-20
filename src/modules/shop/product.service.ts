// Създаване, списък и публично четене на продукт. Схемите и грешките са общи
// с редакцията (`product-edit.service.ts`). Входът е в minor units (MON-1).

import { z } from 'zod';

import type { DbExecutor } from '@/modules/core';

import { uniqueViolationConstraint } from '../core/db/errors';
import {
  findActiveProducts,
  findActiveVariantsByProduct,
  findProductBySlug,
  findProductsWithVariantCount,
  insertProduct,
  insertVariants,
} from './product.repository';
import {
  type Product,
  PRODUCT_MATERIALS,
  type ProductMaterial,
  productSlugSchema,
  type PublicProduct,
  type PublicProductSummary,
} from './product.schema';

export type ProductErrorCode =
  | 'input_invalid'
  | 'slug_invalid'
  | 'slug_taken'
  | 'sku_taken'
  | 'sku_duplicate'
  | 'price_negative'
  | 'variant_foreign'
  | 'product_not_found';

const MESSAGES: Readonly<Record<ProductErrorCode, string>> = {
  input_invalid: 'Има невалидни или твърде дълги полета в продукта.',
  slug_invalid:
    'Адресът може да съдържа само малки латински букви, цифри и тире (3–60 знака).',
  slug_taken: 'Този адрес вече е зает от друг продукт.',
  sku_taken: 'Този SKU вече е зает от друг вариант.',
  sku_duplicate: 'Два варианта не може да имат един и същ SKU.',
  price_negative: 'Цената на вариант не може да е под нула.',
  variant_foreign: 'Вариантът не принадлежи на този продукт.',
  product_not_found: 'Продуктът не съществува.',
};

/** `code` е за тестовете и редактора; `message` е за човека. */
export class ProductError extends Error {
  constructor(readonly code: ProductErrorCode) {
    super(MESSAGES[code]);
    this.name = 'ProductError';
  }
}

export const MAX_PRICE = 10_000_000;

const text = (max: number) => z.string().trim().max(max);

// Границите пазят витрината от неограничен HTML; сервизът се пази сам (DAT-8).
export const productFieldsInputSchema = z.object({
  slug: z.string(),
  name: text(120).min(1),
  description: text(2000).nullish(),
  material: z.enum(PRODUCT_MATERIALS),
  basePrice: z.int().min(0).max(MAX_PRICE),
  isActive: z.boolean(),
});

export const variantInputSchema = z.object({
  id: z.uuid().optional(),
  name: text(80).min(1),
  priceDelta: z.int().min(-MAX_PRICE).max(MAX_PRICE),
  sku: text(64)
    .nullish()
    .transform((value) => (value === undefined || value === '' ? null : value)),
  stock: z.int().min(0).max(1_000_000),
  isActive: z.boolean(),
});

/** Дублиран SKU в един вход се хваща тук, без заявка. */
export const variantsInputSchema = z
  .array(variantInputSchema)
  .max(50)
  .refine((items) => {
    const skus = items.map((item) => item.sku).filter((sku) => sku !== null);
    return new Set(skus).size === skus.length;
  }, 'sku_duplicate')
  .refine((items) => {
    const ids = items.map((item) => item.id).filter((id) => id !== undefined);
    return new Set(ids).size === ids.length;
  }, 'input_invalid');

export const createProductInputSchema = z.object({
  fields: productFieldsInputSchema,
  variants: variantsInputSchema.optional(),
});

export type ProductFieldsInput = z.input<typeof productFieldsInputSchema>;
export type VariantInput = z.input<typeof variantInputSchema>;
export type CreateProductInput = z.input<typeof createProductInputSchema>;

/** Дублираният SKU е единствената грешка със свой код — другите са `input_invalid`. */
export function parseVariants(
  input: unknown,
): z.output<typeof variantsInputSchema> {
  const parsed = variantsInputSchema.safeParse(input);
  if (parsed.success) return parsed.data;
  const duplicate = parsed.error.issues.some(
    (issue) => issue.message === 'sku_duplicate',
  );
  throw new ProductError(duplicate ? 'sku_duplicate' : 'input_invalid');
}

export function assertProductSlug(slug: string): void {
  if (!productSlugSchema.safeParse(slug).success) {
    throw new ProductError('slug_invalid');
  }
}

/** `base_price + price_delta >= 0` е междутаблично — пази се тук, не в CHECK. */
export function assertEffectivePrices(
  basePrice: number,
  deltas: readonly number[],
): void {
  if (deltas.some((delta) => basePrice + delta < 0)) {
    throw new ProductError('price_negative');
  }
}

/** Уникално нарушение по име на индекс → `ProductError`; всичко друго се рехвърля. */
export function rethrowUnique(error: unknown): never {
  const constraint = uniqueViolationConstraint(error);
  if (constraint === 'products_slug_idx') throw new ProductError('slug_taken');
  if (constraint === 'product_variants_sku_idx') {
    throw new ProductError('sku_taken');
  }
  throw error;
}

/** Продукт плюс варианти в една транзакция; `sortOrder` е индексът във входа. */
export async function createProduct(
  executor: DbExecutor,
  input: CreateProductInput,
): Promise<Product> {
  const parsed = productFieldsInputSchema.safeParse(input.fields);
  if (!parsed.success) throw new ProductError('input_invalid');
  const fields = parsed.data;
  assertProductSlug(fields.slug);
  const variants = parseVariants(input.variants ?? []);
  assertEffectivePrices(
    fields.basePrice,
    variants.map((variant) => variant.priceDelta),
  );

  return executor.transaction(async (tx) => {
    try {
      const product = await insertProduct(tx, {
        slug: fields.slug,
        name: fields.name,
        description: fields.description ?? null,
        material: fields.material,
        basePrice: fields.basePrice,
        isActive: fields.isActive,
        images: [],
      });
      await insertVariants(
        tx,
        variants.map((variant, sortOrder) => ({
          productId: product.id,
          name: variant.name,
          priceDelta: variant.priceDelta,
          sku: variant.sku,
          stock: variant.stock,
          isActive: variant.isActive,
          sortOrder,
        })),
      );
      return product;
    } catch (error) {
      rethrowUnique(error);
    }
  });
}

/** Ред от списъка в `/admin/products` — изрични полета (DAT-7). */
export interface AdminProductSummary {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly material: ProductMaterial;
  readonly basePrice: number;
  readonly variantCount: number;
  readonly isActive: boolean;
  readonly updatedAt: Date;
}

export async function listProductsForAdmin(
  executor: DbExecutor,
): Promise<AdminProductSummary[]> {
  const rows = await findProductsWithVariantCount(executor);
  return rows.map(({ product, variantCount }) => ({
    id: product.id,
    slug: product.slug,
    name: product.name,
    material: product.material,
    basePrice: product.basePrice,
    variantCount,
    isActive: product.isActive,
    updatedAt: product.updatedAt,
  }));
}

export async function listActiveProducts(
  executor: DbExecutor,
): Promise<PublicProductSummary[]> {
  const rows = await findActiveProducts(executor);
  return rows.map((product) => ({
    slug: product.slug,
    name: product.name,
    material: product.material,
    basePrice: product.basePrice,
  }));
}

/** `null` и за непознат, и за неактивен. Само активни варианти; `stock` не излиза. */
export async function getActiveProductBySlug(
  executor: DbExecutor,
  slug: string,
): Promise<PublicProduct | null> {
  const product = await findProductBySlug(executor, slug);
  if (product === null || !product.isActive) return null;

  const variants = await findActiveVariantsByProduct(executor, product.id);
  return {
    slug: product.slug,
    name: product.name,
    description: product.description,
    material: product.material,
    basePrice: product.basePrice,
    variants: variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      price: product.basePrice + variant.priceDelta,
      inStock: variant.stock > 0,
    })),
  };
}
