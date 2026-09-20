import type { Metadata } from 'next';

import { FormSection } from '@/components/form';
import { Badge } from '@/components/ui/badge';
import { getCurrentPublicUser } from '@/modules/auth';

import { requireCurrent } from '../current';
import { ChangePasswordForm } from './change-password-form';
import { ResendVerificationButton } from './resend-verification-button';

export const metadata: Metadata = { title: 'Настройки' };

const dateFormat = new Intl.DateTimeFormat('bg-BG', { dateStyle: 'long' });

function EmailStatus({ verifiedAt }: Readonly<{ verifiedAt: Date | null }>) {
  if (verifiedAt !== null) {
    return (
      <Badge tone="success">Потвърден на {dateFormat.format(verifiedAt)}</Badge>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <Badge tone="warning" className="self-start">
        Непотвърден
      </Badge>
      <ResendVerificationButton />
    </div>
  );
}

export default async function SettingsPage() {
  const { user } = await requireCurrent();
  // Сесията не носи `emailVerifiedAt` (AUTH-7) — редът се чете отделно.
  const account = await getCurrentPublicUser();

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
            <div>
              <dt className="text-text-muted">Потвърждение на имейла</dt>
              <dd className="mt-1">
                <EmailStatus verifiedAt={account?.emailVerifiedAt ?? null} />
              </dd>
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
