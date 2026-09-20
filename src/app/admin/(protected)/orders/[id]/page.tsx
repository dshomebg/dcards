import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';

import { db, env } from '@/modules/core';
import { listBatches, listCardsByOrder } from '@/modules/platform';
import { getOrderForAdmin } from '@/modules/shop';

import { requireAdmin } from '../../current';
import { OrderStatusBadge } from '../order-status-badge';
import { StatusForm } from '../status-form';
import { TrackingForm } from '../tracking-form';
import { OrderCards } from './order-cards';
import {
  CustomerSection,
  ItemsSection,
  Section,
  ShippingSection,
} from './order-sections';

export const metadata: Metadata = { title: 'Поръчка' };

type Props = Readonly<{ params: Promise<{ id: string }> }>;

const dateFormat = new Intl.DateTimeFormat('bg-BG', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

// Сесията първо (без нея е login, не 404); после не-UUID → 404 без заявка.
export default async function OrderPage(props: Props) {
  await requireAdmin();
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();

  const order = await getOrderForAdmin(db, id);
  if (order === null) notFound();
  const [cards, batches] = await Promise.all([
    listCardsByOrder(db, id),
    listBatches(db),
  ]);
  const { STORE_CURRENCY, STORE_LOCALE } = env();
  const format = { currency: STORE_CURRENCY, locale: STORE_LOCALE };
  const shipped = order.status === 'shipped' || order.status === 'delivered';

  return (
    <main className="flex flex-col gap-6 px-6 py-10">
      <div>
        <Link
          href="/admin/orders"
          className="text-text-muted text-sm underline"
        >
          Поръчки
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="font-mono text-2xl font-semibold">{order.number}</h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="text-text-muted mt-1 text-sm">
          създадена {dateFormat.format(order.createdAt)} · променена{' '}
          {dateFormat.format(order.updatedAt)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CustomerSection order={order} />
        <ShippingSection order={order} />
      </div>

      <ItemsSection order={order} format={format} />

      <Section title="Статус">
        {order.transitions.length === 0 ? (
          <p className="text-text-muted text-sm">Няма следващ преход.</p>
        ) : (
          <StatusForm orderId={order.id} transitions={order.transitions} />
        )}
      </Section>

      {shipped && (
        <Section title="Товарителница">
          <p className="text-sm">
            Пратка:{' '}
            <span className="font-mono">{order.trackingNumber ?? '—'}</span>
          </p>
          <TrackingForm
            orderId={order.id}
            trackingNumber={order.trackingNumber}
          />
        </Section>
      )}

      <OrderCards
        orderId={order.id}
        cards={cards}
        batches={batches}
        quota={order.quota}
        editable={order.cardsEditable}
      />
    </main>
  );
}
