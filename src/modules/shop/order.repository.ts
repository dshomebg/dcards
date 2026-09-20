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
): Promise<Pick<Order, 'id' | 'number'>> {
  const rows = await executor
    .insert(orders)
    .values(values)
    .returning({ id: orders.id, number: orders.number });
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
