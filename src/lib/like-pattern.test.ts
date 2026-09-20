import { describe, expect, it } from 'vitest';

import { likePattern } from './like-pattern';

describe('likePattern', () => {
  it('wraps the query in wildcards', () => {
    expect(likePattern('ivan')).toBe('%ivan%');
    expect(likePattern('')).toBe('%%');
  });

  it('escapes %, _ and backslash so they match literally', () => {
    expect(likePattern('100%')).toBe('%100\\%%');
    expect(likePattern('a_b')).toBe('%a\\_b%');
    expect(likePattern('c\\d')).toBe('%c\\\\d%');
  });
});
