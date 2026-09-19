import { describe, expect, it } from 'vitest';

import { LINK_LABELS, linkHref } from './link-href';
import { PROFILE_LINK_TYPES } from './profile.schema';

describe('linkHref — one case per type', () => {
  it.each([
    ['phone', '+359 (88) 123-4567', 'tel:+359881234567'],
    ['email', 'ivan@demo.bg', 'mailto:ivan@demo.bg'],
    ['website', 'demo.bg', 'https://demo.bg'],
    ['custom', 'https://example.com/a?b=1', 'https://example.com/a?b=1'],
    ['linkedin', '@ivan-petrov', 'https://www.linkedin.com/in/ivan-petrov'],
    [
      'linkedin',
      'https://www.linkedin.com/in/ivan',
      'https://www.linkedin.com/in/ivan',
    ],
    ['facebook', 'ivan.petrov', 'https://www.facebook.com/ivan.petrov'],
    ['instagram', '@ivan', 'https://www.instagram.com/ivan'],
    ['tiktok', '@ivan', 'https://www.tiktok.com/@ivan'],
    ['youtube', 'ivan', 'https://www.youtube.com/@ivan'],
    ['youtube', 'https://youtu.be/abc', 'https://youtu.be/abc'],
    ['whatsapp', '+359 88 123 4567', 'https://wa.me/359881234567'],
    ['viber', '+359881234567', 'viber://chat?number=%2B359881234567'],
    ['telegram', '@ivan', 'https://t.me/ivan'],
    [
      'address',
      'бул. Витоша 1, София',
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('бул. Витоша 1, София')}`,
    ],
  ] as const)('%s: %s → %s', (type, value, expected) => {
    expect(linkHref(type, value)).toBe(expected);
  });
});

describe('linkHref — unsafe schemes', () => {
  it.each(['website', 'custom', 'linkedin', 'facebook', 'youtube'] as const)(
    '%s refuses javascript: and data:',
    (type) => {
      expect(linkHref(type, 'javascript:alert(1)')).toBeNull();
      expect(linkHref(type, 'data:text/html,hi')).toBeNull();
    },
  );

  it('returns null for empty values', () => {
    expect(linkHref('phone', 'abc')).toBeNull();
    expect(linkHref('whatsapp', '')).toBeNull();
    expect(linkHref('telegram', '@')).toBeNull();
  });
});

describe('LINK_LABELS', () => {
  it('has a Bulgarian label for every type', () => {
    for (const type of PROFILE_LINK_TYPES) {
      expect(LINK_LABELS[type].length).toBeGreaterThan(0);
    }
    expect(LINK_LABELS.phone).toBe('Телефон');
    expect(LINK_LABELS.custom).toBe('Линк');
  });
});
