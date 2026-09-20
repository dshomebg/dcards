'use client';

import Link from 'next/link';
import { useState } from 'react';

import { activateFromChipAction } from '@/app/app/(protected)/cards/actions';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

export interface ActivateProfileOption {
  readonly id: string;
  readonly name: string;
}

type Props = Readonly<{
  cardId: string;
  profiles: readonly ActivateProfileOption[];
}>;

/** Избор на профил + „Активирай"; при успех action-ът пренасочва към `/{slug}`. */
export function ActivateForm({ cardId, profiles }: Props) {
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function activate(): Promise<void> {
    setPending(true);
    setError(null);
    const result = await activateFromChipAction(cardId, profileId);
    setError(result.message);
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {profiles.length === 0 ? (
        <p className="text-text-muted text-sm">
          Още нямаш профил — направи първия и картата ще води към него.
        </p>
      ) : (
        <form
          method="post"
          onSubmit={(event) => {
            event.preventDefault();
            void activate();
          }}
          className="flex flex-col gap-4"
        >
          <Select
            label="Профил"
            value={profileId}
            disabled={pending}
            onChange={(event) => setProfileId(event.target.value)}
            options={profiles.map((p) => ({ value: p.id, label: p.name }))}
          />
          {error !== null && (
            <p role="alert" className="text-danger text-sm">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? 'Активиране…' : 'Активирай'}
          </Button>
        </form>
      )}

      <Link
        href={`/app/profiles/new?card=${cardId}`}
        className="text-brand text-sm underline"
      >
        Нов профил
      </Link>
    </div>
  );
}
