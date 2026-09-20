import type { Metadata } from 'next';

import { FormSection } from '@/components/form';
import { Badge } from '@/components/ui/badge';
import { db } from '@/modules/core';
import {
  can,
  effectivePlan,
  listMembers,
  listPendingInvitations,
  type OrgMemberRow,
  type PendingInvitationRow,
  PLAN_LABELS,
} from '@/modules/platform';

import { type Current, requireCurrent } from '../current';
import { InvitationActions } from './invitation-actions';
import { InviteForm } from './invite-form';
import { RemoveMemberButton } from './member-actions';
import { OrgNameForm } from './org-name-form';

export const metadata: Metadata = { title: 'Организация' };

const ROLE_LABELS: Record<OrgMemberRow['role'], string> = {
  owner: 'Собственик',
  editor: 'Редактор',
};

const dateFormat = new Intl.DateTimeFormat('bg-BG', { dateStyle: 'medium' });

function MemberList({
  members,
  isOwner,
}: Readonly<{ members: readonly OrgMemberRow[]; isOwner: boolean }>) {
  return (
    <ul className="flex flex-col divide-y divide-border">
      {members.map((member) => (
        <li
          key={member.userId}
          className="flex flex-wrap items-center justify-between gap-2 py-3"
        >
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{member.name}</span>
            <span className="text-text-muted truncate text-sm">
              {member.email}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={member.role === 'owner' ? 'brand' : 'neutral'}>
              {ROLE_LABELS[member.role]}
            </Badge>
            {isOwner && member.role !== 'owner' && (
              <RemoveMemberButton userId={member.userId} name={member.name} />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function PendingList({
  invitations,
}: Readonly<{ invitations: readonly PendingInvitationRow[] }>) {
  if (invitations.length === 0) {
    return <p className="text-text-muted text-sm">Няма чакащи покани.</p>;
  }
  const now = new Date();
  return (
    <ul className="flex flex-col divide-y divide-border">
      {invitations.map((invitation) => (
        <li
          key={invitation.id}
          className="flex flex-wrap items-center justify-between gap-2 py-3"
        >
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{invitation.email}</span>
            <span className="text-text-muted text-sm">
              {invitation.expiresAt <= now
                ? 'Изтекла'
                : `Валидна до ${dateFormat.format(invitation.expiresAt)}`}
            </span>
          </div>
          <InvitationActions invitationId={invitation.id} />
        </li>
      ))}
    </ul>
  );
}

/** Само за owner: чакащите и формата за покана. Лимитът се решава на сървъра. */
async function OwnerSections({
  org,
  memberCount,
}: Readonly<{ org: Current['org']; memberCount: number }>) {
  const invitations = await listPendingInvitations(db, org.id);
  return (
    <>
      <FormSection title="Чакащи покани">
        <PendingList invitations={invitations} />
      </FormSection>
      <FormSection
        title="Покани член"
        description="Поканата важи 7 дни и се праща на имейла."
      >
        <InviteForm
          proOnly={!can(org, 'members', memberCount + invitations.length)}
        />
      </FormSection>
    </>
  );
}

export default async function OrgPage() {
  const { org, role } = await requireCurrent();
  const isOwner = role === 'owner';
  const members = await listMembers(db, org.id);

  return (
    <main className="flex flex-col gap-6 px-4 py-8">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Организация</h1>
        <Badge tone={effectivePlan(org) === 'pro' ? 'brand' : 'neutral'}>
          {PLAN_LABELS[effectivePlan(org)]}
        </Badge>
      </div>

      <div className="flex max-w-lg flex-col gap-6">
        <FormSection title="Име">
          {isOwner ? (
            <OrgNameForm name={org.name} />
          ) : (
            <p className="text-sm">{org.name}</p>
          )}
        </FormSection>

        <FormSection title="Членове">
          <MemberList members={members} isOwner={isOwner} />
        </FormSection>

        {isOwner && <OwnerSections org={org} memberCount={members.length} />}
      </div>
    </main>
  );
}
