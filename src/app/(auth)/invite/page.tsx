// Линкът от писмото с покана. GET само показва — членството се записва от
// action-а „Приеми" (ORG-1). Токенът е капабилност; имейлът трябва да съвпада.

import { DrizzleQueryError } from 'drizzle-orm';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { buttonStyles } from '@/components/ui/button';
import { getCurrentUser, type SessionUser } from '@/modules/auth';
import { db } from '@/modules/core';
import {
  inspectInvitation,
  type InvitationView,
  isOrgMember,
} from '@/modules/platform';

import { AcceptButton } from './accept-button';
import { inviteRouteLimited } from './rate-limit';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Покана',
  robots: { index: false, follow: false },
};

type Props = Readonly<{
  searchParams: Promise<{ token?: string | string[] }>;
}>;

function Screen({
  title,
  children,
}: Readonly<{ title: string; children?: ReactNode }>) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-xl font-semibold">{title}</h1>
        {children}
      </div>
    </main>
  );
}

async function inspect(token: unknown): Promise<InvitationView | null> {
  try {
    return await inspectInvitation(db, token);
  } catch (error) {
    // Drizzle носи параметрите в `message` — само `cause` (DAT-6); токенът не се логва.
    console.error(
      'invite:',
      error instanceof DrizzleQueryError ? error.cause : error,
    );
    return null;
  }
}

/** Един екран за невалидна, изтекла и отменена — линкът не издава коя от трите. */
function InvalidScreen() {
  return (
    <Screen title="Поканата е невалидна или изтекла">
      <p className="text-text-muted text-sm">
        Помоли собственика на организацията да ти прати нова покана.
      </p>
      <Link href="/app" className={buttonStyles('secondary')}>
        Към акаунта
      </Link>
    </Screen>
  );
}

function SignedOutScreen({
  invitation,
  token,
}: Readonly<{ invitation: InvitationView; token: string }>) {
  const next = encodeURIComponent(`/invite?token=${token}`);
  return (
    <Screen title={`Покана за „${invitation.orgName}"`}>
      <p className="text-text-muted text-sm">
        Влез или се регистрирай с имейла, на който дойде поканата, и ще се
        върнеш тук, за да я приемеш.
      </p>
      <Link href={`/login?next=${next}`} className={buttonStyles()}>
        Вход
      </Link>
      <Link
        href={`/register?next=${next}`}
        className={buttonStyles('secondary')}
      >
        Регистрация
      </Link>
    </Screen>
  );
}

async function SignedInScreen({
  invitation,
  token,
  user,
}: Readonly<{ invitation: InvitationView; token: string; user: SessionUser }>) {
  // Без да показва за кой адрес е — препратен линк не бива да го издава.
  if (invitation.email !== user.email.toLowerCase()) {
    return (
      <Screen title="Поканата е за друг адрес">
        <p className="text-text-muted text-sm">
          Влез с акаунта, на чийто имейл дойде поканата.
        </p>
        <Link href="/app" className={buttonStyles('secondary')}>
          Към акаунта
        </Link>
      </Screen>
    );
  }
  if (await isOrgMember(db, invitation.orgId, user.id)) {
    return (
      <Screen title="Вече си член">
        <p className="text-text-muted text-sm">
          Организацията „{invitation.orgName}" вече е в акаунта ти.
        </p>
        <Link href="/app" className={buttonStyles()}>
          Към акаунта
        </Link>
      </Screen>
    );
  }
  return (
    <Screen title={`Покана за „${invitation.orgName}"`}>
      <p className="text-text-muted text-sm">
        Ще влезеш като редактор: виждаш и редактираш профилите и картите на
        организацията.
      </p>
      <AcceptButton token={token} />
    </Screen>
  );
}

export default async function InvitePage(props: Props) {
  // Лимитът е ПРЕДИ базата — отказаният опит не струва нищо.
  if (await inviteRouteLimited(await headers())) {
    return (
      <Screen title="Твърде много заявки">
        <p className="text-text-muted text-sm">Опитай пак след минута.</p>
      </Screen>
    );
  }

  const { token } = await props.searchParams;
  const invitation = await inspect(token);
  if (invitation === null || typeof token !== 'string') {
    return <InvalidScreen />;
  }

  const user = await getCurrentUser();
  if (user === null) {
    return <SignedOutScreen invitation={invitation} token={token} />;
  }
  return <SignedInScreen invitation={invitation} token={token} user={user} />;
}
