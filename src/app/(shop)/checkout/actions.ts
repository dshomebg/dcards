'use server';

// Без auth: Zod → количка (празната не харчи лимит) → лимит (IP, после имейл)
// → ключ срещу двоен submit → актор → `placeOrder` → токен за гост → празна
// количка. `redirect` стои извън `try`.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { loadCurrent } from '@/app/app/(protected)/current';
import { db } from '@/modules/core';
import { emptyCart, OrderError, placeOrder } from '@/modules/shop';

import {
  acquireCheckoutLock,
  readCart,
  releaseCheckoutLock,
  writeCart,
} from '../cart/store';
import { issueOrderViewToken } from './order-view';
import { checkoutLimit } from './rate-limit';
import { checkoutFormSchema, toPlaceOrderInput } from './schema';

export interface CheckoutActionFailure {
  readonly ok: false;
  readonly message: string;
}

const failure = (message: string): CheckoutActionFailure => ({
  ok: false,
  message,
});

const FAILED = 'Поръчката не беше записана — опитай пак след малко.';

const BUSY = 'Поръчката вече се обработва — изчакай малко.';

/**
 * Само име, код и constraint — `message` носи параметрите, а `detail` при
 * CHECK носи целия ред с личните данни на клиента (DAT-6).
 */
function logUnexpected(where: string, error: unknown): void {
  const cause = error instanceof Error ? error.cause : undefined;
  const db = cause as { code?: string; constraint_name?: string } | undefined;
  console.error(
    `${where}: ${error instanceof Error ? error.name : 'error'}`,
    db?.code,
    db?.constraint_name,
  );
}

/** Провал на Redis след commit не проваля поръчката — тя вече е записана. */
async function afterCommit(number: string, guest: boolean): Promise<void> {
  // Логнатият има достъп през org-а си; токен за него би надживял изхода.
  if (guest) {
    try {
      await issueOrderViewToken(number);
    } catch (error) {
      logUnexpected('placeOrderAction:token', error);
    }
  }
  try {
    await writeCart(emptyCart());
  } catch (error) {
    logUnexpected('placeOrderAction:cart', error);
  }
}

/** „Поръчай": успех → `/order/{number}`; всичко друго е съобщение. */
export async function placeOrderAction(
  input: unknown,
): Promise<CheckoutActionFailure> {
  const parsed = checkoutFormSchema.safeParse(input);
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? 'Невалидни данни.');
  }
  const cart = await readCart();
  if (cart.items.length === 0) {
    return failure(new OrderError('cart_empty').message);
  }
  const limited = await checkoutLimit(parsed.data.email);
  if (limited !== null) return failure(limited);

  let number: string;
  let guest: boolean;
  try {
    if (!(await acquireCheckoutLock())) return failure(BUSY);
    const current = await loadCurrent();
    guest = current === null;
    const actor =
      current === null
        ? null
        : { userId: current.user.id, orgId: current.org.id };
    const placed = await placeOrder(db, {
      cart,
      ...toPlaceOrderInput(parsed.data),
      actor,
    });
    number = placed.number;
  } catch (error) {
    await releaseCheckoutLock().catch(() => undefined);
    if (error instanceof OrderError) return failure(error.message);
    logUnexpected('placeOrderAction', error);
    return failure(FAILED);
  }

  // SHP-2c: sendOrderConfirmation(number) — след commit, преди redirect.
  await afterCommit(number, guest);
  revalidatePath('/', 'layout');
  redirect(`/order/${number}`);
}
