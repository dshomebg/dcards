import { describe, expect, it } from 'vitest';

import { clientIpFrom } from './client-ip';

describe('clientIpFrom', () => {
  it('reads and trims x-real-ip', () => {
    const headers = new Headers({ 'x-real-ip': ' 203.0.113.9 ' });
    expect(clientIpFrom(headers)).toBe('203.0.113.9');
  });

  it('falls back to "unknown" when the header is missing or empty', () => {
    expect(clientIpFrom(new Headers())).toBe('unknown');
    expect(clientIpFrom(new Headers({ 'x-real-ip': '   ' }))).toBe('unknown');
  });

  it('ignores x-forwarded-for entirely', () => {
    const headers = new Headers({
      'x-forwarded-for': '198.51.100.1, 10.0.0.1',
    });
    expect(clientIpFrom(headers)).toBe('unknown');

    headers.set('x-real-ip', '203.0.113.9');
    expect(clientIpFrom(headers)).toBe('203.0.113.9');
  });
});
