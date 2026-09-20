// Достъп до `orders` и `order_items` плюс заключването и намаляването на
// наличност по варианти — единственият SQL за поръчките.

import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';

import type { DbExecutor } from '@/modules/core';

import {
  type NewOrder,
  type NewOrderItem,
  type Order,
  type OrderItem,
  orderItems,
  orders,
  type OrderStatus,
  type PaymentStatus,
} from './order.schema';
import type { VariantWithProduct } from './product.repository';
import { products, productVariants } from './product.schema';

/**
 * Заключва редовете на вариантите до края на транзакцията. `ORDER BY id` —
 * два едновременни checkout-а заключват в един ред и не се блокират взаимно.
 */
export async function lockVariantsWithProductByIds(
  executor: DbExecutor,
  ids: readonly string[],
): Promise<VariantWithProduct[]> {
  if (ids.length === 0) return [];
  return executor
    .select({ variant: productVariants, product: products })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(inArray(productVariants.id, [...ids]))
    .orderBy(asc(productVariants.id))
    .for('update', { of: productVariants });
}

/** `false` = наличността не стига; условието е и в WHERE, не само в кода. */
export async function decrementVariantStock(
  executor: DbExecutor,
  variantId: string,
  quantity: number,
): Promise<boolean> {
  const rows = await executor
    .update(productVariants)
    .set({ stock: sql`${productVariants.stock} - ${quantity}` })
    .where(
      and(
        eq(productVariants.id, variantId),
        sql`${productVariants.stock} >= ${quantity}`,
      ),
    )
    .returning({ id: productVariants.id });
  return rows.length > 0;
}

export async function nextOrderSequence(executor: DbExecutor): Promise<number> {
  const rows = await executor.execute<{ value: string | number }>(
    sql`select nextval('order_number_seq') as value`,
  );
  const value = rows[0]?.value;
  if (value === undefined) throw new Error('nextval returned no row');
  return Number(value);
}

export async function insertOrder(
  executor: DbExecutor,
  values: NewOrder,
): Promise<Pick<Order, 'id' | 'number' | 'createdAt'>> {
  const rows = await executor.insert(orders).values(values).returning({
    id: orders.id,
    number: orders.number,
    createdAt: orders.createdAt,
  });
  const created = rows[0];
  if (created === undefined) throw new Error('insert orders returned no row');
  return created;
}

export async function insertOrderItems(
  executor: DbExecutor,
  values: readonly NewOrderItem[],
): Promise<void> {
  if (values.length === 0) return;
  await executor.insert(orderItems).values([...values]);
}

/**
 * Една заявка: по номер И (токен ИЛИ org). Без токен и без org условието е
 * `false` — чужд и несъществуващ номер са неразличими (DAT-7).
 */
export async function findOrderByNumberForViewer(
  executor: DbExecutor,
  number: string,
  orgId: string | null,
  viaToken: boolean,
): Promise<Order | null> {
  const byOrg = orgId === null ? sql`false` : eq(orders.orgId, orgId);
  const rows = await executor
    .select()
    .from(orders)
    .where(and(eq(orders.number, number), viaToken ? undefined : byOrg))
    .limit(1);
  return rows[0] ?? null;
}

export function findOrderItemsByOrder(
  executor: DbExecutor,
  orderId: string,
): Promise<OrderItem[]> {
  return executor
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(asc(orderItems.id));
}

export interface OrderSummaryRow {
  readonly number: string;
  readonly status: OrderStatus;
  readonly total: number;
  readonly createdAt: Date;
}

export function findOrdersByOrg(
  executor: DbExecutor,
  orgId: string,
): Promise<OrderSummaryRow[]> {
  return executor
    .select({
      number: orders.number,
      status: orders.status,
      total: orders.total,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.orgId, orgId))
    .orderBy(desc(orders.createdAt), desc(orders.id));
}

/** Всички поръчки за админа, най-новите първо; `status` стеснява, `undefined` = всички. */
export function findOrdersForAdmin(
  executor: DbExecutor,
  status: OrderStatus | undefined,
): Promise<Order[]> {
  return executor
    .select()
    .from(orders)
    .where(status === undefined ? undefined : eq(orders.status, status))
    .orderBy(desc(orders.createdAt), desc(orders.id));
}

export async function findOrderById(
  executor: DbExecutor,
  id: string,
): Promise<Order | null> {
  const rows = await executor
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/** Заключва поръчката до края на транзакцията (`FOR UPDATE`). */
export async function lockOrder(
  executor: DbExecutor,
  id: string,
): Promise<Order | null> {
  const rows = await executor
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .for('update');
  return rows[0] ?? null;
}

export interface OrderStatusUpdate {
  readonly id: string;
  readonly from: OrderStatus;
  readonly to: OrderStatus;
  readonly trackingNumber?: string;
  readonly paymentStatus?: PaymentStatus;
}

/**
 * `WHERE status = from` — при двоен submit вторият не намира ред и страничните
 * ефекти (stock, карти) стават точно веднъж. `null` = преходът вече е минал.
 */
export async function updateOrderStatus(
  executor: DbExecutor,
  { id, from, to, trackingNumber, paymentStatus }: OrderStatusUpdate,
): Promise<Order | null> {
  const rows = await executor
    .update(orders)
    .set({
      status: to,
      ...(trackingNumber === undefined ? {} : { trackingNumber }),
      ...(paymentStatus === undefined ? {} : { paymentStatus }),
    })
    .where(and(eq(orders.id, id), eq(orders.status, from)))
    .returning();
  return rows[0] ?? null;
}

/** Само след изпращане — преди това номерът идва с прехода към `shipped`. `null` = не мина. */
export async function updateOrderTrackingNumber(
  executor: DbExecutor,
  id: string,
  trackingNumber: string,
): Promise<Pick<Order, 'number'> | null> {
  const rows = await executor
    .update(orders)
    .set({ trackingNumber })
    .where(
      and(eq(orders.id, id), inArray(orders.status, ['shipped', 'delivered'])),
    )
    .returning({ number: orders.number });
  return rows[0] ?? null;
}

export interface VariantQuantityRow {
  readonly variantId: string;
  readonly quantity: number;
}

/** Агрегирано по вариант и в ред по `variant_id` — редът на заключване при отказ. */
export function sumOrderQuantitiesByVariant(
  executor: DbExecutor,
  orderId: string,
): Promise<VariantQuantityRow[]> {
  return executor
    .select({
      variantId: orderItems.variantId,
      quantity: sql<number>`sum(${orderItems.quantity})::int`,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .groupBy(orderItems.variantId)
    .orderBy(asc(orderItems.variantId));
}

export async function incrementVariantStock(
  executor: DbExecutor,
  variantId: string,
  quantity: number,
): Promise<void> {
  await executor
    .update(productVariants)
    .set({ stock: sql`${productVariants.stock} + ${quantity}` })
    .where(eq(productVariants.id, variantId));
}
