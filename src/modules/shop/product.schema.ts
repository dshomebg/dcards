// Продукти и техните варианти. Цените са в minor units (MON-1); цената на
// вариант е `basePrice + priceDelta`.

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { z } from 'zod';

import { createdAt, primaryId, updatedAt } from '../core/db/columns';

export const PRODUCT_MATERIALS = ['pvc', 'metal', 'wood'] as const;
export type ProductMaterial = (typeof PRODUCT_MATERIALS)[number];

export const productMaterialEnum = pgEnum(
  'product_material',
  PRODUCT_MATERIALS,
);

/** Отделен от `platform/slug.ts`: адресът е `/products/{slug}`, свое пространство. */
export const PRODUCT_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/;

export const productSlugSchema = z
  .string()
  .regex(
    PRODUCT_SLUG_PATTERN,
    'Адресът може да съдържа само малки латински букви, цифри и тире (3–60 знака).',
  );

// `sql.raw` — иначе drizzle-kit оставя `$1` в миграцията вместо литерал.
const SLUG_PATTERN_SQL = sql.raw(`'${PRODUCT_SLUG_PATTERN.source}'`);

export const products = pgTable(
  'products',
  {
    id: primaryId(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    // Обикновен текст с нови редове, НЕ markdown.
    description: text('description'),
    material: productMaterialEnum('material').notNull(),
    basePrice: integer('base_price').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    // Storage още няма — засега винаги `[]`; четенето минава през `safeParse`.
    images: jsonb('images').$type<readonly string[]>().notNull().default([]),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('products_slug_idx').on(table.slug),
    check('products_slug_format', sql`${table.slug} ~ ${SLUG_PATTERN_SQL}`),
    check('products_base_price_nonneg', sql`${table.basePrice} >= 0`),
  ],
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

// `order_items.variant_id` (SHP-2) ще сочи тук с `restrict` — id-то на варианта
// има външна стойност, затова редакцията е upsert, не delete+insert.
export const productVariants = pgTable(
  'product_variants',
  {
    id: primaryId(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    priceDelta: integer('price_delta').notNull().default(0),
    sku: text('sku'),
    stock: integer('stock').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    index('product_variants_product_idx').on(table.productId, table.sortOrder),
    // NULL се пропуска от уникалния индекс — варианти без SKU са колкото искаш.
    uniqueIndex('product_variants_sku_idx').on(table.sku),
    check('product_variants_stock_nonneg', sql`${table.stock} >= 0`),
  ],
);

export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;

/** Каквото вижда витрината — изброено изрично, не `Omit` (DAT-7). */
export interface PublicProductSummary {
  readonly slug: string;
  readonly name: string;
  readonly material: ProductMaterial;
  readonly basePrice: number;
}

/** `id` е публичен: количката го праща обратно, цената се смята на сървъра (MON-1). */
export interface PublicProductVariant {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly inStock: boolean;
}

export interface PublicProduct {
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly material: ProductMaterial;
  readonly basePrice: number;
  readonly variants: readonly PublicProductVariant[];
}
