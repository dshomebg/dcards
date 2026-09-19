import { describe, expect, it } from 'vitest';

import { renderQrSvg } from './qr';

describe('renderQrSvg', () => {
  it('returns an SVG document', async () => {
    const svg = await renderQrSvg('https://dcards.bg/demo');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('</svg>');
  });

  it('is deterministic and differs per url', async () => {
    const a = await renderQrSvg('https://dcards.bg/demo');
    const b = await renderQrSvg('https://dcards.bg/demo');
    const c = await renderQrSvg('https://dcards.bg/other');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
