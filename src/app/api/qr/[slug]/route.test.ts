import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Platform from '@/modules/platform';

const rateLimit = vi.hoisted(() => ({
  consume: vi.fn(() => Promise.resolve({ allowed: true, retryAfterSec: 0 })),
}));
const platform = vi.hoisted(() => ({
  findPublicProfileBySlug: vi.fn(),
}));

// `core` отваря пул при импорт; политиката и IP helper-ът са истински.
vi.mock('@/modules/core', async () => ({
  db: {},
  env: () => ({ APP_URL: 'https://www.dcards-bg.com' }),
  rateLimit,
  ...(await vi.importActual('@/modules/core/rate-limit/policy')),
  ...(await vi.importActual('@/modules/core/rate-limit/client-ip')),
}));
vi.mock('@/modules/platform', async (importOriginal) => ({
  ...(await importOriginal<typeof Platform>()),
  ...platform,
}));

const { GET } = await import('./route');

const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });
const request = (headers: Record<string, string> = {}) =>
  new Request('http://localhost/api/qr/demo', { headers });

beforeEach(() => {
  rateLimit.consume.mockClear();
  rateLimit.consume.mockResolvedValue({ allowed: true, retryAfterSec: 0 });
  platform.findPublicProfileBySlug.mockReset().mockResolvedValue({
    slug: 'demo',
    firstName: 'Демо',
    lastName: 'Профил',
    title: null,
    company: null,
    bio: null,
    theme: { preset: 'light', primaryColor: null, layout: 'default' },
    links: [],
  });
});

describe('GET /api/qr/{slug}', () => {
  it('answers 404 for an invalid slug without touching the limiter', async () => {
    const response = await GET(request(), ctx('Ab'));
    expect(response.status).toBe(404);
    expect(rateLimit.consume).not.toHaveBeenCalled();
    expect(platform.findPublicProfileBySlug).not.toHaveBeenCalled();
  });

  it('counts by X-Real-IP in the shared api bucket and serves the SVG', async () => {
    const response = await GET(
      request({
        'x-real-ip': '203.0.113.9',
        'x-forwarded-for': '198.51.100.7',
      }),
      ctx('demo'),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400');
    expect(rateLimit.consume).toHaveBeenCalledWith(
      'rl:api:ip:203.0.113.9',
      60,
      60,
    );
  });

  it('falls into the "unknown" bucket without X-Real-IP', async () => {
    await GET(request(), ctx('demo'));
    expect(rateLimit.consume).toHaveBeenCalledWith('rl:api:ip:unknown', 60, 60);
  });

  it('answers 429 with Retry-After before the database once the limit is hit', async () => {
    rateLimit.consume.mockResolvedValue({ allowed: false, retryAfterSec: 37 });

    const response = await GET(
      request({ 'x-real-ip': '203.0.113.9' }),
      ctx('demo'),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('37');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.text()).resolves.toBe('Too many requests');
    expect(platform.findPublicProfileBySlug).not.toHaveBeenCalled();
  });
});
