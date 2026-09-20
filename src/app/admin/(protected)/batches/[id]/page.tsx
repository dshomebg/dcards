import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';

import { type Column, DataTable } from '@/components/list';
import { buttonStyles } from '@/components/ui/button';
import { db } from '@/modules/core';
import { type BatchCardDto, getBatch } from '@/modules/platform';

import { CardStatusBadge } from '../../cards/status-badge';
import { requireAdmin } from '../../current';
import { MarkWrittenForm } from '../mark-written-form';

export const metadata: Metadata = { title: 'Партида' };

type Props = Readonly<{ params: Promise<{ id: string }> }>;

const dateFormat = new Intl.DateTimeFormat('bg-BG', { dateStyle: 'medium' });

const COLUMNS: readonly Column<BatchCardDto>[] = [
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
  {
    key: 'code',
    header: 'Код',
    className: 'font-mono',
    cell: (card) => card.activationCode,
  },
  {
    key: 'status',
    header: 'Статус',
    cell: (card) => <CardStatusBadge status={card.status} />,
  },
  {
    key: 'org',
    header: 'Организация',
    cell: (card) => card.orgName ?? '—',
  },
  {
    key: 'profile',
    header: 'Профил',
    cell: (card) => card.profileName ?? '—',
  },
];

// Сесията първо (без нея е login, не 404); после не-UUID → 404 без заявка.
export default async function BatchPage(props: Props) {
  await requireAdmin();
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();

  const batch = await getBatch(db, id);
  if (batch === null) notFound();
  const written = batch.cards.filter((card) => card.status !== 'blank').length;
  const active = batch.cards.filter((card) => card.status === 'active').length;

  return (
    <main className="flex flex-col gap-6 px-6 py-10">
      <div>
        <Link
          href="/admin/batches"
          className="text-text-muted text-sm underline"
        >
          Партиди
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{batch.name}</h1>
        <p className="text-text-muted mt-1 text-sm">
          {batch.quantity} карти · записани {written} · активни {active} ·
          създадена {dateFormat.format(batch.createdAt)}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <a
            href={`/admin/api/batches/${batch.id}/export`}
            download={`cards-${batch.id}.csv`}
            className={buttonStyles('secondary', 'text-sm')}
          >
            CSV
          </a>
          <MarkWrittenForm
            batchId={batch.id}
            disabled={written === batch.quantity}
          />
        </div>
      </div>

      <DataTable
        caption={`Карти в партида ${batch.name}`}
        columns={COLUMNS}
        rows={batch.cards}
        rowKey={(card) => card.id}
      />
    </main>
  );
}
