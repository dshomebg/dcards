'use server';

// Единственото място, където `shop` и `platform` се срещат (ARC-2): поръчката се
// заключва в `shop`, картите се местят в `platform`, в една транзакция.

import { DrizzleQueryError } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';

import { db, env, sendMail, tooManyMessage } from '@/modules/core';
import {
  assignCardsFromBatch,
  attachOrderCardsToOrg,
  CardError,
  releaseOrderCard,
  releaseOrderCards,
} from '@/modules/platform';
import {
  lockOrderForCards,
  OrderError,
  orderShippedMail,
  type OrderTransition,
  setTrackingNumber,
  transitionOrder,
} from '@/modules/shop';

import { requireAdmin } from '../current';
import { adminActionLimit } from '../rate-limit';
import {
  assignCardsSchema,
  releaseCardSchema,
  trackingSchema,
  transitionSchema,
} from './schema';

export interface ActionFailure {
  readonly ok: false;
  readonly message: string;
}

/** `notice` = записано е, но нещо второстепенно (писмото) не е станало. */
export type OrderActionResult =
  { readonly ok: true; readonly notice?: string } | ActionFailure;

const failure = (message: string): ActionFailure => ({ ok: false, message });

const INVALID = 'Невалидни данни.';

const FAILED = 'Промяната не беше записана — опитай пак след малко.';
const NO_MAIL =
  'Статусът е записан, но имейлът в поръчката е невалиден — писмо не е пратено.';

function logUnexpected(where: string, error: unknown): void {
  // Drizzle носи параметрите в `message`, а `detail` — целия ред с данните на
  // клиента. Логват се само код и constraint (DAT-6).
  if (error instanceof DrizzleQueryError) {
    const cause = error.cause as
      { code?: string; constraint_name?: string } | undefined;
    console.error(`${where}: db error`, cause?.code, cause?.constraint_name);
    return;
  }
  console.error(`${where}:`, error instanceof Error ? error.name : 'error');
}

interface Outcome {
  readonly notice?: string;
  /** Номерът на поръчката — има го само при смяна на статус/пратка. */
  readonly number?: string;
  /** След commit, извън `try` — провал тук не бива да каже „не беше записана". */
  readonly afterCommit?: () => string | undefined;
}

/** Общият ред: админ (извън `try`) → лимит → операция → revalidate. */
async function run(
  where: string,
  orderId: string,
  operation: () => Promise<Outcome>,
): Promise<OrderActionResult> {
  const admin = await requireAdmin();
  const retryAfter = await adminActionLimit(admin.id);
  if (retryAfter !== null) return failure(tooManyMessage(retryAfter));

  let outcome: Outcome;
  try {
    outcome = await operation();
  } catch (error) {
    if (error instanceof OrderError || error instanceof CardError) {
      return failure(error.message);
    }
    logUnexpected(where, error);
    return failure(FAILED);
  }

  const notice = outcome.afterCommit?.() ?? outcome.notice;
  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath('/admin/batches');
  if (outcome.number !== undefined) {
    revalidatePath(`/order/${outcome.number}`);
    revalidatePath('/app/orders');
  }
  return notice === undefined ? { ok: true } : { ok: true, notice };
}

/** След commit и след отговора — висящ SMTP не държи бутона. `sendMail` не хвърля. */
function queueShippedMail(transition: OrderTransition): string | undefined {
  const { customerEmail, trackingNumber } = transition;
  if (customerEmail === null || trackingNumber === null) return NO_MAIL;
  const { APP_NAME, APP_URL } = env();
  const mail = orderShippedMail(
    {
      number: transition.number,
      courier: transition.courier,
      trackingNumber,
      hasAccount: transition.hasAccount,
    },
    { appName: APP_NAME, appUrl: APP_URL },
  );
  after(async () => {
    try {
      await sendMail({ to: customerEmail, ...mail });
    } catch (error) {
      logUnexpected('transitionOrderAction:mail', error);
    }
  });
  return undefined;
}

/** Преход по `ORDER_TRANSITIONS`; `cancelled` връща stock и картите наведнъж. */
export async function transitionOrderAction(
  orderId: unknown,
  to: unknown,
  trackingNumber?: unknown,
): Promise<OrderActionResult> {
  const parsed = transitionSchema.safeParse({ orderId, to, trackingNumber });
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? INVALID);
  }
  const { data } = parsed;

  return await run('transitionOrderAction', data.orderId, async () => {
    const transition = await db.transaction(async (tx) => {
      const result = await transitionOrder(tx, {
        id: data.orderId,
        to: data.to,
        trackingNumber: data.trackingNumber,
      });
      if (result.to === 'cancelled') await releaseOrderCards(tx, data.orderId);
      if (result.to === 'shipped' && result.orgId !== null) {
        await attachOrderCardsToOrg(tx, {
          orderId: data.orderId,
          orgId: result.orgId,
        });
      }
      return result;
    });
    return {
      number: transition.number,
      afterCommit:
        transition.to === 'shipped'
          ? () => queueShippedMail(transition)
          : undefined,
    };
  });
}

/** „Партида X, брой N": таванът е Σ quantity, пази го `platform` срещу заключената поръчка. */
export async function assignCardsAction(
  orderId: unknown,
  batchId: unknown,
  quantity: unknown,
): Promise<OrderActionResult> {
  const parsed = assignCardsSchema.safeParse({ orderId, batchId, quantity });
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? INVALID);
  }
  const { data } = parsed;

  return await run('assignCardsAction', data.orderId, async () => {
    await db.transaction(async (tx) => {
      const lock = await lockOrderForCards(tx, data.orderId);
      await assignCardsFromBatch(tx, {
        batchId: data.batchId,
        quantity: data.quantity,
        orderId: data.orderId,
        quota: lock.quota,
      });
    });
    return {};
  });
}

/** „Откачи": `assigned` → `written`, само преди изпращане. */
export async function releaseCardAction(
  orderId: unknown,
  cardId: unknown,
): Promise<OrderActionResult> {
  const parsed = releaseCardSchema.safeParse({ orderId, cardId });
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? INVALID);
  }
  const { data } = parsed;

  return await run('releaseCardAction', data.orderId, async () => {
    await db.transaction(async (tx) => {
      await lockOrderForCards(tx, data.orderId);
      await releaseOrderCard(tx, {
        cardId: data.cardId,
        orderId: data.orderId,
      });
    });
    return {};
  });
}

/** Смяна на номера след `shipped` — без писмо. */
export async function setTrackingNumberAction(
  orderId: unknown,
  trackingNumber: unknown,
): Promise<OrderActionResult> {
  const parsed = trackingSchema.safeParse({ orderId, trackingNumber });
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? INVALID);
  }
  const { data } = parsed;

  return await run('setTrackingNumberAction', data.orderId, async () => {
    const { number } = await setTrackingNumber(
      db,
      data.orderId,
      data.trackingNumber,
    );
    return { number };
  });
}
