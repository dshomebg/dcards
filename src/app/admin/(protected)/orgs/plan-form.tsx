'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { PLAN_LABELS } from '@/modules/platform';

import { setOrgPlanAction } from './actions';
import { PLANS } from './schema';

type Props = Readonly<{
  orgId: string;
  plan: (typeof PLANS)[number];
  /** `YYYY-MM-DD` или празно = безсрочно. */
  expiresOn: string;
}>;

const PLAN_OPTIONS = PLANS.map((plan) => ({
  value: plan,
  label: PLAN_LABELS[plan],
}));

// Само подсказка в браузъра; сървърът налага „не по-рано от днес" по София.
const today = new Date().toISOString().slice(0, 10);

export function PlanForm(props: Props) {
  const router = useRouter();
  const [plan, setPlan] = useState<string>(props.plan);
  const [expiresOn, setExpiresOn] = useState(props.expiresOn);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(): Promise<void> {
    setPending(true);
    setMessage(null);
    const result = await setOrgPlanAction(props.orgId, plan, expiresOn);
    setPending(false);
    setMessage(result.ok ? 'Записано.' : result.message);
    if (result.ok) {
      // `free` нулира датата на сървъра — полето да не я пази за следващия `pro`.
      if (plan !== 'pro') setExpiresOn('');
      router.refresh();
    }
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
        label="План"
        width="short"
        options={PLAN_OPTIONS}
        value={plan}
        onChange={(event) => setPlan(event.target.value)}
      />
      <Field
        label="Изтича на"
        type="date"
        width="medium"
        value={expiresOn}
        min={today}
        disabled={plan !== 'pro'}
        hint="Празно = безсрочно."
        onChange={(event) => setExpiresOn(event.target.value)}
      />
      <Button type="submit" variant="secondary" disabled={pending}>
        Запиши плана
      </Button>
      {message !== null && (
        <span role="status" className="text-text-muted text-sm">
          {message}
        </span>
      )}
    </form>
  );
}
