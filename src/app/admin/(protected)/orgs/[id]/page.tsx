import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';

import { type Column, DataTable } from '@/components/list';
import { Badge } from '@/components/ui/badge';
import { db } from '@/modules/core';
import {
  type AdminOrgMemberRow,
  findProfilesByOrg,
  getOrganizationForAdmin,
  localDay,
} from '@/modules/platform';

import { requireAdmin } from '../../current';
import { PlanBadge } from '../plan-badge';
import { PlanForm } from '../plan-form';

export const metadata: Metadata = { title: 'Организация' };

type Props = Readonly<{ params: Promise<{ id: string }> }>;

const dateFormat = new Intl.DateTimeFormat('bg-BG', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const ROLE_LABELS: Readonly<Record<AdminOrgMemberRow['role'], string>> = {
  owner: 'собственик',
  editor: 'редактор',
};

const TYPE_LABELS = { personal: 'лична', company: 'фирма' } as const;

const MEMBER_COLUMNS: readonly Column<AdminOrgMemberRow>[] = [
  { key: 'email', header: 'Имейл', cell: (member) => member.email },
  { key: 'name', header: 'Име', cell: (member) => member.name },
  { key: 'role', header: 'Роля', cell: (member) => ROLE_LABELS[member.role] },
];

type ProfileRow = Awaited<ReturnType<typeof findProfilesByOrg>>[number];

const PROFILE_COLUMNS: readonly Column<ProfileRow>[] = [
  {
    key: 'name',
    header: 'Профил',
    cell: (profile) => (
      <Link href={`/${profile.slug}`} className="font-medium">
        {profile.firstName} {profile.lastName}
      </Link>
    ),
  },
  {
    key: 'slug',
    header: 'Адрес',
    className: 'font-mono',
    cell: (profile) => `/${profile.slug}`,
  },
  {
    key: 'visible',
    header: 'Видимост',
    cell: (profile) =>
      profile.isPublic ? (
        <Badge tone="success">публичен</Badge>
      ) : (
        <Badge tone="warning">скрит</Badge>
      ),
  },
];

// Сесията първо (без нея е login, не 404); после не-UUID → 404 без заявка.
export default async function OrgPage(props: Props) {
  await requireAdmin();
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();

  const org = await getOrganizationForAdmin(db, id);
  if (org === null) notFound();
  const profiles = await findProfilesByOrg(db, id);
  // В полето стои избраният ДЕН; записано е 00:00 на следващия, затова една
  // секунда назад.
  const expiresOn =
    org.planExpiresAt === null
      ? ''
      : localDay(new Date(org.planExpiresAt.getTime() - 1000));

  return (
    <main className="flex flex-col gap-6 px-6 py-10">
      <div>
        <Link href="/admin/orgs" className="text-text-muted text-sm underline">
          Организации
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{org.name}</h1>
        <p className="text-text-muted mt-1 text-sm">
          {TYPE_LABELS[org.type]} · собственик {org.ownerName} ({org.ownerEmail}
          ) · създадена {dateFormat.format(org.createdAt)}
        </p>
        <p className="mt-2 flex items-center gap-2 text-sm">
          <PlanBadge plan={org.plan} planExpiresAt={org.planExpiresAt} />
          {org.planExpiresAt !== null && (
            <span className="text-text-muted">
              до {dateFormat.format(org.planExpiresAt)}
            </span>
          )}
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">План</h2>
        <PlanForm orgId={org.id} plan={org.plan} expiresOn={expiresOn} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Членове</h2>
        <DataTable
          caption="Членове"
          columns={MEMBER_COLUMNS}
          rows={org.members}
          rowKey={(member) => member.userId}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Профили</h2>
        {profiles.length === 0 ? (
          <p className="text-text-muted text-sm">Още няма профили.</p>
        ) : (
          <DataTable
            caption="Профили"
            columns={PROFILE_COLUMNS}
            rows={profiles}
            rowKey={(profile) => profile.id}
          />
        )}
      </section>
    </main>
  );
}
