// Карти към поръчка (SHP-3). Поръчката е заключена от извикващия (`FOR UPDATE`
// в `shop`), затова броенето срещу квотата тук е безопасно.

import { z } from 'zod';

import type { DbExecutor } from '@/modules/core';

import { findBatchById } from './card.repository';
import type { CardStatus } from './card.schema';
import { CardError } from './card.service';
import {
  assignCardsToOrder,
  attachOrgToOrderCards,
  countCardsByOrder,
  findCardsByOrder,
  lockWrittenCardsByBatch,
  releaseCard,
  releaseCardsByOrder,
} from './card-fulfillment.repository';
import { cardIdSchema } from './card-id';

const assignSchema = z.object({
  batchId: z.uuid(),
  quantity: z.number().int().min(1).max(1000),
  orderId: z.uuid(),
  /** Σ `order_items.quantity` — таванът на картите за поръчката. */
  quota: z.number().int().min(0),
});

export type AssignCardsFromBatchInput = z.input<typeof assignSchema>;

const releaseSchema = z.object({ cardId: cardIdSchema, orderId: z.uuid() });

/**
 * N свободни (`written`) карти от партидата → `assigned` с `order_id`. Без
 * `org_id` до изпращането — иначе клиентът вижда карти, които са още в склада.
 * Недостиг → `batch_short`, нищо не се пише.
 */
export async function assignCardsFromBatch(
  executor: DbExecutor,
  input: AssignCardsFromBatchInput,
): Promise<number> {
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) throw new CardError('input_invalid');
  const { batchId, quantity, orderId, quota } = parsed.data;

  if ((await findBatchById(executor, batchId)) === null) {
    throw new CardError('batch_not_found');
  }
  const assigned = await countCardsByOrder(executor, orderId);
  if (assigned + quantity > quota) throw new CardError('order_quota');

  const ids = await lockWrittenCardsByBatch(executor, batchId, quantity);
  if (ids.length < quantity) throw new CardError('batch_short');
  await assignCardsToOrder(executor, { ids, orderId });
  return ids.length;
}

const attachSchema = z.object({ orderId: z.uuid(), orgId: z.uuid() });

/** При `shipped` на org-поръчка: `assigned` картите ѝ влизат в org-а. */
export async function attachOrderCardsToOrg(
  executor: DbExecutor,
  input: z.input<typeof attachSchema>,
): Promise<number> {
  const parsed = attachSchema.safeParse(input);
  if (!parsed.success) throw new CardError('input_invalid');
  return attachOrgToOrderCards(
    executor,
    parsed.data.orderId,
    parsed.data.orgId,
  );
}

/** Отказ на поръчка: `assigned` → `written`; `active` не се пипа. Връща броя. */
export function releaseOrderCards(
  executor: DbExecutor,
  orderId: string,
): Promise<number> {
  return releaseCardsByOrder(executor, orderId);
}

export async function releaseOrderCard(
  executor: DbExecutor,
  input: { readonly cardId: string; readonly orderId: string },
): Promise<void> {
  const parsed = releaseSchema.safeParse(input);
  if (!parsed.success) throw new CardError('card_not_found');
  if (!(await releaseCard(executor, parsed.data.cardId, parsed.data.orderId))) {
    throw new CardError('card_not_found');
  }
}

export interface OrderCardDto {
  readonly id: string;
  readonly status: CardStatus;
  readonly batchName: string;
}

export function listCardsByOrder(
  executor: DbExecutor,
  orderId: string,
): Promise<OrderCardDto[]> {
  return findCardsByOrder(executor, orderId);
}
