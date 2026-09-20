import type { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';

import {
  formatPriceInput,
  MAX_PRICE,
  parsePriceInput,
  PRODUCT_MATERIALS,
  type ProductEditDto,
  type ProductMaterial,
  productSlugSchema,
} from '@/modules/shop';

// Формата държи низове, не `null`: празното поле е `''` и action-ът го обръща.
// Цените са в лева като низ — сервизът получава minor units (MON-1).
const TOO_LONG = 'Твърде дълго.';
const PRICE_MESSAGE = 'Цена като 12.50';
const optional = (max: number) => z.string().trim().max(max, TOO_LONG);

const priceString = (allowNegative: boolean) =>
  z.string().transform((raw, ctx) => {
    const minor = parsePriceInput(raw, { allowNegative });
    if (minor === null || Math.abs(minor) > MAX_PRICE) {
      ctx.addIssue({ code: 'custom', message: PRICE_MESSAGE });
      return z.NEVER;
    }
    return minor;
  });

const STOCK_MESSAGE = 'Въведи цяло число от 0 до 1 000 000.';

export const variantFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'Въведи име.').max(80, TOO_LONG),
  priceDelta: priceString(true),
  sku: optional(64),
  stock: z
    .number({ error: STOCK_MESSAGE })
    .int(STOCK_MESSAGE)
    .min(0, STOCK_MESSAGE)
    .max(1_000_000, STOCK_MESSAGE),
  isActive: z.boolean(),
});

export const productFormSchema = z.object({
  slug: productSlugSchema,
  name: z.string().trim().min(1, 'Въведи име.').max(120, TOO_LONG),
  description: optional(2000),
  material: z.enum(PRODUCT_MATERIALS, { error: 'Избери материал.' }),
  basePrice: priceString(false),
  isActive: z.boolean(),
  variants: z.array(variantFormSchema).max(50, 'До 50 варианта.'),
});

/** Стойностите в полетата (низове) — това вижда `useForm`. */
export type ProductFormValues = z.input<typeof productFormSchema>;
export type VariantFormValues = z.input<typeof variantFormSchema>;
/** След Zod: цените са вече числа в minor units. */
export type ProductFormOutput = z.output<typeof productFormSchema>;
/** Формата с двата типа — полетата (низове) и изходът на резолвера (числа). */
export type ProductForm = UseFormReturn<
  ProductFormValues,
  unknown,
  ProductFormOutput
>;

export const EMPTY_PRODUCT: ProductFormValues = {
  slug: '',
  name: '',
  description: '',
  material: 'pvc',
  basePrice: '',
  isActive: true,
  variants: [],
};

/** `null` → `''`, minor units → `'12.50'`; action-ът връща обратно. */
export function toFormValues(product: ProductEditDto): ProductFormValues {
  return {
    slug: product.slug,
    name: product.name,
    description: product.description ?? '',
    material: product.material,
    basePrice: formatPriceInput(product.basePrice),
    isActive: product.isActive,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      priceDelta: formatPriceInput(variant.priceDelta),
      sku: variant.sku ?? '',
      stock: variant.stock,
      isActive: variant.isActive,
    })),
  };
}

export const MATERIAL_LABELS: Readonly<Record<ProductMaterial, string>> = {
  pvc: 'PVC',
  metal: 'Метал',
  wood: 'Дърво',
};

export const MATERIAL_OPTIONS = PRODUCT_MATERIALS.map((value) => ({
  value,
  label: MATERIAL_LABELS[value],
}));
