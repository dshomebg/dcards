import { describe, expect, it } from 'vitest';

import { classifyDevice, isBot } from './scan-device';

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

describe('isBot', () => {
  it('flags crawlers, link previewers and CLI clients', () => {
    expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true);
    expect(isBot('facebookexternalhit/1.1')).toBe(true);
    expect(isBot('WhatsApp/2.23.20.0')).toBe(true);
    expect(isBot('curl/8.4.0')).toBe(true);
    expect(isBot('python-requests/2.31')).toBe(true);
    expect(isBot('Mozilla/5.0 HeadlessChrome/120')).toBe(true);
    expect(isBot('Mozilla/5.0 (compatible; PetalBot;+https://x)')).toBe(true);
    expect(isBot('Viber/20.0 (iOS)')).toBe(true);
  });

  it('does not mistake a Cubot phone for a robot', () => {
    expect(
      isBot('Mozilla/5.0 (Linux; Android 10; CUBOT_X19) AppleWebKit/537.36'),
    ).toBe(false);
  });

  it('treats a missing or empty agent as a bot', () => {
    expect(isBot(null)).toBe(true);
    expect(isBot('')).toBe(true);
  });

  it('lets real browsers through', () => {
    expect(isBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1')).toBe(
      false,
    );
    expect(isBot('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120')).toBe(
      false,
    );
  });
});
