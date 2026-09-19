import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { LogoutButton } from '@/components/logout-button';
import { NavDrawer } from '@/components/nav/nav-drawer';
import { Sidebar } from '@/components/nav/sidebar';
import { getCurrentAdmin, signOut } from '@/modules/auth';
import { env } from '@/modules/core';

/**
 * Пазачът на админа. Проверката е СЪРВЪРНА: скрита в браузъра страница вече е
 * напуснала сървъра и всеки я чете в мрежата. Скриване не е защита.
 */
export default async function ProtectedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const admin = await getCurrentAdmin();

  if (admin === null) {
    redirect('/admin/login');
  }

  return (
    // Обвивката е висока точно колкото екрана — превърта се само съдържанието,
    // за да стои лепната лента с действия под него, не върху него. `min-w-0`
    // пази панела от таблица с `overflow-x-auto`, която разпъва flex-а.
    <div className="flex h-dvh overflow-hidden">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <NavDrawer />
            <Link href="/admin" className="truncate font-semibold text-brand">
              {env().APP_NAME} Админ
            </Link>
          </div>

          <div className="flex shrink-0 items-center gap-4">
            {/* Кой е влязъл е справка, не действие: на тесен екран отстъпва
                мястото си на бутона за навигация, а „Изход" остава. */}
            <span className="text-text-muted hidden text-sm wide:inline">
              {admin.email}
            </span>
            <LogoutButton action={signOut} />
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-page">{children}</div>
      </div>
    </div>
  );
}
