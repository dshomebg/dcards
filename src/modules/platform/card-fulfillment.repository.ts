// Картите на поръчка (SHP-3): заключване на свободни от партида, присвояване и
// освобождаване. `order_id` е без FK — магазинът може да липсва (ARC-2).

import { and, asc, count, eq, inArray, isNull, sql } from 'drizzle-orm';

import type { DbExecutor } from '@/modules/core';

import { cardBatches, cards, type CardStatus } from './card.schema';

/**
 * `SKIP LOCKED`: две поръчки, теглещи от една партида едновременно, не се
 * чакат — всяка взима различни карти. По-малко от `limit` реда = недостиг.
 */
export async function lockWrittenCardsByBatch(
  executor: DbExecutor,
  batchId: string,
  limit: number,
): Promise<string[]> {
  const rows = await executor
    .select({ id: cards.id })
    .from(cards)
    .where(and(eq(cards.batchId, batchId), eq(cards.status, 'written')))
    .orderBy(asc(cards.id))
    .limit(limit)
    .for('update', { skipLocked: true });
  return rows.map((row) => row.id);
}

export interface AssignCardsInput {
  readonly ids: readonly string[];
  readonly orderId: string;
}

/** Само `order_id` — org-ът идва при изпращане (`attachOrgToOrderCards`). */
export async function assignCardsToOrder(
  executor: DbExecutor,
  { ids, orderId }: AssignCardsInput,
): Promise<void> {
  if (ids.length === 0) return;
  await executor
    .update(cards)
    .set({ status: 'assigned', orderId })
    .where(and(inArray(cards.id, [...ids]), eq(cards.status, 'written')));
}

/** При `shipped`: картите на org-поръчка влизат в org-а на клиента. */
export async function attachOrgToOrderCards(
  executor: DbExecutor,
  orderId: string,
  orgId: string,
): Promise<number> {
  const rows = await executor
    .update(cards)
    .set({ orgId })
    .where(
      and(
        eq(cards.orderId, orderId),
        eq(cards.status, 'assigned'),
        isNull(cards.orgId),
      ),
    )
    .returning({ id: cards.id });
  return rows.length;
}

/** `disabled` не се брои — дефектната карта не бива да запушва квотата. */
export async function countCardsByOrder(
  executor: DbExecutor,
  orderId: string,
): Promise<number> {
  const rows = await executor
    .select({ total: count() })
    .from(cards)
    .where(and(eq(cards.orderId, orderId), sql`${cards.status} <> 'disabled'`));
  return rows[0]?.total ?? 0;
}

/** Само `assigned` → `written`; активираните остават при клиента. */
export async function releaseCardsByOrder(
  executor: DbExecutor,
  orderId: string,
): Promise<number> {
  const rows = await executor
    .update(cards)
    .set({ status: 'written', orderId: null, orgId: null })
    .where(and(eq(cards.orderId, orderId), eq(cards.status, 'assigned')))
    .returning({ id: cards.id });
  return rows.length;
}

/**
 * `false` = няма такава карта в тази поръчка. `assigned` → `written`;
 * `disabled` само се откача (остава `disabled`), за да се замени с друга.
 */
export async function releaseCard(
  executor: DbExecutor,
  cardId: string,
  orderId: string,
): Promise<boolean> {
  const rows = await executor
    .update(cards)
    .set({
      status: sql`case when ${cards.status} = 'assigned' then 'written' else ${cards.status} end`,
      orderId: null,
      orgId: null,
    })
    .where(
      and(
        eq(cards.id, cardId),
        eq(cards.orderId, orderId),
        inArray(cards.status, ['assigned', 'disabled']),
      ),
    )
    .returning({ id: cards.id });
  return rows.length > 0;
}

export interface OrderCardRow {
  readonly id: string;
  readonly status: CardStatus;
  readonly batchName: string;
}

export function findCardsByOrder(
  executor: DbExecutor,
  orderId: string,
): Promise<OrderCardRow[]> {
  return executor
    .select({ id: cards.id, status: cards.status, batchName: cardBatches.name })
    .from(cards)
    .innerJoin(cardBatches, eq(cardBatches.id, cards.batchId))
    .where(eq(cards.orderId, orderId))
    .orderBy(asc(cards.id));
}

/** За админ таблото: свободните (`written`) карти в склада. */
export async function countCardsByStatus(
  executor: DbExecutor,
  status: CardStatus,
): Promise<number> {
  const rows = await executor
    .select({ total: count() })
    .from(cards)
    .where(eq(cards.status, status));
  return rows[0]?.total ?? 0;
}
