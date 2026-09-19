import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getCurrentAdmin } from '@/modules/auth';
import { env } from '@/modules/core';

import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Вход' };

export default async function LoginPage() {
  // Вече влезлият няма работа тук — иначе формата изглежда счупена, а всъщност
  // всичко е наред.
  const admin = await getCurrentAdmin();
  if (admin !== null) {
    redirect('/admin');
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <header className="mb-8 flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-brand">
            {env().APP_NAME} Админ
          </h1>
          <p className="text-text-muted text-sm">Влез, за да продължиш.</p>
        </header>

        <LoginForm />
      </div>
    </main>
  );
}
