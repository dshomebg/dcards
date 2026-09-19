'use client';

// Единственият клиентски компонент на `/[slug]`: Web Share → clipboard → адресът като текст.

import { useState } from 'react';

const COPIED_MS = 2000;

interface Props {
  readonly url: string;
  readonly title: string;
}

export function ShareButton({ url, title }: Props) {
  const [state, setState] = useState<'idle' | 'copied' | 'plain'>('idle');

  async function share(): Promise<void> {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        // Отказ от системния лист не е грешка; друга грешка → копиране.
        if (error instanceof Error && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
      setTimeout(() => setState('idle'), COPIED_MS);
    } catch {
      setState('plain');
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void share()}
        className="rounded-(--radius-card) bg-(--profile-surface) px-4 py-3 font-medium text-(--profile-ink) shadow-(--shadow-card)"
      >
        {state === 'copied' ? 'Копирано' : 'Сподели'}
      </button>
      {state === 'plain' && (
        <span className="col-span-full text-sm break-all">{url}</span>
      )}
    </>
  );
}
