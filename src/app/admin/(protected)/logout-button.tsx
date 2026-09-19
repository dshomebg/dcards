'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { signOut } from '@/modules/auth';

/** „Изход" — action-ът трие сесията и сам пренасочва; тук стига само отказът. */
export function LogoutButton() {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="flex items-center gap-2">
      {error !== null && (
        <span role="alert" className="text-sm text-danger">
          {error}
        </span>
      )}
      <Button
        variant="secondary"
        disabled={busy}
        onClick={() => {
          startTransition(async () => {
            const result = await signOut();
            setError(result.message);
          });
        }}
      >
        {busy ? 'Излизане…' : 'Изход'}
      </Button>
    </span>
  );
}
