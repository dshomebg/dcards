import { CreditCard } from 'lucide-react';
import type { Metadata } from 'next';

import { FilterBar, ListState, SearchFilter } from '@/components/list';
import { db } from '@/modules/core';
import {
  type AdminCardDto,
  cardIdSchema,
  findCardForAdmin,
} from '@/modules/platform';

import { requireAdmin } from '../current';
import { CardDetail, type CardDetailView } from './card-detail';

export const metadata: Metadata = { title: 'Карти' };

type Props = Readonly<{ searchParams: Promise<{ id?: string | string[] }> }>;

const dateFormat = new Intl.DateTimeFormat('bg-BG', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const formatDate = (value: Date | null): string | null =>
  value === null ? null : dateFormat.format(value);

function toView(card: AdminCardDto): CardDetailView {
  return {
    id: card.id,
    batchId: card.batchId,
    batchName: card.batchName,
    activationCode: card.activationCode,
    status: card.status,
    orgName: card.org?.name ?? null,
    profileName: card.profile?.name ?? null,
    profileSlug: card.profile?.slug ?? null,
    writtenAt: formatDate(card.writtenAt),
    activatedAt: formatDate(card.activatedAt),
  };
}

/** Празно → покана; невалидно id → „няма карта" без заявка; иначе точно търсене. */
async function lookup(raw: string | string[] | undefined) {
  if (raw === undefined || raw === '') return { kind: 'empty' } as const;
  const parsed = cardIdSchema.safeParse(raw);
  if (!parsed.success) return { kind: 'missing' } as const;
  const card = await findCardForAdmin(db, parsed.data);
  return card === null
    ? ({ kind: 'missing' } as const)
    : ({ kind: 'found', card: toView(card) } as const);
}

export default async function CardsPage(props: Props) {
  await requireAdmin();
  const { id } = await props.searchParams;
  const result = await lookup(id);

  return (
    <main className="flex flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Карти</h1>

      <FilterBar>
        <SearchFilter
          paramKey="id"
          label="Id на картата"
          placeholder="ABCD2345"
        />
      </FilterBar>

      {result.kind === 'empty' && (
        <ListState
          icon={CreditCard}
          title="Въведи id на карта"
          hint="Точно търсене — id-то е отпечатано върху картата и в CSV-то на партидата."
        />
      )}
      {result.kind === 'missing' && (
        <ListState icon={CreditCard} title="Няма карта с това id" />
      )}
      {result.kind === 'found' && <CardDetail card={result.card} />}
    </main>
  );
}
