// CSV за писача на чипове и печатницата. RFC 4180: CRLF, без BOM; кавички не
// трябват — всяка стойност е от азбуката на id, URL или цифри.

import { cardUrl } from './card-url';

export interface CardCsvRow {
  readonly id: string;
  readonly activationCode: string;
}

export const CARDS_CSV_HEADER = 'card_id,url,activation_code';

export function buildCardsCsv(
  rows: readonly CardCsvRow[],
  base: string,
): string {
  const lines = rows.map(
    (row) => `${row.id},${cardUrl(base, row.id)},${row.activationCode}`,
  );
  return [CARDS_CSV_HEADER, ...lines].join('\r\n') + '\r\n';
}
