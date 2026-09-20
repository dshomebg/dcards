// Поръчка с наложен платеж: цените и наличността се фиксират в една транзакция
// от ЗАКЛЮЧЕНИТЕ редове (MON-1), никога от количката или клиента.

import { z } from 'zod';

import type { DbExecutor } from '@/modules/core';

import { env } from '../core/env';
import { type Cart, type CartPersonalization, cartSchema } from './cart';
import {
  decrementVariantStock,
  findOrderByNumberForViewer,
  findOrderItemsByOrder,
  findOrdersByOrg,
  insertOrder,
  insertOrderItems,
  lockVariantsWithProductByIds,
  nextOrderSequence,
} from './order.repository';
import {
  type NewOrderItem,
  type Order,
  type OrderCustomer,
  orderCustomerSchema,
  type OrderItem,
  orderPersonalizationSchema,
  type OrderShipping,
  orderShippingSchema,
  type OrderSummaryDto,
  type OrderViewDto,
  type OrderViewItemDto,
  type PlacedOrder,
} from './order.schema';
import { formatOrderNumber } from './order-number';
import type { VariantWithProduct } from './product.repository';

export type OrderErrorCode =
  | 'cart_empty'
  | 'out_of_stock'
  | 'unavailable'
  | 'input_invalid'
  | 'order_not_found'
  | 'transition_invalid'
  | 'tracking_required'
  | 'tracking_not_shipped'
  | 'cards_locked';

const MESSAGES: Readonly<Record<OrderErrorCode, (name: string) => string>> = {
  cart_empty: () => 'Количката е празна.',
  out_of_stock: (name) =>
    `„${name}" няма достатъчна наличност. Премахни го от количката или намали бройката.`,
  unavailable: (name) =>
    `„${name}" вече не се предлага. Премахни го от количката.`,
  input_invalid: () => 'Има невалидни или твърде дълги полета.',
  order_not_found: () => 'Поръчката не съществува.',
  transition_invalid: () =>
    'Този преход не е позволен от текущия статус — презареди страницата.',
  tracking_required: () => 'Въведи номер на пратка (до 60 знака).',
  tracking_not_shipped: () => 'Номер на пратка се записва след изпращане.',
  cards_locked: () => 'Картите се променят само преди изпращане.',
};

/** `code` е за тестовете и action-а; `message` носи името на реда за човека. */
export class OrderError extends Error {
  constructor(
    readonly code: OrderErrorCode,
    itemName = '',
  ) {
    super(MESSAGES[code](itemName));
    this.name = 'OrderError';
  }
}

const actorSchema = z.object({ userId: z.uuid(), orgId: z.uuid() });

export const placeOrderInputSchema = z.object({
  cart: cartSchema,
  customer: orderCustomerSchema,
  shipping: orderShippingSchema,
  actor: actorSchema.nullable(),
});

export type PlaceOrderInput = z.input<typeof placeOrderInputSchema>;

interface LockedLine {
  readonly row: VariantWithProduct;
  readonly quantity: number;
}

const lineName = (row: VariantWithProduct) =>
  `${row.product.name} · ${row.variant.name}`;

/** Един вариант на два реда се брои веднъж — `/cart` проверява по ред. */
function quantitiesByVariant(cart: Cart): Map<string, number> {
  const totals = new Map<string, number>();
  for (const line of cart.items) {
    totals.set(
      line.variantId,
      (totals.get(line.variantId) ?? 0) + line.quantity,
    );
  }
  return totals;
}

/** Липсващ/неактивен → `unavailable`; под общата бройка → `out_of_stock`. */
async function lockLines(
  tx: DbExecutor,
  totals: Map<string, number>,
): Promise<LockedLine[]> {
  const ids = [...totals.keys()].sort((a, b) => a.localeCompare(b));
  const rows = await lockVariantsWithProductByIds(tx, ids);
  const byId = new Map(rows.map((row) => [row.variant.id, row]));

  return ids.map((id) => {
    const row = byId.get(id);
    if (row === undefined) throw new OrderError('unavailable', 'Продукт');
    if (!row.product.isActive || !row.variant.isActive) {
      throw new OrderError('unavailable', lineName(row));
    }
    const quantity = totals.get(id) ?? 0;
    if (row.variant.stock < quantity) {
      throw new OrderError('out_of_stock', lineName(row));
    }
    return { row, quantity };
  });
}

type PricedItem = Omit<NewOrderItem, 'orderId'>;

