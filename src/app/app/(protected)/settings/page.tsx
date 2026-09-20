import type { Metadata } from 'next';

import { FormSection } from '@/components/form';

import { requireCurrent } from '../current';
import { ChangePasswordForm } from './change-password-form';

export const metadata: Metadata = { title: 'Настройки' };

export default async function SettingsPage() {
  const { user } = await requireCurrent();

  return (
    <main className="flex flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Настройки</h1>

      <div className="flex max-w-sm flex-col gap-6">
        <FormSection title="Акаунт">
          <dl className="flex flex-col gap-2 text-sm">
            <div>
              <dt className="text-text-muted">Имейл</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Име</dt>
              <dd>{user.name}</dd>
            </div>
          </dl>
        </FormSection>

        <FormSection title="Смяна на парола">
          <ChangePasswordForm />
        </FormSection>
      </div>
    </main>
  );
}
