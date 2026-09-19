import { describe, expect, it } from 'vitest';

import { profileUrl } from './profile-url';

describe('profileUrl', () => {
  it('joins APP_URL and slug', () => {
    expect(profileUrl('https://dcards.bg', 'demo')).toBe(
      'https://dcards.bg/demo',
    );
  });

  it('does not double the slash when APP_URL ends with one', () => {
    expect(profileUrl('https://dcards.bg/', 'demo')).toBe(
      'https://dcards.bg/demo',
    );
  });
});
