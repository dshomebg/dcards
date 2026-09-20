// Достъп до `products` и `product_variants` — единственият SQL за двете таблици.

import { and, asc, count, eq, inArray, min } from 'drizzle-orm';

import type { DbExecutor } from '@/modules/core';

import {
  type NewProduct,
  type NewProductVariant,
  type Product,
  products,
  type ProductVariant,
  productVariants,
} from './product.schema';

export async function insertProduct(
  executor: DbExecutor,
  values: NewProduct,
): Promise<Product> {
  const rows = await executor.insert(products).values(values).returning();
  const created = rows[0];
  if (created === undefined) throw new Error('insert products returned no row');
  return created;
}

export async function insertVariants(
  executor: DbExecutor,
  values: readonly NewProductVariant[],
): Promise<ProductVariant[]> {
  if (values.length === 0) return [];
  return executor
    .insert(productVariants)
    .values([...values])
    .returning();
}

export async function findProductById(
  executor: DbExecutor,
  id: string,
): Promise<Product | null> {
  const rows = await executor
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function findProductBySlug(
  executor: DbExecutor,
  slug: string,
): Promise<Product | null> {
  const rows = await executor
    .select()
    .from(products)
    .where(eq(products.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

/** Заключва реда на продукта до края на транзакцията (`FOR UPDATE`). */
export async function lockProduct(
  executor: DbExecutor,
  id: string,
): Promise<Product | null> {
  const rows = await executor
    .select()
    .from(products)
    .where(eq(products.id, id))
    .for('update');
  return rows[0] ?? null;
}

export interface ProductListRow {
  readonly product: Product;
  readonly variantCount: number;
}

/** Всички продукти по ред на създаване с броя варианти (и неактивните). */
export async function findProductsWithVariantCount(
  executor: DbExecutor,
): Promise<ProductListRow[]> {
  const rows = await executor
    .select({ product: products, variantCount: count(productVariants.id) })
    .from(products)
    .leftJoin(productVariants, eq(productVariants.productId, products.id))
    .groupBy(products.id)
    .orderBy(asc(products.createdAt), asc(products.id));
  return rows;
}

export function findActiveProducts(executor: DbExecutor): Promise<Product[]> {
  return executor
    .select()
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(asc(products.createdAt), asc(products.id));
}

/** Всички варианти на продукта, и неактивните — за редактора. */
export function findVariantsByProduct(
  executor: DbExecutor,
  productId: string,
): Promise<ProductVariant[]> {
  return executor
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, productId))
    .orderBy(asc(productVariants.sortOrder), asc(productVariants.id));
}

export function findActiveVariantsByProduct(
  executor: DbExecutor,
  productId: string,
): Promise<ProductVariant[]> {
  return executor
    .select()
    .from(productVariants)
    .where(
      and(
        eq(productVariants.productId, productId),
        eq(productVariants.isActive, true),
      ),
    )
    .orderBy(asc(productVariants.sortOrder), asc(productVariants.id));
}

export interface VariantWithProduct {
  readonly variant: ProductVariant;
  readonly product: Product;
}

/** За количката: варианти по id заедно с продукта, и неактивните — сервизът решава. */
export async function findVariantsWithProductByIds(
  executor: DbExecutor,
  ids: readonly string[],
): Promise<VariantWithProduct[]> {
  if (ids.length === 0) return [];
  return executor
    .select({ variant: productVariants, product: products })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(inArray(productVariants.id, [...ids]));
}

/** `null` = продуктът няма варианти. */
export async function minVariantDelta(
  executor: DbExecutor,
  productId: string,
): Promise<number | null> {
  const rows = await executor
    .select({ value: min(productVariants.priceDelta) })
    .from(productVariants)
    .where(eq(productVariants.productId, productId));
  return rows[0]?.value ?? null;
}

export type ProductUpdate = Pick<
  NewProduct,
  'slug' | 'name' | 'description' | 'material' | 'basePrice' | 'isActive'
>;

/** `null` = няма такъв продукт. `updatedAt` идва от `$onUpdate`. */
export async function updateProductById(
  executor: DbExecutor,
  id: string,
  values: ProductUpdate,
): Promise<Product | null> {
  const rows = await executor
    .update(products)
    .set(values)
    .where(eq(products.id, id))
    .returning();
  return rows[0] ?? null;
}

export type VariantUpdate = Pick<
  NewProductVariant,
  'name' | 'priceDelta' | 'sku' | 'stock' | 'isActive' | 'sortOrder'
>;

/** По `(id, productId)` — чужд вариант не се пипа дори при познат id. */
export async function updateVariantByProductAndId(
  executor: DbExecutor,
  productId: string,
  id: string,
  values: VariantUpdate,
): Promise<ProductVariant | null> {
  const rows = await executor
    .update(productVariants)
    .set(values)
    .where(
      and(eq(productVariants.productId, productId), eq(productVariants.id, id)),
    )
    .returning();
  return rows[0] ?? null;
}

export async function deleteVariantsByIds(
  executor: DbExecutor,
  productId: string,
  ids: readonly string[],
): Promise<void> {
  if (ids.length === 0) return;
  await executor
    .delete(productVariants)
    .where(
      and(
        eq(productVariants.productId, productId),
        inArray(productVariants.id, [...ids]),
      ),
    );
}

/** `false` = няма такъв продукт. Вариантите падат по cascade. */
export async function deleteProductById(
  executor: DbExecutor,
  id: string,
): Promise<boolean> {
  const rows = await executor
    .delete(products)
    .where(eq(products.id, id))
    .returning({ id: products.id });
  return rows.length > 0;
}

export async function countActiveProducts(
  executor: DbExecutor,
): Promise<number> {
  const rows = await executor
    .select({ total: count() })
    .from(products)
    .where(eq(products.isActive, true));
  return rows[0]?.total ?? 0;
}
