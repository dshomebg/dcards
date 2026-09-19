import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/modules/auth';
import { env } from '@/modules/core';

import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Вход',
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  // Вече влезлият няма работа тук — иначе формата изглежда счупена.
  const user = await getCurrentUser();
  if (user !== null) {
    redirect('/app');
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <header className="mb-8 flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-brand">{env().APP_NAME}</h1>
          <p className="text-text-muted text-sm">Влез, за да продължиш.</p>
        </header>

        <LoginForm />

        <p className="text-text-muted mt-6 text-sm">
          Нямаш акаунт?{' '}
          <Link href="/register" className="text-brand underline">
            Регистрирай се
          </Link>
        </p>
      </div>
    </main>
  );
}
