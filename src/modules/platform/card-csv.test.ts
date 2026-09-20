import { describe, expect, it } from 'vitest';

import { buildCardsCsv } from './card-csv';
import { cardUrl } from './card-url';

describe('cardUrl', () => {
  it('appends /c/{id} and tolerates a trailing slash', () => {
    expect(cardUrl('https://dcrd.bg', 'ABCD2345')).toBe(
      'https://dcrd.bg/c/ABCD2345',
    );
    expect(cardUrl('https://dcrd.bg/', 'ABCD2345')).toBe(
      'https://dcrd.bg/c/ABCD2345',
    );
  });
});

describe('buildCardsCsv', () => {
  it('writes the header, CRLF line ends, no BOM, no quotes, codes with leading zeros', () => {
    const csv = buildCardsCsv(
      [
        { id: 'ABCD2345', activationCode: '000123' },
        { id: 'ZYXW9876', activationCode: '987654' },
      ],
      'https://dcrd.bg',
    );
    expect(csv).toBe(
      'card_id,url,activation_code\r\n' +
        'ABCD2345,https://dcrd.bg/c/ABCD2345,000123\r\n' +
        'ZYXW9876,https://dcrd.bg/c/ZYXW9876,987654\r\n',
    );
    expect(csv.charCodeAt(0)).not.toBe(0xfeff);
    expect(csv).not.toContain('"');
    expect(csv).not.toMatch(/[^\r]\n/);
  });

  it('is only the header for an empty batch', () => {
    expect(buildCardsCsv([], 'https://x.bg')).toBe(
      'card_id,url,activation_code\r\n',
    );
  });
});
