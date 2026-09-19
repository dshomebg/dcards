'use client';

import { useState } from 'react';

import { FormSection } from '@/components/form';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';

import { deleteProfileAction } from './actions';

interface Props {
  readonly profileId: string;
}

export function DeleteProfile({ profileId }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // При успех action-ът пренасочва сам; тук стига само отказът.
  async function confirm(): Promise<void> {
    setPending(true);
    setError(null);
    const result = await deleteProfileAction(profileId);
    setError(result.message);
    setPending(false);
  }

  return (
    <FormSection
      title="Опасна зона"
      description="Изтриването маха профила, линковете му и публичната страница. Не може да се върне."
    >
      <div>
        <Button variant="danger" onClick={() => setOpen(true)}>
          Изтрий профила
        </Button>
      </div>

      <ConfirmDialog
        open={open}
        title="Да изтрия ли профила?"
        description="Публичната страница и QR кодовете към нея ще спрат да работят."
        confirmLabel="Изтрий"
        pending={pending}
        error={error}
        onConfirm={() => void confirm()}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
      />
    </FormSection>
  );
}
