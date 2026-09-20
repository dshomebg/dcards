import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/modules/core';

import { createBatch, listBatches, markBatchWritten } from './batch.service';
import { cards } from './card.schema';
import { codeOf, seedOrg } from './card-activation.db-fixtures';
import {
  assignCardsFromBatch,
  attachOrderCardsToOrg,
  listCardsByOrder,
  releaseOrderCard,
  releaseOrderCards,
} from './card-fulfillment.service';

afterAll(async () => {
  await db.$client.end({ timeout: 5 });
});

// `order_id` е без FK — тестът не създава поръчка, стига uuid.
const ORDER_A = '019969a0-0000-7000-8000-00000000aaaa';
const ORDER_B = '019969a0-0000-7000-8000-00000000bbbb';
const MISSING = '019969a0-0000-7000-8000-0000000000ff';

async function seedBatch(userId: string, quantity: number, written = true) {
  const batch = await createBatch(db, {
    name: `P${quantity}`,
    quantity,
    createdBy: userId,
  });
  if (written) await markBatchWritten(db, batch.id);
  return batch.id;
}

const cardsOf = (batchId: string) =>
  db.select().from(cards).where(eq(cards.batchId, batchId)).orderBy(cards.id);

interface AssignOverrides {
  readonly orderId?: string;
  readonly quota?: number;
}

const assign = (
  batchId: string,
  quantity: number,
  { orderId = ORDER_A, quota = 5 }: AssignOverrides = {},
) => assignCardsFromBatch(db, { batchId, quantity, orderId, quota });

describe('assignCardsFromBatch', () => {
  it('assigns N written cards with order_id and no org; org comes at shipping', async () => {
    const { userId, org } = await seedOrg('ful-assign');
    const guestBatch = await seedBatch(userId, 5);
    expect(await assign(guestBatch, 3)).toBe(3);
    const rows = await cardsOf(guestBatch);
    expect(rows.filter((c) => c.status === 'assigned')).toHaveLength(3);
    expect(rows.filter((c) => c.status === 'written')).toHaveLength(2);
    for (const card of rows.filter((c) => c.status === 'assigned')) {
      expect(card).toMatchObject({ orderId: ORDER_A, orgId: null });
    }

    const orgBatch = await seedBatch(userId, 2);
    await assign(orgBatch, 2, { orderId: ORDER_B });
    for (const card of await cardsOf(orgBatch)) {
      expect(card).toMatchObject({
        status: 'assigned',
        orderId: ORDER_B,
        orgId: null,
      });
    }
    expect(
      await attachOrderCardsToOrg(db, { orderId: ORDER_B, orgId: org.id }),
    ).toBe(2);
    for (const card of await cardsOf(orgBatch)) {
      expect(card).toMatchObject({ status: 'assigned', orgId: org.id });
    }
    // Гостовата поръчка не е пипната.
    for (const card of await cardsOf(guestBatch)) expect(card.orgId).toBeNull();
    expect(await listCardsByOrder(db, ORDER_B)).toEqual([
      expect.objectContaining({ status: 'assigned', batchName: 'P2' }),
      expect.objectContaining({ status: 'assigned', batchName: 'P2' }),
    ]);
    const summary = (await listBatches(db)).find((b) => b.id === guestBatch);
    expect(summary).toMatchObject({ written: 5, available: 2, active: 0 });
  });

  it('takes nothing when the batch is short, blank or unknown', async () => {
    const { userId } = await seedOrg('ful-short');
    const short = await seedBatch(userId, 2);
    const order = '019969a0-0000-7000-8000-00000000ffff';
    expect(await codeOf(assign(short, 3, { orderId: order }))).toBe(
      'batch_short',
    );
    expect((await cardsOf(short)).every((c) => c.status === 'written')).toBe(
      true,
    );

    const blank = await seedBatch(userId, 3, false);
    expect(await codeOf(assign(blank, 1, { orderId: order }))).toBe(
      'batch_short',
    );
    expect(await codeOf(assign(MISSING, 1))).toBe('batch_not_found');
    expect(await codeOf(assign('nope', 1))).toBe('input_invalid');
  });

  it('caps the total at the quota but allows several steps', async () => {
    const { userId } = await seedOrg('ful-quota');
    const batch = await seedBatch(userId, 10);
    const order = '019969a0-0000-7000-8000-00000000cccc';
    await assign(batch, 3, { orderId: order });
    expect(await codeOf(assign(batch, 3, { orderId: order }))).toBe(
      'order_quota',
    );
    expect(await listCardsByOrder(db, order)).toHaveLength(3);
    await assign(batch, 2, { orderId: order });
    expect(await listCardsByOrder(db, order)).toHaveLength(5);
  });
});

describe('releaseOrderCard / releaseOrderCards', () => {
  it('releases one assigned card of this order; others are card_not_found', async () => {
    const { userId } = await seedOrg('ful-release');
    const batch = await seedBatch(userId, 3);
    const order = '019969a0-0000-7000-8000-00000000dddd';
    await assign(batch, 2, { orderId: order });
    const [first, , third] = await cardsOf(batch);
    if (first === undefined || third === undefined) throw new Error('seed');

    await releaseOrderCard(db, { cardId: first.id, orderId: order });
    expect((await cardsOf(batch))[0]).toMatchObject({
      status: 'written',
      orderId: null,
      orgId: null,
    });
    expect(
      await codeOf(releaseOrderCard(db, { cardId: first.id, orderId: order })),
    ).toBe('card_not_found');
    expect(
      await codeOf(releaseOrderCard(db, { cardId: third.id, orderId: order })),
    ).toBe('card_not_found');
    expect(
      await codeOf(releaseOrderCard(db, { cardId: 'bad id', orderId: order })),
    ).toBe('card_not_found');
  });

  it('a disabled card leaves the quota and can be released without reviving it', async () => {
    const { userId } = await seedOrg('ful-disabled');
    const batch = await seedBatch(userId, 3);
    const order = '019969a0-0000-7000-8000-00000000abcd';
    await assign(batch, 2, { orderId: order, quota: 2 });
    const [broken] = await cardsOf(batch);
    if (broken === undefined) throw new Error('seed');
    await db
      .update(cards)
      .set({ status: 'disabled' })
      .where(eq(cards.id, broken.id));

    // Дефектната не се брои → замяната минава в квотата.
    expect(await assign(batch, 1, { orderId: order, quota: 2 })).toBe(1);
    await releaseOrderCard(db, { cardId: broken.id, orderId: order });
    expect((await cardsOf(batch))[0]).toMatchObject({
      status: 'disabled',
      orderId: null,
    });
  });

  it('cancel returns assigned cards to written and leaves active ones', async () => {
    const { userId, org } = await seedOrg('ful-cancel');
    const batch = await seedBatch(userId, 3);
    const order = '019969a0-0000-7000-8000-00000000eeee';
    await assign(batch, 3, { orderId: order });
    await attachOrderCardsToOrg(db, { orderId: order, orgId: org.id });
    const [active] = await cardsOf(batch);
    if (active === undefined) throw new Error('seed');
    await db
      .update(cards)
      .set({ status: 'active' })
      .where(eq(cards.id, active.id));

    expect(await releaseOrderCards(db, order)).toBe(2);
    const rows = await cardsOf(batch);
    expect(rows[0]).toMatchObject({
      status: 'active',
      orderId: order,
      orgId: org.id,
    });
    for (const card of rows.slice(1)) {
      expect(card).toMatchObject({
        status: 'written',
        orderId: null,
        orgId: null,
      });
    }
    expect(await releaseOrderCards(db, order)).toBe(0);
  });
});
