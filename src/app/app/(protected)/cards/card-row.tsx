'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import type { CardStatus } from '@/modules/platform';

import {
  assignCardProfileAction,
  type CardActionResult,
  disableCardAction,
  unassignCardAction,
} from './actions';

export interface CardRowView {
  readonly id: string;
  readonly status: CardStatus;
  readonly profileId: string | null;
}

export interface ProfileOption {
  readonly id: string;
  readonly name: string;
}

type Props = Readonly<{
  card: CardRowView;
  profiles: readonly ProfileOption[];
}>;

type PickerProps = Props &
  Readonly<{
    pending: boolean;
    onAssign: (profileId: string) => void;
  }>;

/** Избор на профил + „Свържи"/„Смени" — само при `assigned|active` и наличен профил. */
function ProfilePicker({ card, profiles, pending, onAssign }: PickerProps) {
  const [profileId, setProfileId] = useState(
    card.profileId ?? profiles[0]?.id ?? '',
  );
  const linkable = card.status === 'assigned' || card.status === 'active';
  if (!linkable || profiles.length === 0) return null;

  return (
    <>
      <Select
        label="Профил"
        labelHidden
        width="medium"
        value={profileId}
        disabled={pending}
        onChange={(event) => setProfileId(event.target.value)}
        options={profiles.map((p) => ({ value: p.id, label: p.name }))}
      />
      <Button
        variant="secondary"
        disabled={pending || profileId === card.profileId}
        onClick={() => onAssign(profileId)}
      >
        {card.profileId === null ? 'Свържи' : 'Смени'}
      </Button>
    </>
  );
}

/** Действията в реда: профил, „Откачи" (при `active`), „Деактивирай" с потвърждение. */
export function CardRow({ card, profiles }: Props) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<CardActionResult>): Promise<void> {
    setPending(true);
    setError(null);
    const result = await action();
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setConfirmOpen(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-hint">
      <div className="flex flex-wrap items-center gap-2">
        <ProfilePicker
          card={card}
          profiles={profiles}
          pending={pending}
          onAssign={(profileId) =>
            void run(() => assignCardProfileAction(card.id, profileId))
          }
        />
        {card.status === 'active' && (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => void run(() => unassignCardAction(card.id))}
          >
            Откачи
          </Button>
        )}
        {card.status !== 'disabled' && (
          <Button
            variant="ghost"
            className="text-danger"
            disabled={pending}
            onClick={() => setConfirmOpen(true)}
          >
            Деактивирай
          </Button>
        )}
      </div>

      {/* Отвореният диалог показва грешката сам — иначе е два пъти. */}
      {error !== null && !confirmOpen && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Да деактивирам ли картата?"
        description="Картата спира да работи и не може да се върне в обращение."
        confirmLabel="Деактивирай"
        pending={pending}
        error={error}
        onConfirm={() => void run(() => disableCardAction(card.id))}
        onClose={() => {
          if (!pending) setConfirmOpen(false);
        }}
      />
    </div>
  );
}
