import { describe, expect, it } from 'vitest';

import { safeNextPath } from './schema';

describe('safeNextPath', () => {
  it('accepts only a card path', () => {
    expect(safeNextPath('/c/ABCD2345')).toBe('/c/ABCD2345');
    expect(safeNextPath('/c/abcd23')).toBe('/c/abcd23');
  });

  it('accepts only an invite link with a 43-char token', () => {
    const token = 'A'.repeat(43);
    expect(safeNextPath(`/invite?token=${token}`)).toBe(
      `/invite?token=${token}`,
    );
    expect(safeNextPath('/invite')).toBeNull();
    expect(safeNextPath('/invite?token=short')).toBeNull();
    expect(safeNextPath(`/invite?token=${token}&x=1`)).toBeNull();
  });

  it('rejects external, protocol-relative and other internal paths', () => {
    expect(safeNextPath('https://evil.example')).toBeNull();
    expect(safeNextPath('//evil.example')).toBeNull();
    expect(safeNextPath('/app')).toBeNull();
    expect(safeNextPath('/c/x')).toBeNull();
    expect(safeNextPath('/c/ABCD2345/../../admin')).toBeNull();
    expect(safeNextPath('/c/ABCD2345?x=1')).toBeNull();
  });

  it('rejects non-strings', () => {
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(['/c/ABCD2345'])).toBeNull();
  });
});
