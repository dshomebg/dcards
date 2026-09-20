import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/modules/core';

import { addLine, emptyCart } from './cart';
import { orders, type OrderStatus } from './order.schema';
import { OrderError, placeOrder } from './order.service';
import {
  getOrderForAdmin,
  listOrdersForAdmin,
  lockOrderForCards,
  ORDER_TRANSITIONS,
  setTrackingNumber,
  transitionOrder,
} from './order-admin.service';
import { productVariants } from './product.schema';
import { createProduct } from './product.service';

afterAll(async () => {
  await db.$client.end({ timeout: 5 });
});

const customer = {
  name: 'Иван Петров',
  phone: '+359881234567',
  email: 'i@x.bg',
};
const shipping = {
  courier: 'speedy' as const,
  address: null,
  office: 'Спиди Център',
  note: null,
};

let counter = 0;

/** Продукт с два варианта и поръчка 2 × Бяла + 1 × Черна (Σ 3) от гост. */
async function seedOrder(whiteQty = 2, blackQty = 1) {
  counter += 1;
  const product = await createProduct(db, {
    fields: {
      slug: `oa-${counter}`,
      name: 'PVC',
      description: null,
      material: 'pvc',
      basePrice: 1000,
      isActive: true,
    },
    variants: [
      { name: 'Бяла', priceDelta: 0, sku: null, stock: 10, isActive: true },
      { name: 'Черна', priceDelta: 100, sku: null, stock: 10, isActive: true },
    ],
  });
  const [white, black] = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, product.id))
    .orderBy(productVariants.sortOrder);
  if (white === undefined || black === undefined) throw new Error('seed');
  let cart = addLine(
    emptyCart(),
    {
      variantId: white.id,
      quantity: whiteQty,
      personalization: { name: 'А', title: null, notes: null, logoKey: null },
    },
    'l1',
  );
  if (blackQty > 0) {
    cart = addLine(
      cart,
      {
        variantId: black.id,
        quantity: blackQty,
        personalization: { name: 'Б', title: null, notes: null, logoKey: null },
      },
      'l2',
    );
  }
  const placed = await placeOrder(db, {
    cart,
    customer,
    shipping,
    actor: null,
  });
  return { id: placed.id, number: placed.number, white, black };
}

const rowOf = async (id: string) =>
  (await db.select().from(orders).where(eq(orders.id, id)))[0];

const stockOf = async (id: string) =>
  (
    await db
      .select({ stock: productVariants.stock })
      .from(productVariants)
      .where(eq(productVariants.id, id))
  )[0]?.stock;

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof OrderError) return error.code;
    throw error;
  }
  throw new Error('expected an OrderError');
}

const force = (id: string, status: OrderStatus) =>
  db.update(orders).set({ status }).where(eq(orders.id, id));

