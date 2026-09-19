import type { Metadata } from 'next';
import Link from 'next/link';

import { requireCurrent } from '../../current';
import { NewProfileForm } from './new-profile-form';

export const metadata: Metadata = { title: 'Нов профил' };

export default async function NewProfilePage() {
  await requireCurrent();

  return (
    <main className="flex flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Нов профил</h1>
        <p className="text-text-muted mt-1 text-sm">
          Име и адрес — останалото се допълва след това.
        </p>
      </div>

      <div className="max-w-sm">
        <NewProfileForm />
      </div>

      <Link href="/app" className="text-text-muted text-sm underline">
        Назад към профилите
      </Link>
    </main>
  );
}
