import { beforeEach, describe, expect, it, vi } from 'vitest';

const core = vi.hoisted(() => ({
  db: { execute: vi.fn() },
  redis: { ping: vi.fn() },
}));

vi.mock('@/modules/core', () => core);

const { GET } = await import('./route');

beforeEach(() => {
  core.db.execute.mockReset().mockResolvedValue([]);
  core.redis.ping.mockReset().mockResolvedValue('PONG');
});

describe('GET /api/health/ready', () => {
  it('is 200 when the database and Redis answer', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ready' });
  });

  it('is 503 without saying which component failed; the log says it', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    core.redis.ping.mockRejectedValue(new Error('down'));
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'degraded' });
    expect(error).toHaveBeenCalledWith('health: degraded', {
      database: true,
      redis: false,
    });
    error.mockRestore();
  });
});
