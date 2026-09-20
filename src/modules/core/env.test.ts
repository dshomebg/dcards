import { beforeEach, describe, expect, it, vi } from 'vitest';

// `env()` кешира — всеки тест чете модула наново.
async function loadEnv() {
  vi.resetModules();
  return (await import('./env')).env();
}

beforeEach(() => {
  process.env.DATABASE_URL = 'postgresql://u:p@127.0.0.1:5432/db';
  process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  process.env.SESSION_SECRET = 'x'.repeat(32);
  delete process.env.CARD_URL_BASE;
});

describe('env', () => {
  it('reads the required values and applies defaults', async () => {
    const parsed = await loadEnv();

    expect(parsed.DATABASE_URL).toContain('127.0.0.1');
    expect(parsed.STORE_CURRENCY).toBe('BGN');
    expect(parsed.MAIL_SECURE).toBe(true);
    expect(parsed.CARD_URL_BASE).toBeUndefined();
  });

  it('accepts CARD_URL_BASE as a URL and rejects garbage', async () => {
    process.env.CARD_URL_BASE = 'https://dcrd.bg';
    expect((await loadEnv()).CARD_URL_BASE).toBe('https://dcrd.bg');

    process.env.CARD_URL_BASE = 'not a url';
    await expect(loadEnv()).rejects.toThrow();
  });

  it('rejects a card URL base with path, query or hash - it goes on the chip', async () => {
    for (const bad of [
      'https://dcrd.bg/app',
      'https://dcrd.bg/?utm=1',
      'https://dcrd.bg/#x',
      'mailto:x@dcrd.bg',
    ]) {
      process.env.CARD_URL_BASE = bad;
      await expect(loadEnv()).rejects.toThrow();
    }
    process.env.CARD_URL_BASE = 'https://dcrd.bg/';
    expect((await loadEnv()).CARD_URL_BASE).toBe('https://dcrd.bg/');
  });
});
