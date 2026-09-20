import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/modules/core';

import { users } from '../auth/user.schema';
import { organizations } from '../platform/organization.schema';
import { addLine, type Cart, emptyCart } from './cart';
import { orderItems, orders } from './order.schema';
import {
  getOrderForView,
  listOrdersByOrg,
  OrderError,
  placeOrder,
} from './order.service';
import { productVariants } from './product.schema';
import { createProduct } from './product.service';
import { updateProduct } from './product-edit.service';

afterAll(async () => {
  await db.$client.end({ timeout: 5 });
});

const customer = {
  name: 'Иван Петров',
  phone: '+359881234567',
  email: 'i@x.bg',
};
const shipping = {
  courier: 'econt' as const,
  address: null,
  office: 'Еконт Център',
  note: null,
};

const fields = (slug: string) => ({
  slug,
  name: 'PVC Classic',
  description: null,
  material: 'pvc' as const,
  basePrice: 1990,
  isActive: true,
});

const variant = (name: string, priceDelta: number, stock: number) => ({
  name,
  priceDelta,
  sku: null,
  stock,
  isActive: true,
});

const line = (variantId: string, quantity: number, name = 'Иван') => ({
  variantId,
  quantity,
  personalization: { name, title: null, notes: null },
});

async function seed(slug: string, whiteStock = 5, blackStock = 1) {
  const product = await createProduct(db, {
    fields: fields(slug),
    variants: [
      variant('Бяла', 0, whiteStock),
      variant('Черна', 250, blackStock),
    ],
  });
  const rows = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, product.id))
    .orderBy(productVariants.sortOrder);
  const [white, black] = rows;
  if (white === undefined || black === undefined) throw new Error('seed');
  return { product, white, black };
}

let counter = 0;

async function seedActor() {
  counter += 1;
  const [user] = await db
    .insert(users)
    .values({ email: `o${counter}@example.bg`, passwordHash: 'h', name: 'O' })
    .returning({ id: users.id });
  if (user === undefined) throw new Error('no user');
  const [org] = await db
    .insert(organizations)
    .values({ type: 'personal', name: 'Org', ownerUserId: user.id })
    .returning({ id: organizations.id });
  if (org === undefined) throw new Error('no org');
  return { userId: user.id, orgId: org.id };
}

const stockOf = async (id: string) =>
  (
    await db
      .select({ stock: productVariants.stock })
      .from(productVariants)
      .where(eq(productVariants.id, id))
  )[0]?.stock;

async function codeOf(promise: Promise<unknown>): Promise<OrderError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof OrderError) return error;
    throw error;
  }
  throw new Error('expected an OrderError');
}

const cartOf = (...lines: ReturnType<typeof line>[]): Cart =>
  lines.reduce((cart, item, i) => addLine(cart, item, `l${i}`), emptyCart());

