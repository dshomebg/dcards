import type { Metadata } from 'next';
import Link from 'next/link';

import { requireAdmin } from '../../current';
import { NewBatchForm } from './new-batch-form';

export const metadata: Metadata = { title: 'Нова партида' };

export default async function NewBatchPage() {
  await requireAdmin();

  return (
    <main className="flex flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Нова партида</h1>
        <p className="text-text-muted mt-1 text-sm">
          Картите получават id и код за активация веднага; CSV-то се сваля от
          списъка.
        </p>
      </div>

      <div className="max-w-sm">
        <NewBatchForm />
      </div>

      <Link href="/admin/batches" className="text-text-muted text-sm underline">
        Назад към партидите
      </Link>
    </main>
  );
}
