import { ShoppingBag } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { type Column, DataTable, ListState } from '@/components/list';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { db, env } from '@/modules/core';
import {
  formatPrice,
  listOrdersByOrg,
  ORDER_STATUS_LABELS,
  type OrderStatus,
  type OrderSummaryDto,
  type PriceFormat,
} from '@/modules/shop';

import { requireCurrent } from '../current';

export const metadata: Metadata = { title: 'Поръчки' };

const dateFormat = new Intl.DateTimeFormat('bg-BG', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const TONES: Readonly<Record<OrderStatus, BadgeTone>> = {
  new: 'info',
  cod: 'info',
  paid: 'success',
  in_production: 'warning',
  shipped: 'brand',
  delivered: 'success',
  cancelled: 'danger',
};

function columns(format: PriceFormat): Column<OrderSummaryDto>[] {
  return [
    {
      key: 'number',
      header: 'Номер',
      className: 'font-mono',
      cell: (order) => (
        <Link href={`/order/${order.number}`} className="underline">
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
    {
      key: 'status',
      header: 'Статус',
      cell: (order) => (
        <Badge tone={TONES[order.status]}>
          {ORDER_STATUS_LABELS[order.status]}
        </Badge>
      ),
    },
    {
      key: 'total',
      header: 'Общо',
      className: 'whitespace-nowrap',
      cell: (order) => formatPrice(order.total, format),
    },
  ];
}

export default async function OrdersPage() {
  const { org } = await requireCurrent();
  const orders = await listOrdersByOrg(db, org.id);
  const { STORE_CURRENCY, STORE_LOCALE } = env();
  const format = { currency: STORE_CURRENCY, locale: STORE_LOCALE };

  return (
    <main className="flex flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Поръчки</h1>

      {orders.length === 0 ? (
        <ListState
          icon={ShoppingBag}
          title="Още нямаш поръчки"
          hint="Поръчаните от този акаунт карти ще се появят тук."
        />
      ) : (
        <DataTable
          caption="Поръчките на организацията"
          columns={columns(format)}
          rows={orders}
          rowKey={(order) => order.number}
        />
      )}
    </main>
  );
}
