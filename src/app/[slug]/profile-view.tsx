// Чист презентационен компонент на публичния профил — без база, без Next API,
// за да се тества с `renderToStaticMarkup`. Цветовете идват само от `--profile-*`.

import type { CSSProperties } from 'react';

import { uploadUrl } from '@/lib/upload-url';
import {
  accentInk,
  LINK_LABELS,
  linkHref,
  profileUrl,
  type PublicProfile,
} from '@/modules/platform';

import { ShareButton } from './share-button';

interface ProfileViewProps {
  readonly profile: PublicProfile;
  readonly appName: string;
  readonly appUrl: string;
  /** Футърът „Създадено с" — `false` при активен Pro (`noBranding`). */
  readonly branding: boolean;
}

type ThemeStyle = CSSProperties & {
  '--profile-accent'?: string;
  '--profile-accent-ink'?: string;
  '--profile-logo'?: string;
};

// Мастилото е токен, не hex: контрастът е сметнат срещу същите стойности (`theme-contrast.ts`).
const ACCENT_INK_VAR = { light: 'var(--color-bg)', dark: 'var(--color-ink)' };

/** Pro: inline само каквото е зададено — без цвят и лого-фон HTML-ът е като преди. */
function themeStyle(profile: PublicProfile): ThemeStyle | undefined {
  const { primaryColor, logoBackground } = profile.theme;
  const style: ThemeStyle = {};
  if (primaryColor !== null) {
    style['--profile-accent'] = primaryColor;
    style['--profile-accent-ink'] = ACCENT_INK_VAR[accentInk(primaryColor)];
  }
  if (logoBackground && profile.logoKey !== null) {
    style['--profile-logo'] = `url("${uploadUrl(profile.logoKey)}")`;
  }
  return Object.keys(style).length === 0 ? undefined : style;
}

const ACTION_CLASS =
  'rounded-(--radius-card) px-4 py-3 text-center font-medium shadow-(--shadow-card)';

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/** Кръгла снимка с името за `alt`; без снимка — инициали (декоративни). */
function Avatar({
  profile,
  fullName,
}: {
  readonly profile: PublicProfile;
  readonly fullName: string;
}) {
  if (profile.photoKey !== null) {
    return (
      <img
        src={uploadUrl(profile.photoKey)}
        alt={fullName}
        width={96}
        height={96}
        className="size-24 rounded-full object-cover"
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className="flex size-24 items-center justify-center rounded-full bg-(--profile-accent) text-3xl font-semibold text-(--profile-accent-ink)"
    >
      {initials(profile.firstName, profile.lastName)}
    </div>
  );
}

function LinkRow({ link }: { readonly link: PublicProfile['links'][number] }) {
  const href = linkHref(link.type, link.value);
  if (href === null) return null;

  const external = href.startsWith('https://');
  return (
    <li>
      <a
        href={href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="flex items-center justify-between rounded-(--radius-card) bg-(--profile-surface) px-4 py-3 text-(--profile-ink) shadow-(--shadow-card)"
      >
        <span className="font-medium">
          {link.label ?? LINK_LABELS[link.type]}
        </span>
        <span className="truncate pl-4 text-sm text-(--profile-muted)">
          {link.value}
        </span>
      </a>
    </li>
  );
}

// „Запази контакт" и QR са без JS — само share бутонът е клиентски.
function Actions({
  profile,
  url,
  fullName,
}: {
  readonly profile: PublicProfile;
  readonly url: string;
  readonly fullName: string;
}) {
  return (
    <div className="group flex w-full flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        <a
          href={`/api/vcard/${profile.slug}`}
          download
          className={`${ACTION_CLASS} bg-(--profile-accent) text-(--profile-accent-ink)`}
        >
          Запази контакт
        </a>
        <ShareButton url={url} title={fullName} />
        {/* Chromium игнорира `display: contents` на `<details>` — затова панелът е
            извън grid-а и се показва с `:has(details[open])`, пак без JS. */}
        <details>
          <summary
            className={`${ACTION_CLASS} block cursor-pointer list-none bg-(--profile-surface) text-(--profile-ink)`}
          >
            QR
          </summary>
        </details>
      </div>
      {/* Браузърът зарежда `<img>` и при скрит панел — ~2KB кеширан SVG, прието. */}
      <div className="hidden justify-center rounded-(--radius-card) bg-(--profile-surface) p-4 shadow-(--shadow-card) group-has-[details[open]]:flex">
        <img
          src={`/api/qr/${profile.slug}`}
          alt={`QR код към ${url}`}
          width={240}
          height={240}
        />
      </div>
    </div>
  );
}

export function ProfileView({
  profile,
  appName,
  appUrl,
  branding,
}: ProfileViewProps) {
  const fullName = `${profile.firstName} ${profile.lastName}`;
  const url = profileUrl(appUrl, profile.slug);
  const style = themeStyle(profile);

  // Корен `<div>`, не `<main>`: редакторът го влага в превю на своята страница.
  return (
    <div
      data-profile-theme={profile.theme.preset}
      data-profile-logo-bg={
        style?.['--profile-logo'] === undefined ? undefined : ''
      }
      style={style}
      className="flex flex-col items-center px-4 py-10"
    >
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        {/* Подложка `--profile-surface` и в трите теми (§ 7в): тъмно лого върху тъмен фон. */}
        {profile.logoKey !== null && (
          <div className="rounded-(--radius-card) bg-(--profile-surface) px-4 py-2">
            <img
              src={uploadUrl(profile.logoKey)}
              alt={profile.company ?? ''}
              className="max-h-12 w-auto object-contain"
            />
          </div>
        )}

        <Avatar profile={profile} fullName={fullName} />

        <header className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{fullName}</h1>
          {profile.title !== null && (
            <p className="text-(--profile-muted)">{profile.title}</p>
          )}
          {profile.company !== null && (
            <p className="font-medium text-(--profile-accent)">
              {profile.company}
            </p>
          )}
        </header>

        {profile.bio !== null && (
          <p className="text-center whitespace-pre-line">{profile.bio}</p>
        )}

        <Actions profile={profile} url={url} fullName={fullName} />

        <ul className="flex w-full flex-col gap-3">
          {profile.links.map((link, index) => (
            <LinkRow key={`${link.type}-${index}`} link={link} />
          ))}
        </ul>

        {branding && (
          <footer className="mt-6 text-xs text-(--profile-muted)">
            Създадено с{' '}
            <a href="/" className="underline">
              {appName}
            </a>
          </footer>
        )}
      </div>
    </div>
  );
}
