'use server';

// Без auth: Zod → количка (празната не харчи лимит) → лимит (IP, после имейл)
// → ключ срещу двоен submit → актор → `placeOrder` → токен за гост → празна
// количка → redirect; писмото излиза след отговора. `redirect` стои извън `try`.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';

import { loadCurrent } from '@/app/app/(protected)/current';
import { db, env, sendMail } from '@/modules/core';
import {
  emptyCart,
  orderConfirmationMail,
  OrderError,
  type PlacedOrder,
  placeOrder,
} from '@/modules/shop';

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

/** Клиентът и (по избор) админът; `sendMail` не хвърля. Адресът не се нормализира. */
async function notify(placed: PlacedOrder, to: string): Promise<void> {
  const { APP_NAME, APP_URL, STORE_CURRENCY, STORE_LOCALE, MAIL_ADMIN_TO } =
    env();
  const options = {
    appName: APP_NAME,
    appUrl: APP_URL,
    format: { currency: STORE_CURRENCY, locale: STORE_LOCALE },
  };
  // Паралелно: при паднал SMTP клиентът чака един timeout, не два.
  await Promise.all([
    sendMail({ to, ...orderConfirmationMail(placed, options) }),
    MAIL_ADMIN_TO === undefined
      ? Promise.resolve(false)
      : sendMail({
          to: MAIL_ADMIN_TO,
          ...orderConfirmationMail(placed, { ...options, forAdmin: true }),
        }),
  ]);
}

interface AfterCommit {
  readonly placed: PlacedOrder;
  readonly guest: boolean;
  readonly email: string;
}

/** Провал на Redis/SMTP след commit не проваля поръчката — тя вече е записана. */
async function afterCommit({ placed, guest, email }: AfterCommit) {
  // Логнатият има достъп през org-а си; токен за него би надживял изхода.
  if (guest) {
    try {
      await issueOrderViewToken(placed.number);
    } catch (error) {
      logUnexpected('placeOrderAction:token', error);
    }
  }
  // След отговора: висящ SMTP не бива да държи бутона „Поръчай" (`after` върви
  // и при `redirect`).
  after(async () => {
    try {
      await notify(placed, email);
    } catch (error) {
      logUnexpected('placeOrderAction:mail', error);
    }
  });
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

  let placed: PlacedOrder;
  let guest: boolean;
  try {
    if (!(await acquireCheckoutLock())) return failure(BUSY);
    const current = await loadCurrent();
    guest = current === null;
    const actor =
      current === null
        ? null
        : { userId: current.user.id, orgId: current.org.id };
    placed = await placeOrder(db, {
      cart,
      ...toPlaceOrderInput(parsed.data),
      actor,
    });
  } catch (error) {
    await releaseCheckoutLock().catch(() => undefined);
    if (error instanceof OrderError) return failure(error.message);
    logUnexpected('placeOrderAction', error);
    return failure(FAILED);
  }

  await afterCommit({ placed, guest, email: parsed.data.email });
  revalidatePath('/', 'layout');
  redirect(`/order/${placed.number}`);
}
