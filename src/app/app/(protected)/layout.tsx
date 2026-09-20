import Link from 'next/link';
import type { ReactNode } from 'react';

import { LogoutButton } from '@/components/logout-button';
import { db, env } from '@/modules/core';
import { listMembershipsForUser } from '@/modules/platform';

import { AppNav } from './app-nav';
import { requireCurrent } from './current';
import { OrgSwitcher } from './org-switcher';
import { signOutAndClear } from './sign-out';

/**
 * Пазачът на `/app`. Проверката е СЪРВЪРНА — скриване в браузъра не е защита.
 * Мобилно първо: обикновена страница със скрол, без страничен панел.
 */
export default async function ProtectedAppLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const { user, org } = await requireCurrent();
  const memberships = await listMembershipsForUser(db, user.id);

  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
        <Link href="/app" className="truncate font-semibold text-brand">
          {env().APP_NAME}
        </Link>

        <div className="flex min-w-0 shrink-0 items-center gap-3">
          {memberships.length > 1 && (
            <OrgSwitcher
              currentId={org.id}
              options={memberships.map((m) => ({
                id: m.orgId,
                name: m.orgName,
              }))}
            />
          )}
          <span className="text-text-muted truncate text-sm">{user.name}</span>
          <LogoutButton action={signOutAndClear} />
        </div>
      </header>

      <AppNav />

      <div className="flex-1">{children}</div>
    </div>
  );
}
