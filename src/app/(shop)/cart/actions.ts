'use server';

// Гости, без сесия: Zod → лимит по IP → количка от Redis → мутация → запис.
// `redirect` хвърля и стои извън `try`.

import { randomBytes } from 'node:crypto';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { db } from '@/modules/core';
import {
  addLine,
  type Cart,
  CartError,
  cartLineInputSchema,
  isVariantActive,
  removeLine,
  updateLineQuantity,
} from '@/modules/shop';

import { cartActionLimit, newCartLimit } from './rate-limit';
import { hasCartCookie, readCart, writeCart } from './store';

export interface CartActionFailure {
  readonly ok: false;
  readonly message: string;
}

const failure = (message: string): CartActionFailure => ({
  ok: false,
  message,
});

const VARIANT_GONE = 'Този вариант вече не се предлага.';
const FAILED = 'Количката не беше записана — опитай пак след малко.';

/** Само име и `cause` — Drizzle носи параметрите в `message` (DAT-6). */
function logUnexpected(where: string, error: unknown): void {
  const cause = error instanceof Error ? error.cause : undefined;
  console.error(
    `${where}: ${error instanceof Error ? error.name : 'error'}`,
    cause,
  );
}

/** „Добави в количката": успех → `/cart`; всичко друго е съобщение. */
export async function addToCartAction(
  input: unknown,
): Promise<CartActionFailure> {
  const parsed = cartLineInputSchema.safeParse(input);
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? 'Невалидни данни.');
  }
  const limited = await cartActionLimit();
  if (limited !== null) return failure(limited);
  // Нова количка = нов ключ в Redis без auth — отделен, строг таван.
  if (!(await hasCartCookie())) {
    const newLimited = await newCartLimit();
    if (newLimited !== null) return failure(newLimited);
  }

  try {
    if (!(await isVariantActive(db, parsed.data.variantId))) {
      return failure(VARIANT_GONE);
    }
    const cart = await readCart();
    const id = randomBytes(9).toString('base64url');
    await writeCart(addLine(cart, parsed.data, id));
  } catch (error) {
    if (error instanceof CartError) return failure(error.message);
    logUnexpected('addToCartAction', error);
    return failure(FAILED);
  }

  revalidatePath('/', 'layout');
  redirect('/cart');
}

const lineIdSchema = z.string().min(1).max(64);

const quantityFieldSchema = z.coerce.number();

// Формите са без JS — грешката пътува като query, страницата я показва.
type Mutation = (cart: Cart) => Cart;

async function runFormMutation(where: string, mutate: Mutation): Promise<void> {
  const limited = await cartActionLimit();
  if (limited !== null) redirect('/cart?error=limited');

  try {
    const cart = await readCart();
    await writeCart(mutate(cart));
  } catch (error) {
    // Непознат ред (стар таб) — количката се показва каквато е.
    if (!(error instanceof CartError)) logUnexpected(where, error);
  }

  revalidatePath('/', 'layout');
  redirect('/cart');
}

/** `<select>` за количество: hidden `lineId` + `quantity`. */
export async function updateCartLineAction(formData: FormData): Promise<void> {
  const lineId = lineIdSchema.safeParse(formData.get('lineId'));
  const quantity = quantityFieldSchema.safeParse(formData.get('quantity'));
  if (!lineId.success || !quantity.success) redirect('/cart');

  await runFormMutation('updateCartLineAction', (cart) =>
    updateLineQuantity(cart, lineId.data, quantity.data),
  );
}

/** „Премахни": hidden `lineId`. */
export async function removeCartLineAction(formData: FormData): Promise<void> {
  const lineId = lineIdSchema.safeParse(formData.get('lineId'));
  if (!lineId.success) redirect('/cart');

  await runFormMutation('removeCartLineAction', (cart) =>
    removeLine(cart, lineId.data),
  );
}
