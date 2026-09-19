import './globals.css';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: process.env.APP_NAME ?? 'DCARDS',
  description: 'NFC визитки и дигитални профили',
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="bg">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
