import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { env } from '@/modules/core';

const name = `${env().APP_NAME} Админ`;

export const metadata: Metadata = {
  title: { default: name, template: `%s | ${name}` },
  // Админът никога не се индексира.
  robots: { index: false, follow: false },
};

// Само метаданни. Пазачът е в `(protected)/layout.tsx`, за да не затваря входа.
export default function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}
