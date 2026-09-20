// Номерът на поръчката: `DC-YYYY-NNNNNN`. Годината е от момента на поръчката,
// поредният номер е от глобален sequence — не се нулира по година.

import { z } from 'zod';

export const ORDER_NUMBER_PATTERN = /^DC-\d{4}-\d{6}$/;

export const orderNumberSchema = z.string().regex(ORDER_NUMBER_PATTERN);

/** `lpad` до 6; над 999999 просто расте — уникалността я пази индексът. */
export function formatOrderNumber(year: number, seq: number): string {
  return `DC-${String(year)}-${String(seq).padStart(6, '0')}`;
}
