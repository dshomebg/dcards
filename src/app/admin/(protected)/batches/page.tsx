import { Layers } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { type Column, DataTable, ListState } from '@/components/list';
import { buttonStyles } from '@/components/ui/button';
import { db } from '@/modules/core';
import { type BatchSummary, listBatches } from '@/modules/platform';

import { requireAdmin } from '../current';
import { MarkWrittenForm } from './mark-written-form';

export const metadata: Metadata = { title: 'Партиди' };

const dateFormat = new Intl.DateTimeFormat('bg-BG', { dateStyle: 'short' });

const COLUMNS: readonly Column<BatchSummary>[] = [
  {
    key: 'name',
    header: 'Име',
    cell: (batch) => (
      <Link href={`/admin/batches/${batch.id}`} className="font-medium">
        {batch.name}
      </Link>
    ),
  },
  { key: 'quantity', header: 'Брой', cell: (batch) => batch.quantity },
  {
    key: 'written',
    header: 'Записани',
    cell: (batch) => `${batch.written}/${batch.quantity}`,
  },
  { key: 'active', header: 'Активни', cell: (batch) => batch.active },
  {
    key: 'createdAt',
    header: 'Създадена',
    cell: (batch) => dateFormat.format(batch.createdAt),
  },
  {
    key: 'actions',
    header: <span className="sr-only">Действия</span>,
    className: 'text-right whitespace-nowrap',
    cell: (batch) => (
      <div className="inline-flex items-center gap-2">
        {/* `download` без `target`: отговорът е `attachment`, файлът се сваля. */}
        <a
          href={`/admin/api/batches/${batch.id}/export`}
          download={`cards-${batch.id}.csv`}
          className={buttonStyles('ghost', 'text-sm')}
        >
          CSV
        </a>
        <MarkWrittenForm
          batchId={batch.id}
          disabled={batch.written >= batch.quantity}
        />
      </div>
    ),
  },
];

export default async function BatchesPage() {
  await requireAdmin();
  const batches = await listBatches(db);

  return (
    <main className="flex flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Партиди</h1>
        <Link href="/admin/batches/new" className={buttonStyles()}>
          Нова партида
        </Link>
      </div>

      {batches.length === 0 ? (
        <ListState
          icon={Layers}
          title="Още няма партиди"
          hint="Партидата е набор карти с id и код за активация — CSV-то отива при писача на чипове."
          action={
            <Link href="/admin/batches/new" className={buttonStyles()}>
              Нова партида
            </Link>
          }
        />
      ) : (
        <DataTable
          caption="Партиди карти"
          columns={COLUMNS}
          rows={batches}
          rowKey={(batch) => batch.id}
        />
      )}
    </main>
  );
}
