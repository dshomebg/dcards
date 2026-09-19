'use client';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';

/** Повтаря сървърното зареждане на текущия маршрут, без пълно презареждане. */
export function RetryButton({
  label = 'Опитай отново',
}: Readonly<{ label?: string }>) {
  const router = useRouter();

  return (
    <Button variant="secondary" onClick={() => router.refresh()}>
      {label}
    </Button>
  );
}
