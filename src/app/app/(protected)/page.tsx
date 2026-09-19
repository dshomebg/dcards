import type { Metadata } from 'next';
import Link from 'next/link';

import { buttonStyles } from '@/components/ui/button';
import { db, env } from '@/modules/core';
import { listProfiles, profileUrl } from '@/modules/platform';

import { requireCurrent } from './current';

export const metadata: Metadata = { title: 'Профили' };

export default async function ProfilesPage() {
  const { org } = await requireCurrent();
  const profiles = await listProfiles(db, org.id);
  const appUrl = env().APP_URL;

  return (
    <main className="flex flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Профили</h1>
        {/* Бутонът е винаги — лимитът на плана го решава сървърът. */}
        <Link href="/app/profiles/new" className={buttonStyles()}>
          Нов профил
        </Link>
      </div>

      {profiles.length === 0 ? (
        <p className="text-text-muted text-sm">
          Още нямаш профил. Направи първия — той е публичната страница на
          картата ти.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-(--radius-control) border border-border bg-surface">
          {profiles.map((profile) => (
            <li
              key={profile.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <div className="flex min-w-0 flex-col">
                <Link
                  href={`/app/profiles/${profile.id}`}
                  className="truncate font-medium"
                >
                  {profile.firstName} {profile.lastName}
                </Link>
                <a
                  href={profileUrl(appUrl, profile.slug)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-text-muted truncate text-sm underline"
                >
                  /{profile.slug}
                </a>
              </div>
              {!profile.isPublic && (
                <span className="text-text-muted text-xs">скрит</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
