'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';

import { assignCardsAction } from './actions';

export interface BatchOption {
  readonly id: string;
  readonly name: string;
  /** Свободни (`written`) карти в партидата. */
  readonly available: number;
}

type Props = Readonly<{
  orderId: string;
  batches: readonly BatchOption[];
  /** Колко още може да се присвоят — Σ quantity минус вече присвоените. */
  remaining: number;
}>;

/** „Партида X, брой N" — сервизът пази квотата и недостига, формата само подсказва. */
export function AssignCardsForm({ orderId, batches, remaining }: Props) {
  const router = useRouter();
  const [batchId, setBatchId] = useState(batches[0]?.id ?? '');
  const [quantity, setQuantity] = useState(String(Math.max(remaining, 1)));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(): Promise<void> {
    setPending(true);
    setMessage(null);
    const result = await assignCardsAction(orderId, batchId, Number(quantity));
    setPending(false);
    setMessage(result.ok ? 'Присвоени.' : result.message);
    if (result.ok) router.refresh();
  }

  if (batches.length === 0) {
    return (
      <p className="text-text-muted text-sm">
        Няма партида със свободни карти — създай и маркирай записаните.
      </p>
    );
  }

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Select
        label="Партида"
        width="medium"
        value={batchId}
        options={batches.map((batch) => ({
          value: batch.id,
          label: `${batch.name} · свободни ${batch.available}`,
        }))}
        onChange={(event) => setBatchId(event.target.value)}
      />
      <Field
        label="Брой"
        width="short"
        type="number"
        inputMode="numeric"
        min={1}
        max={1000}
        value={quantity}
        onChange={(event) => setQuantity(event.target.value)}
        hint={`Остават ${remaining}`}
      />
      <Button type="submit" disabled={pending || remaining === 0}>
        Присвои карти
      </Button>
      {message !== null && (
        <span role="status" className="text-text-muted text-sm">
          {message}
        </span>
      )}
    </form>
  );
}
