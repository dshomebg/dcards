import { describe, expect, it } from 'vitest';

import { env } from './env';

describe('env', () => {
  it('reads the required values and applies defaults', () => {
    process.env.DATABASE_URL = 'postgresql://u:p@127.0.0.1:5432/db';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.SESSION_SECRET = 'x'.repeat(32);

    const parsed = env();

    expect(parsed.DATABASE_URL).toContain('127.0.0.1');
    expect(parsed.STORE_CURRENCY).toBe('BGN');
    expect(parsed.MAIL_SECURE).toBe(true);
  });
});
