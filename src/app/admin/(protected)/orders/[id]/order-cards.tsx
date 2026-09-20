// Картите на поръчката: таблица с „откачи" и формата „партида + брой".

import Link from 'next/link';

import { type Column, DataTable } from '@/components/list';
import type { BatchSummary, OrderCardDto } from '@/modules/platform';

import { CardStatusBadge } from '../../cards/status-badge';
import { AssignCardsForm } from '../assign-cards-form';
import { ReleaseCardForm } from '../release-card-form';
import { Section } from './order-sections';

type Props = Readonly<{
  orderId: string;
  cards: readonly OrderCardDto[];
  batches: readonly BatchSummary[];
  quota: number;
  /** Преди изпращане — после бутоните и формата просто ги няма. */
  editable: boolean;
}>;

function columns(
  orderId: string,
  editable: boolean,
): readonly Column<OrderCardDto>[] {
  return [
    {
      key: 'id',
      header: 'Карта',
      className: 'font-mono',
      cell: (card) => (
        <Link href={`/admin/cards?id=${card.id}`} className="font-medium">
          {card.id}
        </Link>
      ),
    },
    { key: 'batch', header: 'Партида', cell: (card) => card.batchName },
    {
      key: 'status',
      header: 'Статус',
      cell: (card) => <CardStatusBadge status={card.status} />,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Действия</span>,
      className: 'text-right whitespace-nowrap',
      cell: (card) =>
        editable && card.status === 'assigned' ? (
          <ReleaseCardForm orderId={orderId} cardId={card.id} />
        ) : null,
    },
  ];
}

export function OrderCards({
  orderId,
  cards,
  batches,
  quota,
  editable,
}: Props) {
  const remaining = Math.max(quota - cards.length, 0);
  const options = batches
    .filter((batch) => batch.available > 0)
    .map((batch) => ({
      id: batch.id,
      name: batch.name,
      available: batch.available,
    }));

  return (
    <Section title={`Карти · ${cards.length} от ${quota}`}>
      {cards.length === 0 ? (
        <p className="text-text-muted text-sm">Още няма присвоени карти.</p>
      ) : (
        <DataTable
          caption="Карти в поръчката"
          columns={columns(orderId, editable)}
          rows={cards}
          rowKey={(card) => card.id}
        />
      )}
      {editable && (
        <AssignCardsForm
          orderId={orderId}
          batches={options}
          remaining={remaining}
        />
      )}
    </Section>
  );
}
