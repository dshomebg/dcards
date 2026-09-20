import { describe, expect, it } from 'vitest';

import { productFormSchema, toFormValues } from './schema';
import { testProduct } from './test-fixtures';

const values = toFormValues(testProduct());

describe('productFormSchema', () => {
  it('turns lev strings into minor units, keeps stock a number', () => {
    const parsed = productFormSchema.parse({
      ...values,
      basePrice: '19,90',
      variants: [
        { ...values.variants[0], priceDelta: '-2.50', stock: 3 },
        { ...values.variants[1], id: undefined },
      ],
    });
    expect(parsed.basePrice).toBe(1990);
    expect(parsed.variants.map((v) => v.priceDelta)).toEqual([-250, 250]);
    expect(parsed.variants[0]?.stock).toBe(3);
  });

  it('rejects a bad price with the human message; base price cannot be negative', () => {
    const bad = productFormSchema.safeParse({ ...values, basePrice: 'abc' });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.message).toBe('Цена като 12.50');
    expect(
      productFormSchema.safeParse({ ...values, basePrice: '-1' }).success,
    ).toBe(false);
    expect(
      productFormSchema.safeParse({ ...values, basePrice: '99999999' }).success,
    ).toBe(false);
  });

  it('rejects a bad slug, an empty name and a fractional stock', () => {
    expect(productFormSchema.safeParse({ ...values, slug: 'Ab' }).success).toBe(
      false,
    );
    expect(productFormSchema.safeParse({ ...values, name: ' ' }).success).toBe(
      false,
    );
    expect(
      productFormSchema.safeParse({
        ...values,
        variants: [{ ...values.variants[0], stock: 1.5 }],
      }).success,
    ).toBe(false);
  });
});

describe('toFormValues', () => {
  it('formats prices as strings and null → empty string', () => {
    expect(values.basePrice).toBe('19.90');
    expect(values.description).toBe('Класика.');
    expect(values.variants.map((v) => [v.id, v.priceDelta, v.sku])).toEqual([
      ['019969a0-0000-7000-8000-0000000000b1', '0.00', 'PVC-B'],
      ['019969a0-0000-7000-8000-0000000000b2', '2.50', ''],
    ]);
  });
});
