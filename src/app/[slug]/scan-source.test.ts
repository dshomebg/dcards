import { describe, expect, it } from 'vitest';

import { scanSourceFor } from './scan-source';

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1';
const human = (extra: Record<string, string> = {}) =>
  new Headers({ 'user-agent': UA, ...extra });

describe('scanSourceFor', () => {
  it('maps the s parameter: qr, direct by default, nothing for nfc', () => {
    expect(scanSourceFor(human(), 'qr')).toBe('qr');
    expect(scanSourceFor(human(), undefined)).toBe('direct');
    expect(scanSourceFor(human(), 'anything')).toBe('direct');
    expect(scanSourceFor(human(), ['qr'])).toBeNull(); // крафтнат адрес
    // Cookie-то от `/c`: чипът вече е записан, отварянето не е „линк".
    expect(scanSourceFor(human(), undefined, true)).toBeNull();
    expect(scanSourceFor(human(), 'nfc')).toBe('direct'); // без cookie е обикновен линк
  });

  it('skips bots and missing agents', () => {
    expect(
      scanSourceFor(new Headers({ 'user-agent': 'Googlebot' }), 'qr'),
    ).toBeNull();
    expect(scanSourceFor(new Headers(), 'qr')).toBeNull();
  });

  it('skips router and browser prefetches', () => {
    expect(
      scanSourceFor(human({ 'next-router-prefetch': '1' }), 'qr'),
    ).toBeNull();
    expect(scanSourceFor(human({ purpose: 'prefetch' }), 'qr')).toBeNull();
    expect(
      scanSourceFor(human({ 'sec-purpose': 'prefetch;prerender' }), 'qr'),
    ).toBeNull();
  });
});
