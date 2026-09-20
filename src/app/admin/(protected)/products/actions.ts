'use server';

import { DrizzleQueryError } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { db, tooManyMessage } from '@/modules/core';
import {
  createProduct,
  deleteProduct,
  type ProductEditDto,
  ProductError,
  replaceVariants,
  updateProduct,
} from '@/modules/shop';

import { requireAdmin } from '../current';
import { adminActionLimit } from '../rate-limit';
import { type ProductFormOutput, productFormSchema } from './schema';

export interface ActionFailure {
  readonly ok: false;
  readonly message: string;
}

export type SaveProductResult =
  { readonly ok: true; readonly product: ProductEditDto } | ActionFailure;

const failure = (message: string): ActionFailure => ({ ok: false, message });

const ID_INVALID = 'Продуктът не съществува.';
const LIST_PATH = '/admin/products';

/** Празното поле във формата е `''`; в базата е `null`. */
const emptyToNull = (value: string): string | null =>
  value === '' ? null : value;

function logUnexpected(where: string, error: unknown): void {
  // Drizzle носи параметрите в `message`, а `detail` — целия ред. Логват се
  // само код и constraint (DAT-6); драйверът `postgres` го нарича `constraint_name`.
  if (error instanceof DrizzleQueryError) {
    const cause = error.cause as
      { code?: string; constraint_name?: string } | undefined;
    console.error(`${where}: db error`, cause?.code, cause?.constraint_name);
    return;
  }
  console.error(`${where}:`, error);
}

function toServiceInput(values: ProductFormOutput) {
  return {
    fields: {
      slug: values.slug,
      name: values.name,
      description: emptyToNull(values.description),
      material: values.material,
      basePrice: values.basePrice,
      isActive: values.isActive,
    },
    variants: values.variants.map((variant) => ({
      // Празен `id` идва от нов ред във формата — сервизът вмъква.
      id:
        variant.id === undefined || variant.id === '' ? undefined : variant.id,
      name: variant.name,
      priceDelta: variant.priceDelta,
      sku: emptyToNull(variant.sku),
      stock: variant.stock,
      isActive: variant.isActive,
    })),
  };
}

/** Общият вход на трите action-а: Zod → админ (извън `try`) → лимит. */
async function guard(): Promise<ActionFailure | null> {
  const admin = await requireAdmin();
  const retryAfter = await adminActionLimit(admin.id);
  return retryAfter === null ? null : failure(tooManyMessage(retryAfter));
}

/** При успех пренасочва към редактора на новия продукт. */
export async function createProductAction(
  input: unknown,
): Promise<ActionFailure> {
  const parsed = productFormSchema.safeParse(input);
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? 'Невалидни данни.');
  }
  const limited = await guard();
  if (limited !== null) return limited;

  let productId: string;
  try {
    const product = await createProduct(db, toServiceInput(parsed.data));
    productId = product.id;
  } catch (error) {
    if (error instanceof ProductError) return failure(error.message);
    logUnexpected('createProductAction', error);
    return failure('Продуктът не беше създаден — опитай пак след малко.');
  }

  revalidatePath(LIST_PATH);
  redirect(`${LIST_PATH}/${productId}`);
}

/**
 * Полета + варианти в ЕДНА транзакция — отказ във вариантите не оставя
 * променени полета.
 */
export async function saveProductAction(
  productId: unknown,
  input: unknown,
): Promise<SaveProductResult> {
  const id = z.uuid().safeParse(productId);
  if (!id.success) return failure(ID_INVALID);
  const parsed = productFormSchema.safeParse(input);
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? 'Невалидни данни.');
  }
  const limited = await guard();
  if (limited !== null) return limited;

  try {
    const { fields, variants } = toServiceInput(parsed.data);
    const product = await db.transaction(async (tx) => {
      const updated = await updateProduct(tx, id.data, fields, {
        variantsFollow: true,
      });
      const saved = await replaceVariants(tx, id.data, variants);
      return { ...updated, variants: saved };
    });
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${id.data}`);
    return { ok: true, product };
  } catch (error) {
    if (error instanceof ProductError) return failure(error.message);
    logUnexpected('saveProductAction', error);
    return failure('Продуктът не беше записан — опитай пак след малко.');
  }
}

/** При успех пренасочва към списъка; вариантите падат по cascade. */
export async function deleteProductAction(
  productId: unknown,
): Promise<ActionFailure> {
  const id = z.uuid().safeParse(productId);
  if (!id.success) return failure(ID_INVALID);
  const limited = await guard();
  if (limited !== null) return limited;

  try {
    await deleteProduct(db, id.data);
  } catch (error) {
    if (error instanceof ProductError) return failure(error.message);
    logUnexpected('deleteProductAction', error);
    return failure('Продуктът не беше изтрит — опитай пак след малко.');
  }

  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}
