// Пари като цели числа в minor units (MON-1). Формата въвежда лева като низ;
// тук се превръща без float — `whole * 100 + fraction`.

const PRICE_INPUT = /^(-)?(\d{1,7})(?:[.,](\d{1,2}))?$/;

export interface ParsePriceOptions {
  readonly allowNegative?: boolean;
}

/** `'12,50'`/`'12.50'` → `1250`; невалидно (или отрицателно без разрешение) → `null`. */
export function parsePriceInput(
  raw: string,
  options: ParsePriceOptions = {},
): number | null {
  const match = PRICE_INPUT.exec(raw.trim());
  if (match === null) return null;
  const [, sign, whole = '0', fraction = ''] = match;
  if (sign === '-' && options.allowNegative !== true) return null;
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return sign === '-' ? -minor : minor;
}

/** Обратната на `parsePriceInput` — за стойност на поле, без `Intl`. */
export function formatPriceInput(minor: number): string {
  const abs = Math.abs(minor);
  const whole = Math.trunc(abs / 100);
  const fraction = String(abs % 100).padStart(2, '0');
  return `${minor < 0 ? '-' : ''}${whole}.${fraction}`;
}

export interface PriceFormat {
  readonly currency: string;
  readonly locale: string;
}

/** Само за показване; валутата и локалът идват от `env()` през извикващия. */
export function formatPrice(minor: number, format: PriceFormat): string {
  return new Intl.NumberFormat(format.locale, {
    style: 'currency',
    currency: format.currency,
  }).format(minor / 100);
}
