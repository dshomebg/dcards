'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/modules/shop';

import { transitionOrderAction } from './actions';

type Props = Readonly<{
  orderId: string;
  /** Само разрешените от `ORDER_TRANSITIONS` — бутон за друг статус няма. */
  transitions: readonly OrderStatus[];
}>;

const LABELS: Readonly<Partial<Record<OrderStatus, string>>> = {
  in_production: 'В производство',
  shipped: 'Изпратена',
  delivered: 'Доставена',
  cancelled: 'Откажи',
};

/** Бутон на преход; „Изпратена" носи полето за номер на пратка, „Откажи" — потвърждение. */
export function StatusForm({ orderId, transitions }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tracking, setTracking] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function submit(to: OrderStatus): Promise<void> {
    setPending(true);
    setMessage(null);
    const result = await transitionOrderAction(
      orderId,
      to,
      to === 'shipped' ? tracking : undefined,
    );
    setPending(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setConfirmCancel(false);
    if (result.notice !== undefined) setMessage(result.notice);
    router.refresh();
  }

  if (transitions.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {transitions.includes('shipped') && (
        <Field
          label="Номер на пратка"
          width="medium"
          maxLength={60}
          value={tracking}
          onChange={(event) => setTracking(event.target.value)}
          hint={'Задължителен за „Изпратена" — влиза в писмото до клиента.'}
        />
      )}
      <div className="flex flex-wrap gap-3">
        {transitions.map((to) => (
          <Button
            key={to}
            variant={to === 'cancelled' ? 'danger' : 'secondary'}
            disabled={pending}
            onClick={() =>
              to === 'cancelled' ? setConfirmCancel(true) : void submit(to)
            }
          >
            {LABELS[to] ?? ORDER_STATUS_LABELS[to]}
          </Button>
        ))}
      </div>
      {message !== null && !confirmCancel && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      <ConfirmDialog
        open={confirmCancel}
        title="Да откажа ли поръчката?"
        description="Наличността се връща в склада, а присвоените карти се освобождават."
        confirmLabel="Откажи поръчката"
        pending={pending}
        error={message}
        onConfirm={() => void submit('cancelled')}
        onClose={() => {
          if (!pending) setConfirmCancel(false);
        }}
      />
    </div>
  );
}
