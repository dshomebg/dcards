import sharp from 'sharp';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rateLimit = vi.hoisted(() => ({
  consume: vi.fn(() => Promise.resolve({ allowed: true, retryAfterSec: 0 })),
}));
const storage = vi.hoisted(() => ({ putObject: vi.fn() }));

// `core` отваря пул при импорт — sharp и ключовете са истински, дискът е mock.
vi.mock('@/modules/core', async () => ({
  rateLimit,
  ...storage,
  ...(await vi.importActual('@/modules/core/rate-limit/policy')),
  ...(await vi.importActual('@/modules/core/rate-limit/client-ip')),
  ...(await vi.importActual('@/modules/core/image/process')),
  createLogoKey: () => 'logos/00000000-0000-4000-8000-000000000000.webp',
}));
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(new Headers({ 'x-real-ip': '203.0.113.9' })),
}));

const { uploadLogoAction } = await import('./upload-actions');

async function png(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: '#A67C52' },
  })
    .png()
    .toBuffer();
}

function form(bytes: Uint8Array | Buffer, name: string, type: string) {
  const data = new FormData();
  data.set(
    'file',
    new File([bytes as Uint8Array<ArrayBuffer>], name, { type }),
  );
  return data;
}

beforeEach(() => {
  rateLimit.consume.mockClear();
  rateLimit.consume.mockResolvedValue({ allowed: true, retryAfterSec: 0 });
  storage.putObject.mockReset().mockResolvedValue(undefined);
});

describe('uploadLogoAction', () => {
  it('stores a resized WebP and returns the server-made key', async () => {
    const result = await uploadLogoAction(
      form(await png(1200, 800), 'logo.png', 'image/png'),
    );
    expect(result).toEqual({
      ok: true,
      key: 'logos/00000000-0000-4000-8000-000000000000.webp',
    });
    expect(rateLimit.consume).toHaveBeenCalledWith(
      'rl:upload:ip:203.0.113.9',
      10,
      3600,
    );
    const [key, data] = storage.putObject.mock.calls[0] as [string, Buffer];
    expect(key).toBe('logos/00000000-0000-4000-8000-000000000000.webp');
    const meta = await sharp(data).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(256);
  });

  it('refuses a missing or empty file before the limit', async () => {
    expect((await uploadLogoAction(new FormData())).ok).toBe(false);
    const empty = await uploadLogoAction(
      form(new Uint8Array(0), 'x.png', 'image/png'),
    );
    expect(empty.ok).toBe(false);
    expect(rateLimit.consume).not.toHaveBeenCalled();
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('refuses over 2 MB before the limit and writes nothing', async () => {
    const big = new Uint8Array(2 * 1024 * 1024 + 1);
    const result = await uploadLogoAction(form(big, 'big.png', 'image/png'));
    expect(result).toEqual({ ok: false, message: 'Файлът е до 2 MB.' });
    expect(rateLimit.consume).not.toHaveBeenCalled();
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('returns the limit message on the eleventh upload', async () => {
    rateLimit.consume.mockResolvedValue({
      allowed: false,
      retryAfterSec: 3600,
    });
    const result = await uploadLogoAction(
      form(await png(10, 10), 'logo.png', 'image/png'),
    );
    expect(result).toEqual({
      ok: false,
      message: 'Твърде много опити. Опитай след 60 минути.',
    });
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('judges by the bytes, not the name or MIME type', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>',
    );
    const html = Buffer.from('<html><script>alert(1)</script></html>');
    for (const bad of [
      form(svg, 'logo.png', 'image/png'),
      form(html, 'logo.png', 'image/png'),
    ]) {
      const result = await uploadLogoAction(bad);
      expect(result.ok).toBe(false);
    }
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('hides a disk failure behind a generic message', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    storage.putObject.mockRejectedValue(
      Object.assign(new Error('/srv/secret/path'), { code: 'EACCES' }),
    );
    const result = await uploadLogoAction(
      form(await png(10, 10), 'logo.png', 'image/png'),
    );
    expect(result.ok).toBe(false);
    expect(result.ok || result.message).not.toContain('/srv');
    expect(error).toHaveBeenCalledWith(
      'uploadLogoAction failed:',
      'Error',
      'EACCES',
    );
    error.mockRestore();
  });
});
