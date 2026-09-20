// Поръчки и техните редове. Сумите са в minor units (MON-1) и се фиксират в
// момента на поръчката; `order_items` е снимка на име и цена, не връзка към тях.

import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { z } from 'zod';

import { users } from '../auth/user.schema';
import { createdAt, primaryId, updatedAt } from '../core/db/columns';
import { organizations } from '../platform/organization.schema';
import { type CartPersonalization, cartPersonalizationSchema } from './cart';
import { productVariants } from './product.schema';

export const ORDER_STATUSES = [
  'new',
  'cod',
  'paid',
  'in_production',
  'shipped',
  'delivered',
  'cancelled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const orderStatusEnum = pgEnum('order_status', ORDER_STATUSES);

export const ORDER_STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  new: 'нова',
  cod: 'наложен платеж',
  paid: 'платена',
  in_production: 'в производство',
  shipped: 'изпратена',
  delivered: 'доставена',
  cancelled: 'отказана',
};

export const PAYMENT_METHODS = ['cod', 'card'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const paymentMethodEnum = pgEnum('payment_method', PAYMENT_METHODS);

export const PAYMENT_STATUSES = ['pending', 'paid', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const paymentStatusEnum = pgEnum('payment_status', PAYMENT_STATUSES);

export const COURIERS = ['econt', 'speedy'] as const;
export type Courier = (typeof COURIERS)[number];

export const COURIER_LABELS: Readonly<Record<Courier, string>> = {
  econt: 'Еконт',
  speedy: 'Спиди',
};

// Глобален, не по година: дупки при rollback са приемливи (DAT-1 — в схемата).
export const orderNumberSeq = pgSequence('order_number_seq', { startWith: 1 });

export const ORDER_PHONE_PATTERN = /^\+?[0-9 ()-]{6,20}$/;

const optionalText = (max: number, tooLong: string) =>
  z
    .string()
    .trim()
    .max(max, tooLong)
    .nullish()
    .transform((value) =>
      value === undefined || value === null || value === '' ? null : value,
    );

export const orderCustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Името е задължително.')
    .max(120, 'Името е до 120 знака.'),
  phone: z
    .string()
    .trim()
    .regex(ORDER_PHONE_PATTERN, 'Въведи валиден телефон.'),
  email: z.email('Въведи валиден имейл.').max(254),
});

/** Точно едно от адрес/офис — куриерът носи или до врата, или до офис. */
export const orderShippingSchema = z
  .object({
    courier: z.enum(COURIERS, 'Избери куриер.'),
    address: optionalText(300, 'Адресът е до 300 знака.'),
    office: optionalText(120, 'Офисът е до 120 знака.'),
    note: optionalText(300, 'Бележката е до 300 знака.'),
  })
  .refine(
    (value) => (value.address === null) !== (value.office === null),
    'Посочи адрес или офис.',
  );

export const orderPersonalizationSchema = cartPersonalizationSchema;

export type OrderCustomer = z.output<typeof orderCustomerSchema>;
export type OrderShipping = z.output<typeof orderShippingSchema>;

export const orders = pgTable(
  'orders',
  {
    id: primaryId(),
    number: text('number').notNull(),
    // Гост → и двете `null`; изтрит акаунт оставя поръчката (`set null`).
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    orgId: uuid('org_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),
    status: orderStatusEnum('status').notNull().default('new'),
    customer: jsonb('customer').$type<OrderCustomer>().notNull(),
    shipping: jsonb('shipping').$type<OrderShipping>().notNull(),
    paymentMethod: paymentMethodEnum('payment_method').notNull(),
    paymentStatus: paymentStatusEnum('payment_status')
      .notNull()
      .default('pending'),
    subtotal: integer('subtotal').notNull(),
    shippingCost: integer('shipping_cost').notNull(),
    total: integer('total').notNull(),
    trackingNumber: text('tracking_number'),
    createdAt: createdAt(),
    // DAT-5 казва „само created_at", но SHP-3 сменя статус — влиза отсега.
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('orders_number_idx').on(table.number),
    index('orders_user_idx').on(table.userId),
    index('orders_org_idx').on(table.orgId),
    index('orders_status_idx').on(table.status),
    index('orders_created_idx').on(table.createdAt),
    check('orders_subtotal_nonneg', sql`${table.subtotal} >= 0`),
    check('orders_shipping_cost_nonneg', sql`${table.shippingCost} >= 0`),
    check('orders_total_nonneg', sql`${table.total} >= 0`),
    check(
      'orders_total_sum',
      sql`${table.total} = ${table.subtotal} + ${table.shippingCost}`,
    ),
  ],
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

export const orderItems = pgTable(
  'order_items',
  {
    id: primaryId(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    // `restrict` (MON-3): вариант с поръчка се деактивира, не се трие.
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'restrict' }),
    quantity: integer('quantity').notNull(),
    unitPrice: integer('unit_price').notNull(),
    productName: text('product_name').notNull(),
    variantName: text('variant_name').notNull(),
    personalization: jsonb('personalization')
      .$type<CartPersonalization>()
      .notNull(),
  },
  (table) => [
    index('order_items_order_idx').on(table.orderId),
    index('order_items_variant_idx').on(table.variantId),
    check('order_items_quantity_positive', sql`${table.quantity} >= 1`),
    check('order_items_unit_price_nonneg', sql`${table.unitPrice} >= 0`),
  ],
);

export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;

/** Каквото вижда клиентът — изрично (DAT-7): без `id`, `userId`, `orgId`, `variantId`. */
export interface OrderViewItemDto {
  readonly productName: string;
  readonly variantName: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly lineTotal: number;
  readonly personalization: CartPersonalization;
}

export interface OrderViewDto {
  readonly number: string;
  readonly status: OrderStatus;
  readonly createdAt: Date;
  readonly customer: OrderCustomer;
  readonly shipping: OrderShipping;
  readonly paymentMethod: PaymentMethod;
  readonly subtotal: number;
  readonly shippingCost: number;
  readonly total: number;
  readonly trackingNumber: string | null;
  readonly items: readonly OrderViewItemDto[];
}

export interface OrderSummaryDto {
  readonly number: string;
  readonly status: OrderStatus;
  readonly total: number;
  readonly createdAt: Date;
}

export interface PlacedOrderItem {
  readonly productName: string;
  readonly variantName: string;
  readonly quantity: number;
  readonly unitPrice: number;
}

/** Каквото трябва на писмото (SHP-2c) — от заключените цени, без втора заявка. */
export interface PlacedOrder {
  readonly id: string;
  readonly number: string;
  readonly createdAt: Date;
  readonly items: readonly PlacedOrderItem[];
  readonly subtotal: number;
  readonly shippingCost: number;
  readonly total: number;
}
