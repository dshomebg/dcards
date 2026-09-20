'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';

import { acceptInvitationAction } from './actions';

/** „Приеми" — action-ът сам пренасочва при успех; тук стига само отказът. */
export function AcceptButton({ token }: Readonly<{ token: string }>) {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <Button
        disabled={busy}
        onClick={() => {
          startTransition(async () => {
            const result = await acceptInvitationAction(token);
            setError(result.message);
          });
        }}
      >
        {busy ? 'Приемане…' : 'Приеми поканата'}
      </Button>
      {error !== null && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
