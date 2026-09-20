import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Platform from '@/modules/platform';

const auth = vi.hoisted(() => ({ getCurrentAdmin: vi.fn() }));
const rateLimit = vi.hoisted(() => ({
  consume: vi.fn(() => Promise.resolve({ allowed: true, retryAfterSec: 0 })),
}));
const platform = vi.hoisted(() => ({ getBatchCsvRows: vi.fn() }));
const envValues = vi.hoisted(() => ({
  APP_URL: 'https://www.dcards-bg.com',
  CARD_URL_BASE: undefined as string | undefined,
}));

// Barrel-ът на `auth` носи `server-only`; `core` отваря пул при импорт.
vi.mock('@/modules/auth', () => auth);
vi.mock('@/modules/core', async () => ({
  db: {},
  env: () => envValues,
  rateLimit,
  ...(await vi.importActual('@/modules/core/rate-limit/policy')),
}));
vi.mock('@/modules/platform', async (importOriginal) => ({
  ...(await importOriginal<typeof Platform>()),
  ...platform,
}));

const { GET } = await import('./route');

const admin = {
  id: '019969a0-0000-7000-8000-000000000001',
  email: 'a@x.bg',
  name: 'A',
};
const batchId = '019969a0-0000-7000-8000-0000000000bb';
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const request = () =>
  new Request(`http://localhost/admin/api/batches/${batchId}/export`);

beforeEach(() => {
  auth.getCurrentAdmin.mockReset().mockResolvedValue(admin);
  rateLimit.consume.mockClear();
  rateLimit.consume.mockResolvedValue({ allowed: true, retryAfterSec: 0 });
  platform.getBatchCsvRows.mockReset().mockResolvedValue([
    { id: 'ABCD2345', activationCode: '000123' },
    { id: 'ZYXW9876', activationCode: '987654' },
  ]);
  envValues.CARD_URL_BASE = undefined;
});

describe('GET /admin/api/batches/{id}/export', () => {
  it('answers 404 for a non-UUID id without touching the session', async () => {
    const response = await GET(request(), ctx('abc'));
    expect(response.status).toBe(404);
    expect(auth.getCurrentAdmin).not.toHaveBeenCalled();
    expect(rateLimit.consume).not.toHaveBeenCalled();
  });

  it('answers 404 (not a redirect) without an admin, before the limiter and the database', async () => {
    auth.getCurrentAdmin.mockResolvedValue(null);
    const response = await GET(request(), ctx(batchId));
    expect(response.status).toBe(404);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(rateLimit.consume).not.toHaveBeenCalled();
    expect(platform.getBatchCsvRows).not.toHaveBeenCalled();
  });

  it('answers 429 with Retry-After past the admin action limit', async () => {
    rateLimit.consume.mockResolvedValue({ allowed: false, retryAfterSec: 37 });
    const response = await GET(request(), ctx(batchId));
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('37');
    expect(rateLimit.consume).toHaveBeenCalledWith(
      `rl:action:user:${admin.id}`,
      60,
      60,
    );
    expect(platform.getBatchCsvRows).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown batch', async () => {
    platform.getBatchCsvRows.mockResolvedValue(null);
    expect((await GET(request(), ctx(batchId))).status).toBe(404);
  });

  it('serves the CSV as an attachment, no-store, with APP_URL when CARD_URL_BASE is missing', async () => {
    const response = await GET(request(), ctx(batchId));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe(
      'text/csv; charset=utf-8',
    );
    expect(response.headers.get('Content-Disposition')).toBe(
      `attachment; filename="cards-${batchId}.csv"`,
    );
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    await expect(response.text()).resolves.toBe(
      'card_id,url,activation_code\r\n' +
        'ABCD2345,https://www.dcards-bg.com/c/ABCD2345,000123\r\n' +
        'ZYXW9876,https://www.dcards-bg.com/c/ZYXW9876,987654\r\n',
    );
    expect(platform.getBatchCsvRows).toHaveBeenCalledWith({}, batchId);
  });

  it('builds the URLs from CARD_URL_BASE when it is set', async () => {
    envValues.CARD_URL_BASE = 'https://dcrd.bg';
    const response = await GET(request(), ctx(batchId));
    const text = await response.text();
    expect(text).toContain('ABCD2345,https://dcrd.bg/c/ABCD2345,000123');
    expect(text).not.toContain('dcards-bg.com');
  });
});
