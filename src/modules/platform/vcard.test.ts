import { describe, expect, it } from 'vitest';

import type { PublicProfile, PublicProfileLink } from './profile.schema';
import {
  buildVCard,
  escapeVCardText,
  foldLine,
  vcardContentDisposition,
} from './vcard';

const URL = 'https://dcards.bg/ivan-petrov';

function profile(overrides: Partial<PublicProfile> = {}): PublicProfile {
  return {
    slug: 'ivan-petrov',
    firstName: 'Иван',
    lastName: 'Петров',
    title: 'Управител',
    company: 'Демо ООД',
    bio: 'Здравей.',
    photoKey: null,
    logoKey: null,
    theme: {
      preset: 'sand',
      primaryColor: null,
      logoBackground: false,
      layout: 'default',
    },
    links: [],
    ...overrides,
  };
}

const link = (type: PublicProfileLink['type'], value: string) => ({
  type,
  label: null,
  value,
});

const lines = (p: PublicProfile) => buildVCard(p, URL).split('\r\n');

/** RFC 2426 § 2.6: CRLF + интервал е продължение на предния ред. */
const unfold = (out: string) => out.replaceAll('\r\n ', '');

const octets = (out: string) =>
  out.split('\r\n').map((line) => Buffer.byteLength(line));

