'use client';

import type { ReactNode } from 'react';
import { useId, useState } from 'react';

import { cn } from '@/lib/cn';

import { FieldLabel } from './field-label';
import type { SelectOption } from './select';

type SearchSelectProps = Readonly<{
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  /** Първата опция („— Без … —") остава винаги, каквото и да е търсено. */
  emptyOption?: SelectOption;
  searchPlaceholder?: string;
  error?: string;
  hint?: ReactNode;
}>;

/**
 * Падащо поле с търсене над него (`CAT-80`). Нарочно НАТИВЕН `<select>`,
 * стеснен от полето: клавиатура, четец и затваряне ги дава браузърът. Избраната
 * стойност остава в списъка и когато търсенето не я хваща (иначе се сменя тихо).
 */
export function SearchSelect({
  label,
  value,
  options,
  onChange,
  emptyOption,
  searchPlaceholder = 'Търси по име…',
  error,
  hint,
}: SearchSelectProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const [query, setQuery] = useState('');

  const needle = query.trim().toLocaleLowerCase('bg');
  const visible = options.filter(
    (option) =>
      option.value === value ||
      option.value === emptyOption?.value ||
      needle === '' ||
      option.label.toLocaleLowerCase('bg').includes(needle),
  );

  const describedBy =
    [error !== undefined ? errorId : null, hint !== undefined ? hintId : null]
      .filter((part): part is string => part !== null)
      .join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1">
      <FieldLabel label={label} htmlFor={id} hint={hint} hintId={hintId} />

      <input
        type="search"
        aria-label={`${label} — търсене`}
        placeholder={searchPlaceholder}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
        }}
        className="h-control w-full rounded-(--radius-control) border border-border bg-surface px-3 py-2 text-sm placeholder:text-text-muted"
      />

      <select
        id={id}
        value={value}
        aria-invalid={error !== undefined || undefined}
        aria-describedby={describedBy}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className={cn(
          'h-control w-full rounded-(--radius-control) border bg-surface px-3 py-2 text-sm',
          error === undefined ? 'border-border' : 'border-danger',
        )}
      >
        {emptyOption !== undefined && (
          <option value={emptyOption.value}>{emptyOption.label}</option>
        )}
        {visible
          .filter((option) => option.value !== emptyOption?.value)
          .map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
      </select>

      {error !== undefined && (
        <p id={errorId} className="text-danger text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