describe('placeOrder', () => {
  it('prices from the locked rows, decrements stock and snapshots names', async () => {
    const { product, white, black } = await seed('po-price');
    const placed = await placeOrder(db, {
      cart: cartOf(line(white.id, 2), line(black.id, 1, 'Мария')),
      customer,
      shipping,
      actor: null,
    });
    expect(placed.number).toMatch(/^DC-\d{4}-\d{6}$/);

    // Цената после се мени — поръчката пази снимката.
    await updateProduct(db, product.id, {
      ...fields('po-price'),
      basePrice: 1,
    });

    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, placed.id))
      .orderBy(orderItems.id);
    expect(
      items.map((i) => [i.productName, i.variantName, i.unitPrice]),
    ).toEqual([
      ['PVC Classic', 'Бяла', 1990],
      ['PVC Classic', 'Черна', 2240],
    ]);
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, placed.id));
    expect(order).toMatchObject({
      status: 'cod',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      subtotal: 6220,
      shippingCost: 590,
      total: 6810,
      userId: null,
      orgId: null,
    });
    expect(await stockOf(white.id)).toBe(3);
    expect(await stockOf(black.id)).toBe(0);
  });

  it('sums two lines of one variant and refuses above stock without writing', async () => {
    const { white } = await seed('po-agg', 5);
    const error = await codeOf(
      placeOrder(db, {
        cart: cartOf(line(white.id, 3), line(white.id, 3, 'Мария')),
        customer,
        shipping,
        actor: null,
      }),
    );
    expect(error.code).toBe('out_of_stock');
    expect(error.message).toContain('Бяла');
    expect(await stockOf(white.id)).toBe(5);

    await placeOrder(db, {
      cart: cartOf(line(white.id, 2), line(white.id, 3, 'Мария')),
      customer,
      shipping,
      actor: null,
    });
    expect(await stockOf(white.id)).toBe(0);
  });

  it('refuses an inactive variant or product by name', async () => {
    const { product, white, black } = await seed('po-inactive');
    await db
      .update(productVariants)
      .set({ isActive: false })
      .where(eq(productVariants.id, black.id));
    const byVariant = await codeOf(
      placeOrder(db, {
        cart: cartOf(line(white.id, 1), line(black.id, 1)),
        customer,
        shipping,
        actor: null,
      }),
    );
    expect(byVariant.code).toBe('unavailable');
    expect(byVariant.message).toContain('Черна');
    expect(await stockOf(white.id)).toBe(5);

    await updateProduct(db, product.id, {
      ...fields('po-inactive'),
      isActive: false,
    });
    const byProduct = await codeOf(
      placeOrder(db, {
        cart: cartOf(line(white.id, 1)),
        customer,
        shipping,
        actor: null,
      }),
    );
    expect(byProduct.code).toBe('unavailable');
  });

  it('rejects an empty cart and invalid input before touching the base', async () => {
    expect(
      (
        await codeOf(
          placeOrder(db, {
            cart: emptyCart(),
            customer,
            shipping,
            actor: null,
          }),
        )
      ).code,
    ).toBe('cart_empty');
    expect(
      (
        await codeOf(
          placeOrder(db, {
            cart: emptyCart(),
            customer: { ...customer, phone: 'abc' },
            shipping,
            actor: null,
          }),
        )
      ).code,
    ).toBe('input_invalid');
    expect(
      (
        await codeOf(
          placeOrder(db, {
            cart: emptyCart(),
            customer,
            shipping: { ...shipping, office: null },
            actor: null,
          }),
        )
      ).code,
    ).toBe('input_invalid');
  });

  it('lets exactly one of two parallel orders take the last unit', async () => {
    const { black } = await seed('po-race', 5, 1);
    const attempt = () =>
      placeOrder(db, {
        cart: cartOf(line(black.id, 1)),
        customer,
        shipping,
        actor: null,
      });
    const results = await Promise.allSettled([attempt(), attempt()]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0]?.reason).toBeInstanceOf(OrderError);
    expect(await stockOf(black.id)).toBe(0);
  });

  it('gives different numbers and stores the actor', async () => {
    const { white } = await seed('po-actor', 10);
    const actor = await seedActor();
    const first = await placeOrder(db, {
      cart: cartOf(line(white.id, 1)),
      customer,
      shipping,
      actor,
    });
    const second = await placeOrder(db, {
      cart: cartOf(line(white.id, 1)),
      customer,
      shipping,
      actor,
    });
    expect(first.number).not.toBe(second.number);
    const [row] = await db.select().from(orders).where(eq(orders.id, first.id));
    expect(row).toMatchObject({ userId: actor.userId, orgId: actor.orgId });
  });
});

describe('getOrderForView / listOrdersByOrg', () => {
  it('shows via token or own org only, as an explicit DTO', async () => {
    const { white } = await seed('view-one', 10);
    const mine = await seedActor();
    const other = await seedActor();
    const placed = await placeOrder(db, {
      cart: cartOf(line(white.id, 2)),
      customer,
      shipping,
      actor: mine,
    });

    expect(
      await getOrderForView(db, {
        number: placed.number,
        orgId: null,
        viaToken: false,
      }),
    ).toBeNull();
    expect(
      await getOrderForView(db, {
        number: placed.number,
        orgId: other.orgId,
        viaToken: false,
      }),
    ).toBeNull();

    const dto = await getOrderForView(db, {
      number: placed.number,
      orgId: null,
      viaToken: true,
    });
    expect(dto).toMatchObject({
      number: placed.number,
      status: 'cod',
      subtotal: 3980,
      shippingCost: 590,
      total: 4570,
      customer,
      shipping,
    });
    expect(dto).not.toHaveProperty('id');
    expect(dto).not.toHaveProperty('orgId');
    expect(dto).not.toHaveProperty('userId');
    expect(dto?.items[0]).toEqual({
      productName: 'PVC Classic',
      variantName: 'Бяла',
      quantity: 2,
      unitPrice: 1990,
      lineTotal: 3980,
      personalization: { name: 'Иван', title: null, notes: null },
    });

    const byOrg = await getOrderForView(db, {
      number: placed.number,
      orgId: mine.orgId,
      viaToken: false,
    });
    expect(byOrg?.number).toBe(placed.number);

    expect(await listOrdersByOrg(db, mine.orgId)).toEqual([
      {
        number: placed.number,
        status: 'cod',
        total: 4570,
        createdAt: expect.any(Date) as Date,
      },
    ]);
    expect(await listOrdersByOrg(db, other.orgId)).toEqual([]);
  });

  it('falls back to empty fields on bad jsonb instead of throwing', async () => {
    const { white } = await seed('view-bad', 10);
    const placed = await placeOrder(db, {
      cart: cartOf(line(white.id, 1)),
      customer,
      shipping,
      actor: null,
    });
    await db
      .update(orders)
      .set({ customer: { nope: 1 } as never, shipping: 'x' as never })
      .where(eq(orders.id, placed.id));
    await db
      .update(orderItems)
      .set({ personalization: [] as never })
      .where(eq(orderItems.orderId, placed.id));

    const dto = await getOrderForView(db, {
      number: placed.number,
      orgId: null,
      viaToken: true,
    });
    expect(dto?.customer).toEqual({ name: '', phone: '', email: '' });
    expect(dto?.shipping.courier).toBe('econt');
    expect(dto?.items[0]?.personalization.name).toBe('');
  });
});
