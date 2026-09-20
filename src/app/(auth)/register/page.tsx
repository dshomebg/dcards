import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getCurrentUser, safeNextPath } from '@/modules/auth';
import { env } from '@/modules/core';

import { RegisterForm } from './register-form';

export const metadata: Metadata = {
  title: 'Регистрация',
  robots: { index: false, follow: false },
};

type Props = Readonly<{ searchParams: Promise<{ next?: string | string[] }> }>;

export default async function RegisterPage(props: Props) {
  const { next: rawNext } = await props.searchParams;
  const next = typeof rawNext === 'string' ? rawNext : null;

  const user = await getCurrentUser();
  if (user !== null) {
    redirect(safeNextPath(next) ?? '/app');
  }
  const loginHref =
    safeNextPath(next) === null ? '/login' : `/login?next=${next}`;

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <header className="mb-8 flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-brand">{env().APP_NAME}</h1>
          <p className="text-text-muted text-sm">
            Създай акаунт, за да направиш профила си.
          </p>
        </header>

        <RegisterForm next={next} />

        <p className="text-text-muted mt-6 text-sm">
          Имаш акаунт?{' '}
          <Link href={loginHref} className="text-brand underline">
            Влез
          </Link>
        </p>
      </div>
    </main>
  );
}
