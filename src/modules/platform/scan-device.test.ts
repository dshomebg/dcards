import { describe, expect, it } from 'vitest';

import { classifyDevice } from './scan-device';

describe('classifyDevice', () => {
  it('recognises Apple handhelds as ios', () => {
    expect(classifyDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe(
      'ios',
    );
    expect(classifyDevice('Mozilla/5.0 (iPad; CPU OS 16_0)')).toBe('ios');
  });

  it('recognises Android', () => {
    expect(classifyDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe(
      'android',
    );
  });

  it('falls back to other for desktop, empty and missing agents', () => {
    expect(classifyDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(
      'other',
    );
    expect(classifyDevice('')).toBe('other');
    expect(classifyDevice(null)).toBe('other');
  });
});
