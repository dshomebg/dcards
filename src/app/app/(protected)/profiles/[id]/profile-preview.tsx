'use client';

import './profile-preview.css';

import {
  type Control,
  type DeepPartialSkipArrayKey,
  useWatch,
} from 'react-hook-form';

import { ProfileView } from '@/app/[slug]/profile-view';
import type { PublicProfile } from '@/modules/platform';

import type { ProfileFormValues } from './schema';

/** Каквото страницата е решила по плана — същото гейтване като `/{slug}`. */
export interface EditorPlan {
  readonly customTheme: boolean;
  readonly branding: boolean;
}

interface Props {
  readonly control: Control<ProfileFormValues>;
  /** ЗАПИСАНИЯТ slug — живият би дърпал `/api/qr/{нов}` при всеки клавиш. */
  readonly slug: string;
  /** Ключовете не са във формата — записват се веднага и идват от `saved`. */
  readonly images: ProfileImages;
  readonly plan: EditorPlan;
  readonly appName: string;
  readonly appUrl: string;
}

const orNull = (value: string): string | null => (value === '' ? null : value);

type LiveValues = DeepPartialSkipArrayKey<ProfileFormValues>;

export type ProfileImages = Pick<PublicProfile, 'photoKey' | 'logoKey'>;

const NO_IMAGES: ProfileImages = { photoKey: null, logoKey: null };

// Същото гейтване като `themeForPlan` на сървъра — превюто не обещава повече от страницата.
function liveTheme(
  theme: LiveValues['theme'],
  customTheme: boolean,
): PublicProfile['theme'] {
  return {
    preset: theme?.preset ?? 'light',
    primaryColor: customTheme ? (theme?.primaryColor ?? null) : null,
    logoBackground: customTheme && theme?.logoBackground === true,
    layout: 'default',
  };
}

/** Същото превръщане като на сървъра: само видимите, в реда на формата. */
export function toPublicProfile(
  values: LiveValues,
  slug: string,
  images: ProfileImages = NO_IMAGES,
  customTheme = false,
): PublicProfile {
  return {
    slug,
    ...images,
    firstName: values.firstName ?? '',
    lastName: values.lastName ?? '',
    title: orNull(values.title ?? ''),
    company: orNull(values.company ?? ''),
    bio: orNull(values.bio ?? ''),
    theme: liveTheme(values.theme, customTheme),
    links: (values.links ?? [])
      .filter((link) => link.isVisible === true)
      .map((link) => ({
        type: link.type ?? 'custom',
        label: orNull(link.label ?? ''),
        value: link.value ?? '',
      })),
  };
}

export function ProfilePreview({
  control,
  slug,
  images,
  plan,
  appName,
  appUrl,
}: Props) {
  const values = useWatch({ control });

  return (
    <aside aria-label="Превю" className="flex flex-col items-center gap-2">
      <p className="text-text-muted text-hint">Превю на /{slug}</p>
      {/* `inert`: „Сподели" и vCard в превюто не бива да работят. */}
      <div
        inert
        data-profile-preview
        className="h-[36rem] w-[20rem] overflow-y-auto rounded-[2rem] border-8 border-ink bg-bg shadow-(--shadow-card)"
      >
        <ProfileView
          profile={toPublicProfile(values, slug, images, plan.customTheme)}
          appName={appName}
          appUrl={appUrl}
          branding={plan.branding}
        />
      </div>
    </aside>
  );
}
