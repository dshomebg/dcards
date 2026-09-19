import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { env } from '@/modules/core';

const name = env().APP_NAME;

export const metadata: Metadata = {
  title: { default: name, template: `%s | ${name}` },
  // Таблото на клиента не се индексира.
  robots: { index: false, follow: false },
};

// Само метаданни. Пазачът е в `(protected)/layout.tsx`.
export default function AppLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}
