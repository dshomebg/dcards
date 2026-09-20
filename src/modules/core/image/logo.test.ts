import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { LOGO_MAX_BYTES, LogoError, processLogo } from './logo';

function image(width: number, height: number, format: 'png' | 'jpeg' | 'gif') {
  const base = sharp({
    create: { width, height, channels: 3, background: '#4E6E7A' },
  });
  return base[format]().toBuffer();
}

async function codeOf(work: Promise<unknown>): Promise<string> {
  try {
    await work;
  } catch (error) {
    if (error instanceof LogoError) return error.code;
    throw error;
  }
  throw new Error('expected a LogoError');
}

describe('processLogo', () => {
  it('turns a large PNG into WebP with the long side at 256', async () => {
    const out = await processLogo(await image(1200, 800, 'png'));
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(256);
    expect(meta.height).toBe(171);
  });

  it('does not enlarge a small JPEG', async () => {
    const out = await processLogo(await image(100, 40, 'jpeg'));
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(40);
  });

  it('refuses SVG and GIF by their real format', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
    );
    expect(await codeOf(processLogo(svg))).toBe('unsupported');
    expect(await codeOf(processLogo(await image(10, 10, 'gif')))).toBe(
      'unsupported',
    );
  });

  it('refuses text posing as an image and an empty file', async () => {
    const html = Buffer.from('<html><script>alert(1)</script></html>');
    expect(await codeOf(processLogo(html))).toBe('unreadable');
    expect(await codeOf(processLogo(Buffer.alloc(0)))).toBe('unreadable');
  });

  it('refuses a pixel flood: tiny file, huge dimensions', async () => {
    // Едноцветен 6000×6000 PNG е ~35 KB, но 36 Mpx над тавана.
    const flood = await sharp({
      create: { width: 6000, height: 6000, channels: 3, background: '#fff' },
    })
      .png({ compressionLevel: 9 })
      .toBuffer();
    expect(flood.byteLength).toBeLessThan(2 * 1024 * 1024);
    await expect(processLogo(flood)).rejects.toMatchObject({
      code: 'too_large',
    });
  });

  it('refuses anything over 2 MB before decoding', async () => {
    const big = Buffer.alloc(LOGO_MAX_BYTES + 1);
    expect(await codeOf(processLogo(big))).toBe('too_large');
  });
});
