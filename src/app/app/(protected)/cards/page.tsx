import { CreditCard } from 'lucide-react';
import type { Metadata } from 'next';

import { type Column, DataTable, ListState } from '@/components/list';
import { db } from '@/modules/core';
import {
  listCardsByOrg,
  listProfiles,
  type OrgCardDto,
} from '@/modules/platform';

import { requireCurrent } from '../current';
import { CardRow, type ProfileOption } from './card-row';
import { ClaimCardForm } from './claim-card-form';
import { CardStatusBadge } from './status-badge';

export const metadata: Metadata = { title: 'Карти' };

const dateFormat = new Intl.DateTimeFormat('bg-BG', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function columns(profiles: readonly ProfileOption[]): Column<OrgCardDto>[] {
  return [
    {
      key: 'id',
      header: 'Карта',
      className: 'font-mono',
      cell: (card) => card.id,
    },
    {
      key: 'status',
      header: 'Статус',
      cell: (card) => <CardStatusBadge status={card.status} />,
    },
    {
      key: 'profile',
      header: 'Профил',
      cell: (card) =>
        card.profile === null ? (
          '—'
        ) : (
          <>
            {card.profile.name}{' '}
            <span className="text-text-muted">/{card.profile.slug}</span>
          </>
        ),
    },
    {
      key: 'activatedAt',
      header: 'Активирана',
      className: 'whitespace-nowrap',
      cell: (card) =>
        card.activatedAt === null ? '—' : dateFormat.format(card.activatedAt),
    },
    {
      key: 'actions',
      header: 'Действия',
      cell: (card) => (
        <CardRow
          card={{
            id: card.id,
            status: card.status,
            profileId: card.profile?.id ?? null,
          }}
          profiles={profiles}
        />
      ),
    },
  ];
}

export default async function CardsPage() {
  const { org } = await requireCurrent();
  const [cards, profileRows] = await Promise.all([
    listCardsByOrg(db, org.id),
    listProfiles(db, org.id),
  ]);
  const profiles: ProfileOption[] = profileRows.map((profile) => ({
    id: profile.id,
    name: `${profile.firstName} ${profile.lastName}`,
  }));

  return (
    <main className="flex flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Карти</h1>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Добави карта</h2>
        <p className="text-text-muted text-sm">
          Id-то и кодът са отпечатани на картата. Допряна до телефона, картата
          се активира и без код.
        </p>
        <ClaimCardForm />
      </section>

      {cards.length === 0 ? (
        <ListState
          icon={CreditCard}
          title="Още нямаш карти"
          hint="Добави карта с кода ѝ или я допри до телефона си."
        />
      ) : (
        <DataTable
          caption="Картите на организацията"
          columns={columns(profiles)}
          rows={cards}
          rowKey={(card) => card.id}
        />
      )}
    </main>
  );
}
