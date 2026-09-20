'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { resendVerificationAction } from './actions';

type Status = { kind: 'idle' } | { kind: 'error' | 'done'; message: string };

export function ResendVerificationButton() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [pending, setPending] = useState(false);

  async function resend() {
    setPending(true);
    setStatus({ kind: 'idle' });
    try {
      const result = await resendVerificationAction();
      setStatus(
        result.ok
          ? {
              kind: 'done',
              message: 'Писмото е изпратено — провери пощата си.',
            }
          : { kind: 'error', message: result.message },
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="secondary"
        onClick={() => void resend()}
        disabled={pending}
        className="self-start"
      >
        {pending ? 'Изпращане…' : 'Изпрати отново'}
      </Button>

      {status.kind === 'error' && (
        <p role="alert" className="text-danger text-sm">
          {status.message}
        </p>
      )}

      {status.kind === 'done' && (
        <p role="status" className="text-success-ink text-sm">
          {status.message}
        </p>
      )}
    </div>
  );
}