/** Цената е от заключения ред, редовете на количката се пазят поотделно. */
function itemsOf(
  cart: Cart,
  priced: ReadonlyMap<string, VariantWithProduct>,
): PricedItem[] {
  return cart.items.map((line) => {
    const row = priced.get(line.variantId);
    if (row === undefined) throw new OrderError('unavailable', 'Продукт');
    return {
      variantId: line.variantId,
      quantity: line.quantity,
      unitPrice: row.product.basePrice + row.variant.priceDelta,
      productName: row.product.name,
      variantName: row.variant.name,
      personalization: line.personalization,
    };
  });
}

/** Актор `null` е гост; сумите са от заключените редове, доставката от env. */
export async function placeOrder(
  executor: DbExecutor,
  input: unknown,
): Promise<PlacedOrder> {
  const parsed = placeOrderInputSchema.safeParse(input);
  if (!parsed.success) throw new OrderError('input_invalid');
  const { cart, customer, shipping, actor } = parsed.data;
  if (cart.items.length === 0) throw new OrderError('cart_empty');

  return executor.transaction(async (tx) => {
    const locked = await lockLines(tx, quantitiesByVariant(cart));
    for (const { row, quantity } of locked) {
      if (!(await decrementVariantStock(tx, row.variant.id, quantity))) {
        throw new OrderError('out_of_stock', lineName(row));
      }
    }

    const priced = new Map(locked.map(({ row }) => [row.variant.id, row]));
    const items = itemsOf(cart, priced);
    const subtotal = items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
    const shippingCost = env().SHIPPING_COST_MINOR;

    const seq = await nextOrderSequence(tx);
    const created = await insertOrder(tx, {
      number: formatOrderNumber(new Date().getFullYear(), seq),
      userId: actor?.userId ?? null,
      orgId: actor?.orgId ?? null,
      status: 'cod',
      customer,
      shipping,
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      subtotal,
      shippingCost,
      total: subtotal + shippingCost,
    });
    await insertOrderItems(
      tx,
      items.map((item) => ({ ...item, orderId: created.id })),
    );
    return {
      ...created,
      items: items.map(({ productName, variantName, quantity, unitPrice }) => ({
        productName,
        variantName,
        quantity,
        unitPrice,
      })),
      subtotal,
      shippingCost,
      total: subtotal + shippingCost,
    };
  });
}

const EMPTY_CUSTOMER: OrderCustomer = { name: '', phone: '', email: '' };
const EMPTY_SHIPPING: OrderShipping = {
  courier: 'econt',
  address: null,
  office: null,
  note: null,
};
const EMPTY_PERSONALIZATION: CartPersonalization = {
  name: '',
  title: null,
  notes: null,
  logoKey: null,
};

/** Лош jsonb в базата → празни полета, не 500 (DAT-7). */
function safe<T>(schema: z.ZodType<T>, raw: unknown, fallback: T): T {
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : fallback;
}

function viewItem(item: OrderItem): OrderViewItemDto {
  return {
    productName: item.productName,
    variantName: item.variantName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.unitPrice * item.quantity,
    personalization: safe(
      orderPersonalizationSchema,
      item.personalization,
      EMPTY_PERSONALIZATION,
    ),
  };
}

/** Общо с админа (`order-admin.service.ts`) — лош jsonb дава празни полета, не 500. */
export function toViewDto(
  order: Order,
  items: readonly OrderItem[],
): OrderViewDto {
  return {
    number: order.number,
    status: order.status,
    createdAt: order.createdAt,
    customer: safe(orderCustomerSchema, order.customer, EMPTY_CUSTOMER),
    shipping: safe(orderShippingSchema, order.shipping, EMPTY_SHIPPING),
    paymentMethod: order.paymentMethod,
    subtotal: order.subtotal,
    shippingCost: order.shippingCost,
    total: order.total,
    trackingNumber: order.trackingNumber,
    items: items.map(viewItem),
  };
}

export interface OrderViewQuery {
  readonly number: string;
  readonly orgId: string | null;
  readonly viaToken: boolean;
}

/** `viaToken=false` и `orgId=null` → винаги `null`; чужд и липсващ са неразличими. */
export async function getOrderForView(
  executor: DbExecutor,
  { number, orgId, viaToken }: OrderViewQuery,
): Promise<OrderViewDto | null> {
  if (!viaToken && orgId === null) return null;
  const order = await findOrderByNumberForViewer(
    executor,
    number,
    orgId,
    viaToken,
  );
  if (order === null) return null;
  const items = await findOrderItemsByOrder(executor, order.id);
  return toViewDto(order, items);
}

export async function listOrdersByOrg(
  executor: DbExecutor,
  orgId: string,
): Promise<OrderSummaryDto[]> {
  const rows = await findOrdersByOrg(executor, orgId);
  return rows.map((row) => ({
    number: row.number,
    status: row.status,
    total: row.total,
    createdAt: row.createdAt,
  }));
}
