'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';

import { removeMemberAction } from './actions';

type Props = Readonly<{ userId: string; name: string }>;

/** „Премахни" с потвърждение — рисува се само за не-owner и само на owner. */
export function RemoveMemberButton({ userId, name }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove(): Promise<void> {
    setPending(true);
    setError(null);
    const result = await removeMemberAction(userId);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button
        variant="ghost"
        className="text-danger"
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        Премахни
      </Button>
      <ConfirmDialog
        open={open}
        title={`Да премахна ли ${name}?`}
        description="Човекът губи достъпа до профилите и картите на организацията. Може да бъде поканен отново."
        confirmLabel="Премахни"
        pending={pending}
        error={error}
        onConfirm={() => void remove()}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
      />
    </>
  );
}
