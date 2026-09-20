import { Building2 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { z } from 'zod';

import {
  type Column,
  DataTable,
  FilterBar,
  ListState,
  SearchFilter,
  SelectFilter,
} from '@/components/list';
import { db } from '@/modules/core';
import {
  type AdminOrganizationRow,
  PLAN_LABELS,
  searchOrganizations,
} from '@/modules/platform';

import { requireAdmin } from '../current';
import { PlanBadge } from './plan-badge';
import { PLANS } from './schema';

export const metadata: Metadata = { title: 'Организации' };

type Props = Readonly<{
  searchParams: Promise<{ q?: string | string[]; plan?: string | string[] }>;
}>;

/** Без страници: при малък обем таванът е бележка, не пейджър. */
const LIMIT = 200;

const dateFormat = new Intl.DateTimeFormat('bg-BG', { dateStyle: 'short' });

const TYPE_LABELS: Readonly<Record<AdminOrganizationRow['type'], string>> = {
  personal: 'лична',
  company: 'фирма',
};

const PLAN_OPTIONS = PLANS.map((plan) => ({
  value: plan,
  label: PLAN_LABELS[plan],
}));

const COLUMNS: readonly Column<AdminOrganizationRow>[] = [
  {
    key: 'name',
    header: 'Име',
    cell: (org) => (
      <Link href={`/admin/orgs/${org.id}`} className="font-medium">
        {org.name}
      </Link>
    ),
  },
  { key: 'type', header: 'Тип', cell: (org) => TYPE_LABELS[org.type] },
  {
    key: 'plan',
    header: 'План',
    cell: (org) => (
      <PlanBadge plan={org.plan} planExpiresAt={org.planExpiresAt} />
    ),
  },
  { key: 'owner', header: 'Собственик', cell: (org) => org.ownerEmail },
  {
    key: 'profiles',
    header: 'Профили',
    className: 'text-right',
    cell: (org) => org.profileCount,
  },
  {
    key: 'createdAt',
    header: 'Създадена',
    className: 'whitespace-nowrap',
    cell: (org) => dateFormat.format(org.createdAt),
  },
];

/** Невалиден филтър → всички, без грешка. Повторен ключ → първата стойност. */
const planFilter = z.enum(PLANS).optional().catch(undefined);
const queryFilter = z.string().trim().max(200).catch('');

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function OrgsPage(props: Props) {
  await requireAdmin();
  const params = await props.searchParams;
  const plan = planFilter.parse(first(params.plan));
  const query = queryFilter.parse(first(params.q));
  const orgs = await searchOrganizations(db, { query, plan, limit: LIMIT });
  const filtered = plan !== undefined || query !== '';

  return (
    <main className="flex flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Организации</h1>

      <FilterBar>
        <SearchFilter
          paramKey="q"
          label="Име или имейл"
          placeholder="фирма или ivan@…"
        />
        <SelectFilter paramKey="plan" label="План" options={PLAN_OPTIONS} />
      </FilterBar>

      {orgs.length === 0 ? (
        <ListState
          icon={Building2}
          title={
            filtered
              ? 'Няма организации по този филтър'
              : 'Още няма организации'
          }
          hint="Всеки регистриран потребител получава лична организация."
        />
      ) : (
        <>
          <DataTable
            caption="Организации"
            columns={COLUMNS}
            rows={orgs}
            rowKey={(org) => org.id}
          />
          {orgs.length === LIMIT && (
            <p className="text-text-muted text-sm">
              Показани са първите {LIMIT} — стесни търсенето.
            </p>
          )}
        </>
      )}
    </main>
  );
}
