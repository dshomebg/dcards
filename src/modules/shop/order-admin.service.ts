// Поръчката откъм админа: списък, детайл, преходи между статуси и заключване
// за карти. Отказът връща наличността в същата транзакция; картите ги връща
// `platform` — съставя ги action-ът (ARC-2).

import { z } from 'zod';

import type { DbExecutor } from '@/modules/core';

import {
  findOrderById,
  findOrderItemsByOrder,
  findOrdersForAdmin,
  incrementVariantStock,
  lockOrder,
  type OrderStatusUpdate,
  sumOrderQuantitiesByVariant,
  updateOrderStatus,
  updateOrderTrackingNumber,
} from './order.repository';
import {
  type Courier,
  type Order,
  ORDER_STATUSES,
  orderCustomerSchema,
  orderShippingSchema,
  type OrderStatus,
  type OrderViewDto,
  type PaymentStatus,
} from './order.schema';
import { OrderError, toViewDto } from './order.service';

/** Единственият източник за позволените преходи — и за бутоните, и за action-а. */
export const ORDER_TRANSITIONS: Readonly<
  Record<OrderStatus, readonly OrderStatus[]>
> = {
  new: ['in_production', 'cancelled'],
  paid: ['in_production', 'cancelled'],
  cod: ['in_production', 'cancelled'],
  in_production: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

/** Карти се присвояват и откачат само преди изпращане. */
export const CARD_EDITABLE_STATUSES: readonly OrderStatus[] = [
  'new',
  'paid',
  'cod',
  'in_production',
];

// Букви/цифри и `-_/. ` — без контролни знаци в писмото.
export const TRACKING_PATTERN = /^[\p{L}\p{N} ._/-]+$/u;
const trackingSchema = z.string().trim().min(1).max(60).regex(TRACKING_PATTERN);

export interface AdminOrderSummaryDto {
  readonly id: string;
  readonly number: string;
  readonly status: OrderStatus;
  readonly paymentMethod: Order['paymentMethod'];
  readonly paymentStatus: PaymentStatus;
  readonly customerName: string;
  readonly total: number;
  readonly createdAt: Date;
}

export async function listOrdersForAdmin(
  executor: DbExecutor,
  status?: OrderStatus,
): Promise<AdminOrderSummaryDto[]> {
  const rows = await findOrdersForAdmin(executor, status);
  return rows.map((row) => {
    const customer = orderCustomerSchema.safeParse(row.customer);
    return {
      id: row.id,
      number: row.number,
      status: row.status,
      paymentMethod: row.paymentMethod,
      paymentStatus: row.paymentStatus,
      customerName: customer.success ? customer.data.name : '',
      total: row.total,
      createdAt: row.createdAt,
    };
  });
}

export interface AdminOrderDto extends OrderViewDto {
  readonly id: string;
  readonly paymentStatus: PaymentStatus;
  /** Поръчка с org — клиентът вижда `/order/{number}` и след изтичане на токена. */
  readonly hasAccount: boolean;
  readonly updatedAt: Date;
  /** Σ quantity — таванът на картите. */
  readonly quota: number;
  readonly transitions: readonly OrderStatus[];
  readonly cardsEditable: boolean;
}

export async function getOrderForAdmin(
  executor: DbExecutor,
  id: string,
): Promise<AdminOrderDto | null> {
  const order = await findOrderById(executor, id);
  if (order === null) return null;
  const items = await findOrderItemsByOrder(executor, id);
  return {
    ...toViewDto(order, items),
    id: order.id,
    paymentStatus: order.paymentStatus,
    hasAccount: order.orgId !== null,
    updatedAt: order.updatedAt,
    quota: items.reduce((sum, item) => sum + item.quantity, 0),
    transitions: ORDER_TRANSITIONS[order.status],
    cardsEditable: CARD_EDITABLE_STATUSES.includes(order.status),
  };
}

export interface TransitionOrderInput {
  readonly id: string;
  readonly to: OrderStatus;
  readonly trackingNumber?: string;
}

const transitionInputSchema = z.object({
  id: z.uuid(),
  to: z.enum(ORDER_STATUSES),
  trackingNumber: z.string().optional(),
});

/** Каквото трябва на action-а след commit: писмо и revalidate. */
export interface OrderTransition {
  readonly id: string;
  readonly number: string;
  readonly from: OrderStatus;
  readonly to: OrderStatus;
  readonly courier: Courier;
  /** `null` = лош jsonb — без писмо. */
  readonly customerEmail: string | null;
  readonly hasAccount: boolean;
  /** За `shipped`: картите на org-поръчката влизат в този org (app-слоят). */
  readonly orgId: string | null;
  readonly trackingNumber: string | null;
}

function patchFor(
  order: Order,
  input: TransitionOrderInput,
): OrderStatusUpdate {
  const base = { id: order.id, from: order.status, to: input.to };
  if (input.to === 'shipped') {
    const tracking = trackingSchema.safeParse(input.trackingNumber);
    if (!tracking.success) throw new OrderError('tracking_required');
    return { ...base, trackingNumber: tracking.data };
  }
  if (input.to === 'delivered' && order.paymentMethod === 'cod') {
    return { ...base, paymentStatus: 'paid' };
  }
  return base;
}

/** Stock се връща по вариант в ред по id — същият ред като при checkout. */
async function restoreStock(tx: DbExecutor, orderId: string): Promise<void> {
  for (const row of await sumOrderQuantitiesByVariant(tx, orderId)) {
    await incrementVariantStock(tx, row.variantId, row.quantity);
  }
}

function toTransition(
  updated: Order,
  from: OrderStatus,
  to: OrderStatus,
): OrderTransition {
  const customer = orderCustomerSchema.safeParse(updated.customer);
  const shipping = orderShippingSchema.safeParse(updated.shipping);
  return {
    id: updated.id,
    number: updated.number,
    from,
    to,
    courier: shipping.success ? shipping.data.courier : 'econt',
    customerEmail: customer.success ? customer.data.email : null,
    hasAccount: updated.orgId !== null,
    orgId: updated.orgId,
    trackingNumber: updated.trackingNumber,
  };
}

/**
 * Заключва поръчката, проверява прехода по `ORDER_TRANSITIONS` и пише с
 * условен `WHERE status = from`. Отказът връща наличността. Писмото е на
 * извикващия — след commit.
 */
export async function transitionOrder(
  executor: DbExecutor,
  input: TransitionOrderInput,
): Promise<OrderTransition> {
  const parsed = transitionInputSchema.safeParse(input);
  if (!parsed.success) throw new OrderError('input_invalid');
  const { id, to } = parsed.data;

  return executor.transaction(async (tx) => {
    const order = await lockOrder(tx, id);
    if (order === null) throw new OrderError('order_not_found');
    if (!ORDER_TRANSITIONS[order.status].includes(to)) {
      throw new OrderError('transition_invalid');
    }
    const updated = await updateOrderStatus(tx, patchFor(order, parsed.data));
    if (updated === null) throw new OrderError('transition_invalid');
    if (to === 'cancelled') await restoreStock(tx, id);
    return toTransition(updated, order.status, to);
  });
}

/** Смяна на номера след изпращане — без писмо. Връща номера на поръчката. */
export async function setTrackingNumber(
  executor: DbExecutor,
  id: string,
  value: string,
): Promise<{ number: string }> {
  const tracking = trackingSchema.safeParse(value);
  if (!tracking.success) throw new OrderError('tracking_required');
  const row = await updateOrderTrackingNumber(executor, id, tracking.data);
  if (row === null) throw new OrderError('tracking_not_shipped');
  return row;
}

export interface OrderCardsLock {
  readonly status: OrderStatus;
  readonly orgId: string | null;
  readonly quota: number;
}

/**
 * `FOR UPDATE` върху поръчката преди картите — квотата се брои срещу
 * заключен ред. Само в статус, в който картите още се променят.
 */
export async function lockOrderForCards(
  tx: DbExecutor,
  id: string,
): Promise<OrderCardsLock> {
  const order = await lockOrder(tx, id);
  if (order === null) throw new OrderError('order_not_found');
  if (!CARD_EDITABLE_STATUSES.includes(order.status)) {
    throw new OrderError('cards_locked');
  }
  const items = await findOrderItemsByOrder(tx, id);
  return {
    status: order.status,
    orgId: order.orgId,
    quota: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}
