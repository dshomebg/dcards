// Маршрутизаторът на чипа: `/c/{id}`, публичен, без auth. Активна карта →
// 307 към профила и ред в `scans`; записана → екран за активация.

import { DrizzleQueryError } from 'drizzle-orm';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { loadCurrent } from '@/app/app/(protected)/current';
import { buttonStyles } from '@/components/ui/button';
import { db } from '@/modules/core';
import {
  cardIdSchema,
  classifyDevice,
  findCardForRoute,
  insertScan,
  listProfiles,
  resolveCard,
} from '@/modules/platform';

import { ActivateForm } from './activate-form';
import { cardRouteLimited, scanRecordLimited } from './rate-limit';

export const dynamic = 'force-dynamic';

// Всички изходи освен redirect-а са служебни екрани — не са за индексиране.
export const metadata: Metadata = {
  title: 'Карта',
  robots: { index: false, follow: false },
};

type Props = Readonly<{ params: Promise<{ id: string }> }>;

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

function logScanFailure(error: unknown): void {
  // Само код и constraint — pg `detail` носи целия ред (DAT-6).
  const cause =
    error instanceof DrizzleQueryError
      ? (error.cause as { code?: string; constraint?: string } | undefined)
      : undefined;
  console.error('/c: scan insert failed', cause?.code, cause?.constraint);
}

async function ActivateScreen({
  cardId,
  orgId,
}: Readonly<{ cardId: string; orgId: string | null }>) {
  const current = await loadCurrent();
  if (current === null) {
    const next = `/c/${cardId}`;
    return (
      <Screen title="Активирай картата">
        <p className="text-text-muted text-sm">
          Влез или се регистрирай — картата ще те чака тук.
        </p>
        <div className="flex gap-3">
          <Link href={`/login?next=${next}`} className={buttonStyles()}>
            Вход
          </Link>
          <Link
            href={`/register?next=${next}`}
            className={buttonStyles('secondary')}
          >
            Регистрация
          </Link>
        </div>
      </Screen>
    );
  }

  // Картата вече е на друга org (claim с код) — формата би отказала; казва се направо.
  if (orgId !== null && orgId !== current.org.id) {
    return (
      <Screen title="Картата принадлежи на друга организация">
        <p className="text-text-muted text-sm">
          Тази карта е добавена в друг акаунт и не може да се активира оттук.
        </p>
      </Screen>
    );
  }

  const profiles = (await listProfiles(db, current.org.id)).map((p) => ({
    id: p.id,
    name: `${p.firstName} ${p.lastName}`,
  }));
  return (
    <Screen title="Активирай картата">
      <p className="text-text-muted text-sm">
        Избери кой профил да отваря картата{' '}
        <span className="font-mono">{cardId}</span>.
      </p>
      <ActivateForm cardId={cardId} profiles={profiles} />
    </Screen>
  );
}

export default async function CardPage(props: Props) {
  // Лимитът е ПРЕДИ всякаква заявка — отказаният опит не струва нищо.
  const requestHeaders = await headers();
  if (await cardRouteLimited(requestHeaders)) {
    return (
      <Screen title="Твърде много заявки">
        <p className="text-text-muted text-sm">Опитай пак след минута.</p>
      </Screen>
    );
  }

  const { id } = await props.params;
  const parsed = cardIdSchema.safeParse(id);
  if (!parsed.success) notFound();

  const route = resolveCard(await findCardForRoute(db, parsed.data));
  if (route.kind === 'not_found') notFound();

  if (route.kind === 'redirect') {
    try {
      if (!(await scanRecordLimited(route.cardId))) {
        await insertScan(db, {
          cardId: route.cardId,
          profileId: route.profileId,
          source: 'nfc',
          device: classifyDevice(requestHeaders.get('user-agent')),
          country: null,
        });
      }
    } catch (error) {
      logScanFailure(error);
    }
    // `redirect` хвърля — стои извън `try`. 307: профилът се сменя от dashboard-а.
    redirect(`/${route.slug}`);
  }

  if (route.kind === 'inactive') {
    return (
      <Screen title="Картата не е активна">
        <p className="text-text-muted text-sm">
          Тази карта е извадена от обращение.
        </p>
      </Screen>
    );
  }

  if (route.kind === 'unlinked') {
    return (
      <Screen title="Картата не е свързана с профил">
        <p className="text-text-muted text-sm">
          Собственикът може да я свърже от своя акаунт.
        </p>
        <Link href="/app/cards" className="text-brand text-sm underline">
          Към картите
        </Link>
      </Screen>
    );
  }

  return <ActivateScreen cardId={route.cardId} orgId={route.orgId} />;
}
