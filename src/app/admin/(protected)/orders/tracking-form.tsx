'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';

import { setTrackingNumberAction } from './actions';

type Props = Readonly<{ orderId: string; trackingNumber: string | null }>;

/** Смяна на номера след изпращане — без писмо до клиента. */
export function TrackingForm({ orderId, trackingNumber }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(trackingNumber ?? '');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(): Promise<void> {
    setPending(true);
    setMessage(null);
    const result = await setTrackingNumberAction(orderId, value);
    setPending(false);
    setMessage(result.ok ? 'Записано.' : result.message);
    if (result.ok) router.refresh();
  }

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Field
        label="Номер на пратка"
        width="medium"
        maxLength={60}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <Button type="submit" variant="secondary" disabled={pending}>
        Запиши номера
      </Button>
      {message !== null && (
        <span role="status" className="text-text-muted text-sm">
          {message}
        </span>
      )}
    </form>
  );
}
