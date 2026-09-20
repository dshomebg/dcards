// Четене за редактора, запис, смяна на вариантите и изтриване на продукт.

import type { DbExecutor } from '@/modules/core';

import {
  deleteProductById,
  deleteVariantsByIds,
  findProductById,
  findVariantsByProduct,
  insertVariants,
  lockProduct,
  minVariantDelta,
  updateProductById,
  updateVariantByProductAndId,
} from './product.repository';
import type {
  Product,
  ProductMaterial,
  ProductVariant,
} from './product.schema';
import {
  assertEffectivePrices,
  assertProductSlug,
  parseVariants,
  ProductError,
  type ProductFieldsInput,
  productFieldsInputSchema,
  rethrowUnique,
  type VariantInput,
} from './product.service';

export interface ProductEditVariantDto {
  readonly id: string;
  readonly name: string;
  readonly priceDelta: number;
  readonly sku: string | null;
  readonly stock: number;
  readonly isActive: boolean;
  readonly sortOrder: number;
}

/** Каквото вижда редакторът — изрични полета (DAT-7); `images` е без UI засега. */
export interface ProductEditDto {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly material: ProductMaterial;
  readonly basePrice: number;
  readonly isActive: boolean;
  readonly updatedAt: Date;
  readonly variants: readonly ProductEditVariantDto[];
}

function toVariantDto(variant: ProductVariant): ProductEditVariantDto {
  return {
    id: variant.id,
    name: variant.name,
    priceDelta: variant.priceDelta,
    sku: variant.sku,
    stock: variant.stock,
    isActive: variant.isActive,
    sortOrder: variant.sortOrder,
  };
}

function toDto(
  product: Product,
  variants: readonly ProductVariant[],
): ProductEditDto {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    material: product.material,
    basePrice: product.basePrice,
    isActive: product.isActive,
    updatedAt: product.updatedAt,
    variants: variants.map(toVariantDto),
  };
}

/** Всички варианти, и неактивните. `null` за несъществуващ продукт. */
export async function getProductForEdit(
  executor: DbExecutor,
  productId: string,
): Promise<ProductEditDto | null> {
  const product = await findProductById(executor, productId);
  if (product === null) return null;
  return toDto(product, await findVariantsByProduct(executor, productId));
}

/**
 * Без предварително четене: уникалният индекс е проверката (няма TOCTOU).
 * Новата базова цена не бива да сваля никой вариант под нула.
 */
export async function updateProduct(
  executor: DbExecutor,
  productId: string,
  input: ProductFieldsInput,
  options?: { readonly variantsFollow?: boolean },
): Promise<ProductEditDto> {
  const parsed = productFieldsInputSchema.safeParse(input);
  if (!parsed.success) throw new ProductError('input_invalid');
  const fields = parsed.data;
  assertProductSlug(fields.slug);

  let updated: Product | null;
  try {
    updated = await updateProductById(executor, productId, {
      slug: fields.slug,
      name: fields.name,
      description: fields.description ?? null,
      material: fields.material,
      basePrice: fields.basePrice,
      isActive: fields.isActive,
    });
  } catch (error) {
    rethrowUnique(error);
  }
  if (updated === null) throw new ProductError('product_not_found');

  // Проверката е срещу ТЕКУЩИТЕ варианти. Когато в същата транзакция следва
  // `replaceVariants`, тя е авторитетна — иначе смяна на база и делти наведнъж
  // дава фалшив `price_negative`.
  if (options?.variantsFollow !== true) {
    const lowest = await minVariantDelta(executor, productId);
    if (lowest !== null) assertEffectivePrices(updated.basePrice, [lowest]);
  }
  return toDto(updated, await findVariantsByProduct(executor, productId));
}

/**
 * Upsert по `id`, НЕ delete+insert: id-то на варианта има външна стойност
 * (SHP-2 `order_items`). При `restrict` от SHP-2 изтриването ще пада за
 * варианти с поръчки — тогава редакторът ще ги прави `isActive=false`.
 */
export async function replaceVariants(
  executor: DbExecutor,
  productId: string,
  variants: readonly VariantInput[],
): Promise<ProductEditDto['variants']> {
  const items = parseVariants(variants);

  return executor.transaction(async (tx) => {
    const product = await lockProduct(tx, productId);
    if (product === null) throw new ProductError('product_not_found');

    const existing = new Set(
      (await findVariantsByProduct(tx, productId)).map((row) => row.id),
    );
    const given = items
      .map((item) => item.id)
      .filter((id): id is string => id !== undefined);
    if (given.some((id) => !existing.has(id))) {
      throw new ProductError('variant_foreign');
    }
    assertEffectivePrices(
      product.basePrice,
      items.map((item) => item.priceDelta),
    );

    try {
      const keep = new Set(given);
      await deleteVariantsByIds(
        tx,
        productId,
        [...existing].filter((id) => !keep.has(id)),
      );
      const saved: ProductVariant[] = [];
      for (const [sortOrder, item] of items.entries()) {
        const values = {
          name: item.name,
          priceDelta: item.priceDelta,
          sku: item.sku,
          stock: item.stock,
          isActive: item.isActive,
          sortOrder,
        };
        const row =
          item.id === undefined
            ? (await insertVariants(tx, [{ ...values, productId }]))[0]
            : await updateVariantByProductAndId(tx, productId, item.id, values);
        if (row === undefined || row === null) {
          throw new Error('variant upsert returned no row');
        }
        saved.push(row);
      }
      return saved.map(toVariantDto);
    } catch (error) {
      rethrowUnique(error);
    }
  });
}

/** Вариантите падат по cascade. Несъществуващ → `product_not_found`. */
export async function deleteProduct(
  executor: DbExecutor,
  productId: string,
): Promise<void> {
  if (!(await deleteProductById(executor, productId))) {
    throw new ProductError('product_not_found');
  }
}
