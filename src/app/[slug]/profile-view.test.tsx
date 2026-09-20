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
    photoKey: null,
    logoKey: null,
    theme: {
      preset: 'sand',
      primaryColor: null,
      logoBackground: false,
      layout: 'default',
    },
    links: [
      { type: 'phone', label: null, value: '+359 88 123 4567' },
      { type: 'whatsapp', label: 'Пиши', value: '+359881234567' },
      { type: 'custom', label: null, value: 'javascript:alert(1)' },
      { type: 'custom', label: 'Сайт', value: 'demo.bg' },
    ],
    ...overrides,
  };
}

const html = (p: PublicProfile, branding = true) =>
  renderToStaticMarkup(
    <ProfileView
      profile={p}
      appName="DCARDS"
      appUrl="https://dcards.bg/"
      branding={branding}
    />,
  );

const LOGO = 'logos/00000000-0000-4000-8000-000000000001.webp';

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

  it('renders initials without a photo', () => {
    const out = html(profile({ firstName: 'иван', lastName: 'петров' }));
    expect(out).toContain('>ИП<');
    // Единственият `<img>` е QR-ът.
    expect(out.match(/<img/g)).toHaveLength(1);
  });

  it('renders the round photo with the name as alt instead of initials', () => {
    const key = 'photos/00000000-0000-4000-8000-000000000000.webp';
    const out = html(profile({ photoKey: key }));
    expect(out).toMatch(
      new RegExp(`<img src="/api/uploads/${key}" alt="Иван Петров"`),
    );
    expect(out).toContain('rounded-full object-cover');
    expect(out).not.toContain('>ИП<');
    expect(out.match(/<img/g)).toHaveLength(2);
  });

  it('renders the logo above the header on a surface pad, in every theme', () => {
    const key = 'logos/00000000-0000-4000-8000-000000000001.webp';
    for (const preset of ['light', 'dark', 'sand'] as const) {
      const out = html(
        profile({
          logoKey: key,
          theme: {
            preset,
            primaryColor: null,
            logoBackground: false,
            layout: 'default',
          },
        }),
      );
      const logo = out.indexOf(`<img src="/api/uploads/${key}"`);
      expect(logo).toBeGreaterThan(-1);
      expect(logo).toBeLessThan(out.indexOf('<header'));
      expect(out.slice(0, logo)).toContain('bg-(--profile-surface)');
    }
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

  it('renders the footer only with branding', () => {
    expect(html(profile())).toContain('Създадено с');
    const out = html(profile(), false);
    expect(out).not.toContain('Създадено с');
    expect(out).not.toContain('<footer');
  });

  it('without a colour or logo background the root has no inline style or attribute', () => {
    const out = html(profile({ logoKey: LOGO }));
    expect(out).not.toContain('style=');
    expect(out).not.toContain('data-profile-logo-bg');
    expect(out).not.toContain('--profile-accent:');
  });

  it('sets the accent and a token ink by contrast, as inline variables', () => {
    const theme = (primaryColor: string) => ({
      preset: 'light' as const,
      primaryColor,
      logoBackground: false,
      layout: 'default' as const,
    });
    const dark = html(profile({ theme: theme('#8b1e3f') }));
    expect(dark).toContain(
      'style="--profile-accent:#8b1e3f;--profile-accent-ink:var(--color-bg)"',
    );
    const light = html(profile({ theme: theme('#ffd500') }));
    expect(light).toContain('--profile-accent-ink:var(--color-ink)');
    expect(light).not.toContain('data-profile-logo-bg');
  });

  it('sets the logo background only with a logo', () => {
    const theme = {
      preset: 'sand',
      primaryColor: null,
      logoBackground: true,
      layout: 'default',
    } as const;
    const out = html(profile({ theme, logoKey: LOGO }));
    expect(out).toContain('data-profile-logo-bg=""');
    expect(out).toContain(
      `--profile-logo:url(&quot;/api/uploads/${LOGO}&quot;)`,
    );
    expect(out).not.toContain('--profile-accent:');

    const noLogo = html(profile({ theme }));
    expect(noLogo).not.toContain('data-profile-logo-bg');
    expect(noLogo).not.toContain('style=');
  });

  it('omits empty title, company and bio', () => {
    const out = html(profile({ title: null, company: null, bio: null }));
    expect(out).not.toContain('Управител');
    expect(out).not.toContain('Демо ООД');
  });
});
