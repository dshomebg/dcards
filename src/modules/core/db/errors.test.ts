import { DrizzleQueryError } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import {
  isForeignKeyViolation,
  isUniqueViolation,
  uniqueViolationConstraint,
} from './errors';

const dbError = (code: string, constraint_name?: string) =>
  new DrizzleQueryError(
    'q',
    [],
    Object.assign(new Error('pg'), { code, constraint_name }),
  );

describe('db errors', () => {
  it('recognises 23505 with its constraint and 23503', () => {
    const unique = dbError('23505', 'products_slug_idx');
    expect(isUniqueViolation(unique)).toBe(true);
    expect(uniqueViolationConstraint(unique)).toBe('products_slug_idx');
    expect(isForeignKeyViolation(unique)).toBe(false);

    const fk = dbError(
      '23503',
      'order_items_variant_id_product_variants_id_fk',
    );
    expect(isForeignKeyViolation(fk)).toBe(true);
    expect(isUniqueViolation(fk)).toBe(false);
    expect(uniqueViolationConstraint(fk)).toBeNull();
  });

  it('ignores errors that are not from the driver', () => {
    expect(isForeignKeyViolation(new Error('x'))).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});
