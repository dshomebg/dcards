import { Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { z } from 'zod';

import {
  type Column,
  DataTable,
  FilterBar,
  ListState,
  SearchFilter,
} from '@/components/list';
import { Badge } from '@/components/ui/badge';
import { type PublicUser, searchUsers } from '@/modules/auth';
import { db } from '@/modules/core';
import {
  listMembershipsForUsers,
  type UserMembershipRow,
} from '@/modules/platform';

import { requireAdmin } from '../current';

export const metadata: Metadata = { title: 'Потребители' };

type Props = Readonly<{ searchParams: Promise<{ q?: string | string[] }> }>;

/** Без страници: при малък обем таванът е бележка, не пейджър. */
const LIMIT = 200;

const dateFormat = new Intl.DateTimeFormat('bg-BG', { dateStyle: 'short' });

/** `auth` дава потребителя, `platform` — членствата; сглобяват се тук (ARC-2). */
interface UserRow extends PublicUser {
  readonly orgs: readonly UserMembershipRow[];
}

const COLUMNS: readonly Column<UserRow>[] = [
  { key: 'email', header: 'Имейл', cell: (user) => user.email },
  { key: 'name', header: 'Име', cell: (user) => user.name },
  {
    key: 'verified',
    header: 'Потвърден',
    cell: (user) =>
      user.emailVerifiedAt === null ? (
        <Badge tone="warning">не</Badge>
      ) : (
        <Badge tone="success">да</Badge>
      ),
  },
  {
    key: 'admin',
    header: 'Админ',
    cell: (user) => (user.isAdmin ? <Badge tone="brand">админ</Badge> : null),
  },
  {
    key: 'orgs',
    header: 'Организации',
    cell: (user) =>
      user.orgs.length === 0 ? (
        '—'
      ) : (
        <span className="flex flex-wrap gap-2">
          {user.orgs.map((membership) => (
            <Link
              key={membership.orgId}
              href={`/admin/orgs/${membership.orgId}`}
              className="underline"
            >
              {membership.orgName}
            </Link>
          ))}
        </span>
      ),
  },
  {
    key: 'createdAt',
    header: 'Създаден',
    className: 'whitespace-nowrap',
    cell: (user) => dateFormat.format(user.createdAt),
  },
];

const queryFilter = z.string().trim().max(200).catch('');

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

async function loadRows(query: string): Promise<UserRow[]> {
  const users = await searchUsers(db, { query, limit: LIMIT });
  const memberships = await listMembershipsForUsers(
    db,
    users.map((user) => user.id),
  );
  return users.map((user) => ({
    ...user,
    orgs: memberships.filter((membership) => membership.userId === user.id),
  }));
}

export default async function UsersPage(props: Props) {
  await requireAdmin();
  const params = await props.searchParams;
  const query = queryFilter.parse(first(params.q));
  const rows = await loadRows(query);

  return (
    <main className="flex flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Потребители</h1>

      <FilterBar>
        <SearchFilter
          paramKey="q"
          label="Имейл или име"
          placeholder="ivan@… или Иван"
        />
      </FilterBar>

      {rows.length === 0 ? (
        <ListState
          icon={Users}
          title={
            query === ''
              ? 'Още няма потребители'
              : 'Няма потребители по това търсене'
          }
        />
      ) : (
        <>
          <DataTable
            caption="Потребители"
            columns={COLUMNS}
            rows={rows}
            rowKey={(user) => user.id}
          />
          {rows.length === LIMIT && (
            <p className="text-text-muted text-sm">
              Показани са първите {LIMIT} — стесни търсенето.
            </p>
          )}
        </>
      )}
    </main>
  );
}
