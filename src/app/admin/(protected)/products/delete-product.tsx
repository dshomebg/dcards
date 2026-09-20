'use client';

import { useState } from 'react';

import { FormSection } from '@/components/form';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';

import { deleteProductAction } from './actions';

interface Props {
  readonly productId: string;
}

export function DeleteProduct({ productId }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // При успех action-ът пренасочва сам; тук стига само отказът.
  async function confirm(): Promise<void> {
    setPending(true);
    setError(null);
    const result = await deleteProductAction(productId);
    setError(result.message);
    setPending(false);
  }

  return (
    <FormSection
      title="Опасна зона"
      description="Изтриването маха продукта и вариантите му. Не може да се върне."
    >
      <div>
        <Button variant="danger" onClick={() => setOpen(true)}>
          Изтрий продукта
        </Button>
      </div>

      <ConfirmDialog
        open={open}
        title="Да изтрия ли продукта?"
        description="Продуктът и вариантите му изчезват от витрината и от списъка."
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
