'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import type { CardStatus } from '@/modules/platform';

import {
  type CardActionResult,
  detachCardAction,
  disableCardAction,
} from './actions';
import { CardStatusBadge } from './status-badge';

/** Само низове и `null` — датите са форматирани на сървъра. */
export interface CardDetailView {
  readonly id: string;
  readonly batchId: string;
  readonly batchName: string;
  readonly activationCode: string;
  readonly status: CardStatus;
  readonly orgName: string | null;
  readonly profileName: string | null;
  readonly profileSlug: string | null;
  readonly writtenAt: string | null;
  readonly activatedAt: string | null;
}

function Row({
  label,
  children,
}: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="flex flex-col gap-hint sm:flex-row sm:gap-4">
      <dt className="text-text-muted w-40 shrink-0 text-sm">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export function CardDetail({ card }: Readonly<{ card: CardDetailView }>) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(
    action: (id: string) => Promise<CardActionResult>,
  ): Promise<void> {
    setPending(true);
    setError(null);
    const result = await action(card.id);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setConfirmOpen(false);
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-6 rounded-(--radius-card) border border-border bg-surface p-6">
      <div className="flex items-center gap-3">
        <h2 className="font-mono text-xl font-semibold">{card.id}</h2>
        <CardStatusBadge status={card.status} />
      </div>

      <dl className="flex flex-col gap-3">
        <Row label="Партида">
          <Link href={`/admin/batches/${card.batchId}`} className="underline">
            {card.batchName}
          </Link>
        </Row>
        <Row label="Код за активация">
          <span className="font-mono">{card.activationCode}</span>
        </Row>
        <Row label="Организация">{card.orgName ?? '—'}</Row>
        <Row label="Профил">
          {card.profileName === null ? (
            '—'
          ) : (
            <>
              {card.profileName}{' '}
              <span className="text-text-muted">/{card.profileSlug}</span>
            </>
          )}
        </Row>
        <Row label="Записана">{card.writtenAt ?? '—'}</Row>
        <Row label="Активирана">{card.activatedAt ?? '—'}</Row>
      </dl>

      {/* Отвореният диалог показва грешката сам — иначе е два пъти. */}
      {error !== null && !confirmOpen && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}

      {/* Бутоните липсват, когато са безсмислени — не се „скриват", просто ги няма. */}
      <div className="flex flex-wrap gap-3">
        {card.profileName !== null && (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => void run(detachCardAction)}
          >
            Откачи от профила
          </Button>
        )}
        {card.status !== 'disabled' && (
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => setConfirmOpen(true)}
          >
            Деактивирай
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Да деактивирам ли картата?"
        description="Картата спира да работи и не може да се върне в обращение."
        confirmLabel="Деактивирай"
        pending={pending}
        error={error}
        onConfirm={() => void run(disableCardAction)}
        onClose={() => {
          if (!pending) setConfirmOpen(false);
        }}
      />
    </section>
  );
}