describe('buildVCard', () => {
  it('frames the card and uses CRLF only', () => {
    const out = buildVCard(profile(), URL);
    expect(out.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n')).toBe(true);
    expect(out.endsWith('END:VCARD\r\n')).toBe(true);
    expect(out.replaceAll('\r\n', '')).not.toMatch(/[\r\n]/);
  });

  it('builds N and FN from both names', () => {
    const out = lines(profile());
    expect(out).toContain('N:Петров;Иван;;;');
    expect(out).toContain('FN:Иван Петров');
    expect(out).toContain('TITLE:Управител');
    expect(out).toContain('ORG:Демо ООД');
  });

  it('escapes ; , backslash and newlines in NOTE, drops lone CR', () => {
    const out = buildVCard(
      profile({ bio: 'a;b,c\\d\r\nвтори\rред\nтрети' }),
      URL,
    );
    expect(out).toContain('NOTE:a\\;b\\,c\\\\d\\nвтори\\nред\\nтрети\r\n');
  });

  it('strips other control characters', () => {
    expect(escapeVCardText('a\u0000b\u0007c\u007fd')).toBe('abcd');
  });

  it('emits TEL for phone/whatsapp/viber, deduplicated by digits', () => {
    const out = lines(
      profile({
        links: [
          link('phone', '+359 88 123 4567'),
          link('whatsapp', '+359881234567'),
          link('viber', '359 88 999 0000'),
          link('phone', ''),
        ],
      }),
    );
    const tel = out.filter((l) => l.startsWith('TEL'));
    expect(tel).toEqual([
      'TEL;TYPE=CELL,VOICE:+359881234567',
      'TEL;TYPE=CELL,VOICE:+359889990000',
    ]);
  });

  it('emits EMAIL from the trimmed value and skips empty', () => {
    const out = lines(
      profile({ links: [link('email', ' ivan@demo.bg '), link('email', ' ')] }),
    );
    expect(out.filter((l) => l.startsWith('EMAIL'))).toEqual([
      'EMAIL;TYPE=INTERNET:ivan@demo.bg',
    ]);
  });

  it('puts the profile URL first and only linkHref results after it', () => {
    const out = lines(
      profile({
        links: [
          link('custom', 'javascript:alert(1)'),
          link('linkedin', '@ivan'),
          link('website', 'demo.bg'),
        ],
      }),
    );
    expect(out.filter((l) => l.startsWith('URL'))).toEqual([
      `URL:${URL}`,
      'URL:https://demo.bg',
      'URL:https://www.linkedin.com/in/ivan',
    ]);
    expect(buildVCard(profile(), URL)).not.toContain('javascript:');
  });

  it('puts the address in the street component, escaped', () => {
    const out = lines(
      profile({ links: [link('address', 'ул. Ал. Стамболийски 1, София')] }),
    );
    expect(out).toContain(
      'ADR;TYPE=WORK:;;ул. Ал. Стамболийски 1\\, София;;;;',
    );
  });

  it('omits lines for null fields and for a profile without links', () => {
    const out = buildVCard(
      profile({ title: null, company: null, bio: null, links: [] }),
      URL,
    );
    expect(out).not.toMatch(/^(TITLE|ORG|NOTE)[:;]/m);
    expect(out).not.toMatch(/^(TEL|EMAIL|ADR)[:;]/m);
  });

  it('keeps URL values as plain URIs and percent-encodes RFC 8187 specials', () => {
    const out = lines(
      profile({ links: [link('website', 'https://site.bg/a,b')] }),
    );
    expect(out).toContain('URL:https://site.bg/a,b');

    const disposition = vcardContentDisposition(
      profile({ firstName: "O'Brien (Jr.)", lastName: 'Star*' }),
    );
    expect(disposition).toContain("UTF-8''O%27Brien%20%28Jr.%29%20Star%2A.vcf");
    expect(disposition.split("UTF-8''")[1]).not.toMatch(/['()*]/);
  });
});

describe('foldLine', () => {
  it('leaves a short line alone and folds a long one under 75 octets', () => {
    expect(foldLine('FN:Иван')).toEqual(['FN:Иван']);
    const folded = foldLine(`NOTE:${'a'.repeat(200)}`);
    expect(folded).toHaveLength(3);
    expect(folded.every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
    expect(folded.slice(1).every((l) => l.startsWith(' '))).toBe(true);
    expect(folded.map((l) => l.replace(/^ /, '')).join('')).toBe(
      `NOTE:${'a'.repeat(200)}`,
    );
  });

  it('never splits a multibyte character', () => {
    const note = `NOTE:${'я'.repeat(100)}`;
    const folded = foldLine(note);
    for (const line of folded) {
      expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
      expect(line.includes('�')).toBe(false);
    }
    expect(folded.map((l) => l.replace(/^ /, '')).join('')).toBe(note);
  });
});

describe('buildVCard — folding and PHOTO', () => {
  const long = 'Дълга кирилска бележка. '.repeat(10);

  it('keeps every line at 75 octets or less and unfolds to the original', () => {
    const out = buildVCard(profile({ bio: long }), URL);
    expect(Math.max(...octets(out))).toBeLessThanOrEqual(75);
    expect(unfold(out)).toContain(`NOTE:${escapeVCardText(long)}\r\n`);
  });

  it('emits PHOTO as base64 JPEG that decodes back to the bytes', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(200).fill(7)]);
    const out = buildVCard(profile(), URL, { jpeg });
    expect(Math.max(...octets(out))).toBeLessThanOrEqual(75);
    const line = unfold(out)
      .split('\r\n')
      .find((l) => l.startsWith('PHOTO;ENCODING=b;TYPE=JPEG:'));
    expect(line).toBeDefined();
    const b64 = line?.slice('PHOTO;ENCODING=b;TYPE=JPEG:'.length) ?? '';
    expect(Buffer.from(b64, 'base64').equals(jpeg)).toBe(true);
    expect(unfold(out).indexOf('PHOTO')).toBeLessThan(
      unfold(out).indexOf('END:VCARD'),
    );
  });

  it('has no PHOTO line without a jpeg', () => {
    expect(buildVCard(profile(), URL)).not.toContain('PHOTO');
  });
});

describe('vcardContentDisposition', () => {
  it('keeps filename ASCII and puts the cyrillic name in filename*', () => {
    const header = vcardContentDisposition(profile());
    expect(header).toContain('attachment; filename="ivan-petrov.vcf"');
    expect(header).toMatch(
      /filename\*=UTF-8''%D0%98%D0%B2%D0%B0%D0%BD%20%D0%9F[^;]*\.vcf$/,
    );
  });
});
