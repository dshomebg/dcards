// Преглед на поръчка: гост през токена в cookie, клиент през своята org.
// Чужд и несъществуващ номер са неразличими — един 404 (DAT-7).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { loadCurrent } from '@/app/app/(protected)/current';
import { db, env } from '@/modules/core';
import {
  COURIER_LABELS,
  formatPrice,
  getOrderForView,
  ORDER_STATUS_LABELS,
  orderNumberSchema,
  type OrderViewDto,
  type PriceFormat,
} from '@/modules/shop';

import { readOrderViewNumber } from '../../checkout/order-view';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Поръчка',
  robots: { index: false, follow: false },
};

// Изричен тип, не генерираният `PageProps` — виж `src/app/[slug]/page.tsx`.
type Props = Readonly<{ params: Promise<{ number: string }> }>;

const dateFormat = new Intl.DateTimeFormat('bg-BG', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function Items({
  order,
  format,
}: Readonly<{ order: OrderViewDto; format: PriceFormat }>) {
  return (
    <ul className="flex flex-col gap-hint">
      {order.items.map((item, index) => (
        <li
          key={index}
          className="flex justify-between gap-4 rounded-(--radius-card) border border-border bg-surface p-4 text-sm"
        >
          <span>
            <span className="font-semibold">{item.productName}</span>
            {item.variantName !== '' && (
              <span className="text-text-muted"> · {item.variantName}</span>
            )}
            <span className="text-text-muted block">
              {item.personalization.name}
              {item.personalization.title !== null &&
                `, ${item.personalization.title}`}
              {item.personalization.notes !== null &&
                ` — ${item.personalization.notes}`}
            </span>
          </span>
          <span className="whitespace-nowrap">
            {item.quantity} × {formatPrice(item.unitPrice, format)} ={' '}
            <strong>{formatPrice(item.lineTotal, format)}</strong>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Details({ order }: Readonly<{ order: OrderViewDto }>) {
  const { shipping, customer } = order;
  return (
    <dl className="grid grid-cols-1 gap-hint text-sm sm:grid-cols-2">
      <div>
        <dt className="text-text-muted">Куриер</dt>
        <dd>
          {COURIER_LABELS[shipping.courier]}
          {shipping.address !== null && ` — до адрес: ${shipping.address}`}
          {shipping.office !== null && ` — до офис: ${shipping.office}`}
        </dd>
      </div>
      <div>
        <dt className="text-text-muted">Получател</dt>
        <dd>
          {customer.name}
          <br />
          {customer.phone}
          <br />
          {customer.email}
        </dd>
      </div>
      {shipping.note !== null && (
        <div className="sm:col-span-2">
          <dt className="text-text-muted">Бележка</dt>
          <dd className="whitespace-pre-line">{shipping.note}</dd>
        </div>
      )}
    </dl>
  );
}

export default async function OrderPage(props: Props) {
  const { number } = await props.params;
  // Лош формат → 404 без заявка.
  if (!orderNumberSchema.safeParse(number).success) notFound();

  const [viewNumber, current] = await Promise.all([
    readOrderViewNumber(),
    loadCurrent(),
  ]);
  const order = await getOrderForView(db, {
    number,
    orgId: current?.org.id ?? null,
    viaToken: viewNumber === number,
  });
  if (order === null) notFound();

  const { STORE_CURRENCY, STORE_LOCALE } = env();
  const format = { currency: STORE_CURRENCY, locale: STORE_LOCALE };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-block px-4 py-10">
      <header className="flex flex-col gap-hint">
        <h1 className="text-2xl font-semibold tracking-tight">
          Поръчка {order.number}
        </h1>
        <p className="text-text-muted text-sm">
          {dateFormat.format(order.createdAt)} · статус:{' '}
          {ORDER_STATUS_LABELS[order.status]}
        </p>
      </header>

      <p>Ще се свържем с вас за потвърждение. Плащане при доставка.</p>

      {order.trackingNumber !== null &&
        (order.status === 'shipped' || order.status === 'delivered') && (
          <p className="text-sm">
            Пратка: <span className="font-mono">{order.trackingNumber}</span>
          </p>
        )}

      <Items order={order} format={format} />

      <dl className="flex flex-col items-end gap-hint border-t border-border pt-4 text-sm">
        <div className="flex gap-4">
          <dt>Продукти</dt>
          <dd>{formatPrice(order.subtotal, format)}</dd>
        </div>
        <div className="flex gap-4">
          <dt>Доставка</dt>
          <dd>{formatPrice(order.shippingCost, format)}</dd>
        </div>
        <div className="flex gap-4 text-lg font-semibold">
          <dt>Общо</dt>
          <dd>{formatPrice(order.total, format)}</dd>
        </div>
      </dl>

      <Details order={order} />
    </main>
  );
}
