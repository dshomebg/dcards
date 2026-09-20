'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { releaseCardAction } from './actions';

type Props = Readonly<{ orderId: string; cardId: string }>;

/** „Откачи" в ред от таблицата с картите — само за `assigned` преди изпращане. */
export function ReleaseCardForm({ orderId, cardId }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(): Promise<void> {
    setPending(true);
    setMessage(null);
    const result = await releaseCardAction(orderId, cardId);
    setPending(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        variant="ghost"
        disabled={pending}
        className="text-sm"
        onClick={() => void submit()}
      >
        Откачи
      </Button>
      {message !== null && (
        <span role="status" className="text-danger text-xs">
          {message}
        </span>
      )}
    </span>
  );
}
