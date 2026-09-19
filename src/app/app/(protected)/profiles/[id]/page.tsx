// Единственото място извън `/[slug]`, което внася темите — превюто ги иска.
import '@/app/[slug]/profile-theme.css';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';

import { db, env } from '@/modules/core';
import { getProfileForEdit } from '@/modules/platform';

import { requireCurrent } from '../../current';
import { ProfileEditor } from './profile-editor';

export const metadata: Metadata = { title: 'Профил' };

type Props = Readonly<{ params: Promise<{ id: string }> }>;

// Сесията първо (без нея е `/login`, не 404); после не-UUID → 404 без заявка;
// чужд и несъществуващ → същият 404.
export default async function Page(props: Props) {
  const { org } = await requireCurrent();
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();

  const profile = await getProfileForEdit(db, org.id, id);
  if (profile === null) notFound();

  const { APP_NAME, APP_URL } = env();
  return (
    <ProfileEditor profile={profile} appName={APP_NAME} appUrl={APP_URL} />
  );
}
