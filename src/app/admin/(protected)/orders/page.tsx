import { ShoppingBag } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { z } from 'zod';

import {
  type Column,
  DataTable,
  FilterBar,
  ListState,
  SelectFilter,
} from '@/components/list';
import { db, env } from '@/modules/core';
import {
  type AdminOrderSummaryDto,
  formatPrice,
  listOrdersForAdmin,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  type PriceFormat,
} from '@/modules/shop';

import { requireAdmin } from '../current';
import {
  OrderStatusBadge,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from './order-status-badge';

export const metadata: Metadata = { title: 'Поръчки' };

type Props = Readonly<{
  searchParams: Promise<{ status?: string | string[] }>;
}>;

const dateFormat = new Intl.DateTimeFormat('bg-BG', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const STATUS_OPTIONS = ORDER_STATUSES.map((status) => ({
  value: status,
  label: ORDER_STATUS_LABELS[status],
}));

function columns(format: PriceFormat): readonly Column<AdminOrderSummaryDto>[] {
  return [
    {
      key: 'number',
      header: 'Номер',
      className: 'font-mono',
      cell: (order) => (
        <Link href={`/admin/orders/${order.id}`} className="font-medium">
          {order.number}
        </Link>
      ),
    },
    {
      key: 'createdAt',
      header: 'Дата',
      className: 'whitespace-nowrap',
      cell: (order) => dateFormat.format(order.createdAt),
    },
    { key: 'customer', header: 'Клиент', cell: (order) => order.customerName },
    {
      key: 'status',
      header: 'Статус',
      cell: (order) => <OrderStatusBadge status={order.status} />,
    },
    {
      key: 'payment',
      header: 'Плащане',
      cell: (order) =>
        `${PAYMENT_METHOD_LABELS[order.paymentMethod]} · ${PAYMENT_STATUS_LABELS[order.paymentStatus]}`,
    },
    {
      key: 'total',
      header: 'Общо',
      className: 'text-right whitespace-nowrap',
      cell: (order) => formatPrice(order.total, format),
    },
  ];
}

/** Невалиден или липсващ филтър → всички поръчки, без грешка. */
const statusFilter = z.enum(ORDER_STATUSES).optional().catch(undefined);

export default async function OrdersPage(props: Props) {
  await requireAdmin();
  const { status } = await props.searchParams;
  const filter = statusFilter.parse(status);
  const orders = await listOrdersForAdmin(db, filter);
  const { STORE_CURRENCY, STORE_LOCALE } = env();
  const format = { currency: STORE_CURRENCY, locale: STORE_LOCALE };

  return (
    <main className="flex flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Поръчки</h1>

      <FilterBar>
        <SelectFilter
          paramKey="status"
          label="Статус"
          options={STATUS_OPTIONS}
        />
      </FilterBar>

      {orders.length === 0 ? (
        <ListState
          icon={ShoppingBag}
          title={
            filter === undefined
              ? 'Още няма поръчки'
              : 'Няма поръчки с този статус'
          }
          hint="Поръчките идват от магазина — най-новите са първи."
        />
      ) : (
        <DataTable
          caption="Поръчки"
          columns={columns(format)}
          rows={orders}
          rowKey={(order) => order.id}
        />
      )}
    </main>
  );
}
