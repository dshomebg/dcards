'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { markBatchWrittenAction } from './actions';

type Props = Readonly<{
  batchId: string;
  /** Всички вече са записани — бутонът няма какво да направи. */
  disabled: boolean;
}>;

/** Форма с един бутон в ред от таблицата; резултатът се показва до него. */
export function MarkWrittenForm({ batchId, disabled }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(): Promise<void> {
    setPending(true);
    setMessage(null);
    const result = await markBatchWrittenAction(batchId);
    setMessage(result.ok ? `Маркирани: ${result.written}` : result.message);
    setPending(false);
    if (result.ok) router.refresh();
  }

  return (
    <form
      className="inline-flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Button
        type="submit"
        variant="ghost"
        disabled={disabled || pending}
        className="text-sm"
      >
        Маркирай записаните
      </Button>
      {message !== null && (
        <span role="status" className="text-text-muted text-xs">
          {message}
        </span>
      )}
    </form>
  );
}