describe('transitionOrder', () => {
  it('walks cod → in_production → shipped → delivered and moves updatedAt', async () => {
    const { id } = await seedOrder();
    const before = (await rowOf(id))?.updatedAt;
    await new Promise((resolve) => setTimeout(resolve, 5));

    const first = await transitionOrder(db, { id, to: 'in_production' });
    expect(first).toMatchObject({
      from: 'cod',
      to: 'in_production',
      courier: 'speedy',
      customerEmail: 'i@x.bg',
      hasAccount: false,
    });
    const afterFirst = await rowOf(id);
    expect(afterFirst?.status).toBe('in_production');
    expect(afterFirst?.updatedAt.getTime()).toBeGreaterThan(
      before?.getTime() ?? Number.POSITIVE_INFINITY,
    );

    expect(await codeOf(transitionOrder(db, { id, to: 'shipped' }))).toBe(
      'tracking_required',
    );
    expect(
      await codeOf(
        transitionOrder(db, { id, to: 'shipped', trackingNumber: '   ' }),
      ),
    ).toBe('tracking_required');
    expect((await rowOf(id))?.status).toBe('in_production');

    const shipped = await transitionOrder(db, {
      id,
      to: 'shipped',
      trackingNumber: ' 1234567890 ',
    });
    expect(shipped.trackingNumber).toBe('1234567890');
    expect((await rowOf(id))?.trackingNumber).toBe('1234567890');

    await transitionOrder(db, { id, to: 'delivered' });
    expect(await rowOf(id)).toMatchObject({
      status: 'delivered',
      paymentStatus: 'paid',
    });
  });

  it('allows every cell of the matrix and refuses the rest', async () => {
    for (const [from, targets] of Object.entries(ORDER_TRANSITIONS)) {
      for (const to of targets) {
        const { id } = await seedOrder(1, 0);
        await force(id, from as OrderStatus);
        const result = await transitionOrder(db, {
          id,
          to,
          trackingNumber: 'T-1',
        });
        expect(result.to).toBe(to);
      }
    }
    const { id } = await seedOrder(1, 0);
    await force(id, 'delivered');
    expect(await codeOf(transitionOrder(db, { id, to: 'cod' }))).toBe(
      'transition_invalid',
    );
    await force(id, 'shipped');
    expect(await codeOf(transitionOrder(db, { id, to: 'cancelled' }))).toBe(
      'transition_invalid',
    );
    expect(
      await codeOf(
        transitionOrder(db, {
          id: '019969a0-0000-7000-8000-0000000000ff',
          to: 'cancelled',
        }),
      ),
    ).toBe('order_not_found');
    expect(await codeOf(transitionOrder(db, { id: 'x', to: 'cod' }))).toBe(
      'input_invalid',
    );
  });

  it('restores stock exactly once on cancel', async () => {
    const { id, white, black } = await seedOrder(2, 1);
    expect(await stockOf(white.id)).toBe(8);
    expect(await stockOf(black.id)).toBe(9);

    await transitionOrder(db, { id, to: 'in_production' });
    const cancelled = await transitionOrder(db, { id, to: 'cancelled' });
    expect(cancelled.from).toBe('in_production');
    expect(await stockOf(white.id)).toBe(10);
    expect(await stockOf(black.id)).toBe(10);

    expect(await codeOf(transitionOrder(db, { id, to: 'cancelled' }))).toBe(
      'transition_invalid',
    );
    expect(await stockOf(white.id)).toBe(10);
    expect(await stockOf(black.id)).toBe(10);
  });

  it('lets exactly one of two concurrent cancels restore stock', async () => {
    const { id, white } = await seedOrder(2, 0);
    const attempt = () =>
      transitionOrder(db, { id, to: 'cancelled' }).then(
        () => 'ok',
        (error: unknown) =>
          error instanceof OrderError ? error.code : 'unexpected',
      );
    const results = await Promise.all([attempt(), attempt()]);
    expect(results.filter((r) => r === 'ok')).toHaveLength(1);
    expect(results).toContain('transition_invalid');
    expect(await stockOf(white.id)).toBe(10);
  });
});

describe('setTrackingNumber / lockOrderForCards', () => {
  it('changes the number only after shipping', async () => {
    const { id, number } = await seedOrder(1, 0);
    expect(await codeOf(setTrackingNumber(db, id, 'X-1'))).toBe(
      'tracking_not_shipped',
    );
    await force(id, 'shipped');
    expect(await setTrackingNumber(db, id, ' X-2 ')).toEqual({ number });
    expect((await rowOf(id))?.trackingNumber).toBe('X-2');
    expect(await codeOf(setTrackingNumber(db, id, ''))).toBe(
      'tracking_required',
    );
  });

  it('locks with quota = Σ quantity and refuses once shipped', async () => {
    const { id } = await seedOrder(2, 3);
    await db.transaction(async (tx) => {
      expect(await lockOrderForCards(tx, id)).toEqual({
        status: 'cod',
        orgId: null,
        quota: 5,
      });
    });
    await force(id, 'shipped');
    await db.transaction(async (tx) => {
      expect(await codeOf(lockOrderForCards(tx, id))).toBe('cards_locked');
    });
  });
});

describe('listOrdersForAdmin / getOrderForAdmin', () => {
  it('lists newest first, filters by status, and details with transitions', async () => {
    const a = await seedOrder(1, 0);
    const b = await seedOrder(1, 0);
    await force(b.id, 'shipped');

    const all = await listOrdersForAdmin(db);
    const numbers = all.map((row) => row.number);
    expect(numbers.indexOf(b.number)).toBeLessThan(numbers.indexOf(a.number));
    expect(all.find((row) => row.id === a.id)).toMatchObject({
      status: 'cod',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      customerName: 'Иван Петров',
      total: 1590,
    });
    const shipped = await listOrdersForAdmin(db, 'shipped');
    expect(shipped.map((row) => row.id)).toContain(b.id);
    expect(shipped.map((row) => row.id)).not.toContain(a.id);

    const dto = await getOrderForAdmin(db, a.id);
    expect(dto).toMatchObject({
      id: a.id,
      number: a.number,
      status: 'cod',
      hasAccount: false,
      quota: 1,
      transitions: ['in_production', 'cancelled'],
      cardsEditable: true,
      trackingNumber: null,
    });
    expect(dto?.items[0]?.productName).toBe('PVC');
    expect(
      await getOrderForAdmin(db, '019969a0-0000-7000-8000-0000000000ff'),
    ).toBeNull();
  });
});
