import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { PublicProfile } from '@/modules/platform';

import { ProfileView } from './profile-view';

function profile(overrides: Partial<PublicProfile> = {}): PublicProfile {
  return {
    slug: 'ivan-petrov',
    firstName: 'Иван',
    lastName: 'Петров',
    title: 'Управител',
    company: 'Демо ООД',
    bio: 'Здравей.',
    theme: { preset: 'sand', primaryColor: null, layout: 'default' },
    links: [
      { type: 'phone', label: null, value: '+359 88 123 4567' },
      { type: 'whatsapp', label: 'Пиши', value: '+359881234567' },
      { type: 'custom', label: null, value: 'javascript:alert(1)' },
      { type: 'custom', label: 'Сайт', value: 'demo.bg' },
    ],
    ...overrides,
  };
}

const html = (p: PublicProfile) =>
  renderToStaticMarkup(
    <ProfileView profile={p} appName="DCARDS" appUrl="https://dcards.bg/" />,
  );

describe('ProfileView', () => {
  it('sets the theme attribute and shows the texts', () => {
    const out = html(profile());
    expect(out).toContain('data-profile-theme="sand"');
    expect(out).toContain('Иван Петров');
    expect(out).toContain('Управител');
    expect(out).toContain('Демо ООД');
    expect(out).toContain('Здравей.');
    expect(out).toContain('DCARDS');
  });

  it('builds hrefs by type; rel/target only on https', () => {
    const out = html(profile());
    expect(out).toContain('href="tel:+359881234567"');
    expect(out).toMatch(
      /<a href="https:\/\/wa\.me\/359881234567" target="_blank" rel="noopener noreferrer"/,
    );
    expect(out).toContain('href="https://demo.bg"');
    expect(out).not.toMatch(/tel:[^"]*"[^>]*target=/);
    expect(out).toContain('Телефон');
    expect(out).toContain('Пиши');
  });

  it('skips a row whose href is null', () => {
    const out = html(profile());
    expect(out).not.toContain('javascript:');
    expect(out.match(/<li>/g)).toHaveLength(3);
  });

  it('renders initials instead of a photo', () => {
    const out = html(profile({ firstName: 'иван', lastName: 'петров' }));
    expect(out).toContain('>ИП<');
    // Единственият `<img>` е QR-ът.
    expect(out.match(/<img/g)).toHaveLength(1);
  });

  it('renders the action row: vCard download, share, QR', () => {
    const out = html(profile());
    expect(out).toMatch(/<a href="\/api\/vcard\/ivan-petrov" download=""/);
    expect(out).toContain('Запази контакт');
    expect(out).toContain('>Сподели<');
    expect(out).toMatch(/<img src="\/api\/qr\/ivan-petrov"/);
    expect(out).toContain('alt="QR код към https://dcards.bg/ivan-petrov"');
    expect(out.indexOf('Запази контакт')).toBeLessThan(out.indexOf('<ul'));
  });

  it('omits empty title, company and bio', () => {
    const out = html(profile({ title: null, company: null, bio: null }));
    expect(out).not.toContain('Управител');
    expect(out).not.toContain('Демо ООД');
  });
});
