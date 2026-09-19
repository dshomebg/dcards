import { describe, expect, it } from 'vitest';

import {
  applyFilters,
  applyParams,
  buildHref,
  readOption,
  readText,
} from './query-params';

const STATUSES = ['draft', 'active', 'archived'] as const;

describe('applyFilters', () => {
  it('маха курсора при смяна на филтър', () => {
    const next = applyFilters(new URLSearchParams('cursor=abc&search=риза'), {
      search: 'пола',
    });

    expect(next.get('cursor')).toBeNull();
    expect(next.get('search')).toBe('пола');
  });

  it('маха курсора и когато филтърът се изчиства', () => {
    const next = applyFilters(new URLSearchParams('cursor=abc&status=active'), {
      status: '',
    });

    expect(next.toString()).toBe('');
  });

  it('пази останалите филтри', () => {
    const next = applyFilters(
      new URLSearchParams('search=риза&status=active'),
      {
        status: 'draft',
      },
    );

    expect(next.get('search')).toBe('риза');
    expect(next.get('status')).toBe('draft');
  });
});

describe('applyParams', () => {
  it('строи пълния адрес за следващата страница, не само курсора', () => {
    const next = applyParams(new URLSearchParams('search=риза&status=active'), {
      cursor: 'next-id',
    });

    expect(next.get('search')).toBe('риза');
    expect(next.get('status')).toBe('active');
    expect(next.get('cursor')).toBe('next-id');
  });

  it('маха ключ при празна стойност', () => {
    const next = applyParams(new URLSearchParams('search=риза'), {
      search: '',
    });

    expect(next.has('search')).toBe(false);
  });

  it('не променя подадения обект', () => {
    const current = new URLSearchParams('search=риза');
    applyParams(current, { status: 'active' });

    expect(current.has('status')).toBe(false);
  });
});

describe('buildHref', () => {
  it('връща само пътя при празни параметри', () => {
    expect(buildHref('/products', new URLSearchParams())).toBe('/products');
  });

  it('слепва пътя с въпросителна', () => {
    const href = buildHref('/products', new URLSearchParams('status=active'));
    expect(href).toBe('/products?status=active');
  });

  it('пълният адрес след прелистване носи и филтъра', () => {
    const href = buildHref(
      '/products',
      applyParams(new URLSearchParams('status=active'), { cursor: 'x' }),
    );

    expect(href).toBe('/products?status=active&cursor=x');
  });
});

describe('readOption', () => {
  it('приема разпозната стойност', () => {
    expect(readOption('active', STATUSES)).toBe('active');
  });

  it('игнорира неразпозната стойност от адреса', () => {
    expect(readOption('; DROP TABLE products', STATUSES)).toBeUndefined();
    expect(readOption('ACTIVE', STATUSES)).toBeUndefined();
  });

  it('взима първата стойност при повторен ключ', () => {
    expect(readOption(['draft', 'active'], STATUSES)).toBe('draft');
  });

  it('връща undefined при липсващ ключ', () => {
    expect(readOption(undefined, STATUSES)).toBeUndefined();
  });
});

describe('readText', () => {
  it('изрязва празнините', () => {
    expect(readText('  риза  ')).toBe('риза');
  });

  it('празният низ не е филтър', () => {
    expect(readText('   ')).toBeUndefined();
    expect(readText('')).toBeUndefined();
  });

  it('реже до горната граница', () => {
    expect(readText('a'.repeat(300))).toHaveLength(200);
  });
});
