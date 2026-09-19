// Чист презентационен компонент на публичния профил — без база, без Next API,
// за да се тества с `renderToStaticMarkup`. Цветовете идват само от `--profile-*`.

import {
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
}

const ACTION_CLASS =
  'rounded-(--radius-card) px-4 py-3 text-center font-medium shadow-(--shadow-card)';

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
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

export function ProfileView({ profile, appName, appUrl }: ProfileViewProps) {
  const fullName = `${profile.firstName} ${profile.lastName}`;
  const url = profileUrl(appUrl, profile.slug);

  // Корен `<div>`, не `<main>`: редакторът го влага в превю на своята страница.
  return (
    <div
      data-profile-theme={profile.theme.preset}
      className="flex flex-col items-center px-4 py-10"
    >
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        {/* Инициали вместо снимка — качването е отделен цикъл. */}
        <div
          aria-hidden="true"
          className="flex size-24 items-center justify-center rounded-full bg-(--profile-accent) text-3xl font-semibold text-(--profile-accent-ink)"
        >
          {initials(profile.firstName, profile.lastName)}
        </div>

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

        <footer className="mt-6 text-xs text-(--profile-muted)">
          Създадено с{' '}
          <a href="/" className="underline">
            {appName}
          </a>
        </footer>
      </div>
    </div>
  );
}
