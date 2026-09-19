/**
 * Чиста логика за адреса на списъчните екрани.
 *
 * Отделена от hook-а нарочно: правилата (курсорът пада при смяна на филтър,
 * пагинацията пази филтрите) са проверими с тест, без браузър и без React.
 */

export const CURSOR_PARAM = 'cursor';

/** `undefined` или празен низ маха ключа — иначе адресът се пълни с `search=`. */
export type ParamChanges = Readonly<Record<string, string | undefined>>;

/** Точно това, което Next подава в `searchParams`. */
export type RawParam = string | readonly string[] | undefined;

function firstValue(raw: RawParam): string | undefined {
  if (raw === undefined) return undefined;
  return typeof raw === 'string' ? raw : raw[0];
}

export function applyParams(
  current: URLSearchParams,
  changes: ParamChanges,
): URLSearchParams {
  const next = new URLSearchParams(current);

  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined || value === '') next.delete(key);
    else next.set(key, value);
  }

  return next;
}

/**
 * Смяна на филтър. Курсорът пада ВИНАГИ — иначе човек остава на страница 3 от
 * предишния резултат и вижда празен списък при съществуващи съвпадения.
 */
export function applyFilters(
  current: URLSearchParams,
  changes: ParamChanges,
): URLSearchParams {
  const next = applyParams(current, changes);
  next.delete(CURSOR_PARAM);
  return next;
}

export function buildHref(pathname: string, params: URLSearchParams): string {
  const query = params.toString();
  return query === '' ? pathname : `${pathname}?${query}`;
}

/**
 * Стойност от адреса е вход от непознат: неразпознатото се игнорира, вместо да
 * се строи заявка, за която вече знаем, че е невалидна.
 */
export function readOption<T extends string>(
  raw: RawParam,
  allowed: readonly T[],
): T | undefined {
  const value = firstValue(raw);
  if (value === undefined) return undefined;
  return (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

export function readText(raw: RawParam, maxLength = 200): string | undefined {
  const value = firstValue(raw)?.trim();
  if (value === undefined || value === '') return undefined;
  return value.slice(0, maxLength);
}
