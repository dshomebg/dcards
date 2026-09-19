// Публичната страница на профила: `/{slug}`, без auth. Винаги свежа
// (`force-dynamic`, § 3.6) — редакцията се вижда веднага, без инвалидация.

import './profile-theme.css';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { db, env } from '@/modules/core';
import {
  findPublicProfileBySlug,
  profileUrl,
  slugSchema,
} from '@/modules/platform';

import { ProfileView } from './profile-view';

export const dynamic = 'force-dynamic';

// Изричен тип, не генерираният `PageProps`: той живее в `.next/types`, което
// го няма на чиста машина, и `pnpm typecheck` би паднал преди първия build.
type Props = Readonly<{ params: Promise<{ slug: string }> }>;

// Невалиден slug → 404 без заявка; `cache` обединява четенето на
// `generateMetadata` и страницата в едно.
const loadProfile = cache(async (slug: string) => {
  if (!slugSchema.safeParse(slug).success) return null;
  return findPublicProfileBySlug(db, slug);
});

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug } = await props.params;
  const profile = await loadProfile(slug);
  if (profile === null) return {};

  const name = `${profile.firstName} ${profile.lastName}`;
  const title = profile.title === null ? name : `${name} – ${profile.title}`;
  const description =
    profile.bio ??
    [profile.title, profile.company].filter((part) => part !== null).join(', ');
  const { APP_NAME, APP_URL } = env();

  return {
    title,
    description,
    openGraph: {
      type: 'profile',
      locale: 'bg_BG',
      siteName: APP_NAME,
      url: profileUrl(APP_URL, profile.slug),
      title,
      description,
    },
  };
}

export default async function ProfilePage(props: Props) {
  const { slug } = await props.params;
  const profile = await loadProfile(slug);
  if (profile === null) notFound();

  const { APP_NAME, APP_URL } = env();
  return (
    <main>
      <ProfileView profile={profile} appName={APP_NAME} appUrl={APP_URL} />
    </main>
  );
}
