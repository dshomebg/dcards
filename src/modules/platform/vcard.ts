// vCard 3.0 на ръка, без библиотека. Всяка потребителска стойност минава през
// `escapeVCardText`; URL/tel идват само от `linkHref` (ARC-7). Folding на 75
// октета — едва с `PHOTO` (прието в PLT-3).

import { linkHref } from './link-href';
import type { ProfileLinkType, PublicProfile } from './profile.schema';

const CRLF = '\r\n';

const URL_TYPES: readonly ProfileLinkType[] = [
  'website',
  'custom',
  'linkedin',
  'facebook',
  'instagram',
  'tiktok',
  'youtube',
  'telegram',
];

function isControl(char: string): boolean {
  const code = char.charCodeAt(0);
  return code < 0x20 || (code >= 0x7f && code <= 0x9f);
}

/** URI стойност: без структурно екраниране (`\,` обърква контакт-приложенията). */
function cleanUri(value: string): string {
  return [...value].filter((char) => !isControl(char)).join('');
}

/** RFC 2426 § 2.4.2: първо `\`, после `;` `,`, новите редове стават буквално `\n`. */
export function escapeVCardText(value: string): string {
  return [
    ...value
      .replaceAll('\\', '\\\\')
      .replaceAll(';', '\\;')
      .replaceAll(',', '\\,')
      .replaceAll(/\r\n|\r|\n/g, '\\n'),
  ]
    .filter((char) => !isControl(char))
    .join('');
}

function digits(value: string): string {
  return value.replaceAll(/\D/g, '');
}

/** Номерът като за `TEL`: phone през `linkHref`; whatsapp/viber → `+` и цифри. */
function telNumber(type: ProfileLinkType, value: string): string | null {
  if (type === 'phone') {
    const href = linkHref('phone', value);
    return href === null ? null : href.slice('tel:'.length);
  }
  if (type === 'whatsapp' || type === 'viber') {
    return digits(value) === '' ? null : `+${digits(value)}`;
  }
  return null;
}

// Един и същ номер в phone и whatsapp дава един `TEL` — сравнява се по цифри.
function telLines(links: PublicProfile['links']): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const link of links) {
    const number = telNumber(link.type, link.value);
    if (number === null || seen.has(digits(number))) continue;
    seen.add(digits(number));
    lines.push(`TEL;TYPE=CELL,VOICE:${escapeVCardText(number)}`);
  }
  return lines;
}

function emailLines(links: PublicProfile['links']): string[] {
  return links
    .filter((link) => link.type === 'email')
    .map((link) => linkHref('email', link.value))
    .filter((href) => href !== null)
    .map(
      (href) =>
        `EMAIL;TYPE=INTERNET:${escapeVCardText(href.slice('mailto:'.length))}`,
    );
}

function urlLines(links: PublicProfile['links'], profileUrl: string): string[] {
  const lines = [`URL:${cleanUri(profileUrl)}`];
  for (const type of URL_TYPES) {
    for (const link of links) {
      if (link.type !== type) continue;
      const href = linkHref(type, link.value);
      if (href !== null) lines.push(`URL:${cleanUri(href)}`);
    }
  }
  return lines;
}

function addressLines(links: PublicProfile['links']): string[] {
  return links
    .filter((link) => link.type === 'address' && link.value.trim() !== '')
    .map((link) => `ADR;TYPE=WORK:;;${escapeVCardText(link.value.trim())};;;;`);
}

export function buildVCard(profile: PublicProfile, profileUrl: string): string {
  const first = escapeVCardText(profile.firstName);
  const last = escapeVCardText(profile.lastName);
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${last};${first};;;`,
    `FN:${first} ${last}`,
  ];
  if (profile.title !== null)
    lines.push(`TITLE:${escapeVCardText(profile.title)}`);
  if (profile.company !== null)
    lines.push(`ORG:${escapeVCardText(profile.company)}`);
  lines.push(
    ...telLines(profile.links),
    ...emailLines(profile.links),
    ...urlLines(profile.links, profileUrl),
    ...addressLines(profile.links),
  );
  if (profile.bio !== null) lines.push(`NOTE:${escapeVCardText(profile.bio)}`);
  // PHOTO;ENCODING=b;TYPE=JPEG: — когато има storage; тогава folding става задължителен.
  lines.push('END:VCARD');
  return lines.join(CRLF) + CRLF;
}

// RFC 8187 не допуска `!'()*`, а `encodeURIComponent` ги оставя — кодират се допълнително.
function encodeRfc8187(value: string): string {
  return encodeURIComponent(value).replaceAll(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

// Кирилското име само през `filename*`; `filename` е ASCII slug.
export function vcardContentDisposition(profile: PublicProfile): string {
  const name = encodeRfc8187(`${profile.firstName} ${profile.lastName}`);
  return `attachment; filename="${profile.slug}.vcf"; filename*=UTF-8''${name}.vcf`;
}
