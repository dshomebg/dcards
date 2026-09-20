'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import {
  cancelInvitationAction,
  type OrgActionResult,
  resendInvitationAction,
} from './actions';

type Props = Readonly<{ invitationId: string }>;

/** „Изпрати пак" и „Отмени" в реда на чакаща покана — само за owner. */
export function InvitationActions({ invitationId }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(
    action: () => Promise<OrgActionResult>,
    doneMessage: string | null,
  ): Promise<void> {
    setPending(true);
    setError(null);
    setNotice(null);
    const result = await action();
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice(doneMessage);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-hint">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            void run(
              () => resendInvitationAction(invitationId),
              'Изпратено отново.',
            )
          }
        >
          Изпрати пак
        </Button>
        <Button
          variant="ghost"
          className="text-danger"
          disabled={pending}
          onClick={() =>
            void run(() => cancelInvitationAction(invitationId), null)
          }
        >
          Отмени
        </Button>
      </div>
      {error !== null && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
      {notice !== null && (
        <p role="status" className="text-success-ink text-sm">
          {notice}
        </p>
      )}
    </div>
  );
}
