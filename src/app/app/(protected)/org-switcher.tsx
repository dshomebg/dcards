'use client';

import { useState, useTransition } from 'react';

import { Select } from '@/components/ui/select';

import { switchOrgAction } from './switch-org';

export interface OrgOption {
  readonly id: string;
  readonly name: string;
}

type Props = Readonly<{ options: readonly OrgOption[]; currentId: string }>;

/** Селект за смяна на org — само при повече от едно членство. Успехът пренасочва сам. */
export function OrgSwitcher({ options, currentId }: Props) {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="flex items-center gap-2">
      {error !== null && (
        <span role="alert" className="text-sm text-danger">
          {error}
        </span>
      )}
      <Select
        label="Организация"
        labelHidden
        width="medium"
        value={currentId}
        disabled={busy}
        onChange={(event) => {
          const orgId = event.target.value;
          startTransition(async () => {
            const result = await switchOrgAction(orgId);
            setError(result.message);
          });
        }}
        options={options.map((org) => ({ value: org.id, label: org.name }))}
      />
    </span>
  );
}
