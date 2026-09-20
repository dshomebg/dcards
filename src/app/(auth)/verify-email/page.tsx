// Линкът от писмото: GET, който потвърждава имейла. Не изисква вход и не
// пренасочва влезлия — токенът е капабилност сам по себе си (AUTH-12).

import { DrizzleQueryError } from 'drizzle-orm';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { buttonStyles } from '@/components/ui/button';
import {
  getCurrentPublicUser,
  verifyEmailByToken,
  type VerifyEmailResult,
} from '@/modules/auth';
import { db } from '@/modules/core';

import { verifyRouteLimited } from './rate-limit';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Потвърждение на имейл',
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

async function verify(token: unknown): Promise<VerifyEmailResult> {
  try {
    return await verifyEmailByToken(db, token);
  } catch (error) {
    // Drizzle носи параметрите в `message` — само `cause` (DAT-6); токенът не се логва.
    console.error(
      'verify-email:',
      error instanceof DrizzleQueryError ? error.cause : error,
    );
    return 'invalid';
  }
}

async function InvalidScreen() {
  const user = await getCurrentPublicUser();
  const signedIn = user !== null;
  // Mail-скенер вече е „кликнал" линка: за влезлия потвърден това не е грешка.
  if (user?.emailVerifiedAt) {
    return (
      <Screen title="Имейлът е потвърден">
        <p className="text-text-muted text-sm">
          Този имейл вече беше потвърден.
        </p>
        <Link href="/app" className={buttonStyles()}>
          Към акаунта
        </Link>
      </Screen>
    );
  }
  return (
    <Screen title="Линкът е невалиден или изтекъл">
      <p className="text-text-muted text-sm">
        {signedIn
          ? 'Можеш да поискаш нов от настройките на акаунта.'
          : 'Влез в акаунта си и поискай нов линк от настройките.'}
      </p>
      <Link
        href={signedIn ? '/app/settings' : '/login'}
        className={buttonStyles('secondary')}
      >
        {signedIn ? 'Към настройките' : 'Вход'}
      </Link>
    </Screen>
  );
}

export default async function VerifyEmailPage(props: Props) {
  // Лимитът е ПРЕДИ Redis и базата — отказаният опит не струва нищо.
  if (await verifyRouteLimited(await headers())) {
    return (
      <Screen title="Твърде много заявки">
        <p className="text-text-muted text-sm">Опитай пак след минута.</p>
      </Screen>
    );
  }

  const { token } = await props.searchParams;
  const result = await verify(token);
  if (result === 'invalid') return <InvalidScreen />;

  return (
    <Screen title="Имейлът е потвърден">
      <p className="text-text-muted text-sm">
        {result === 'already'
          ? 'Този имейл вече беше потвърден.'
          : 'Благодарим — акаунтът ти е готов.'}
      </p>
      <Link href="/app" className={buttonStyles()}>
        Към акаунта
      </Link>
    </Screen>
  );
}
