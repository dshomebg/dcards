import { useId } from 'react';

import { cn } from '@/lib/cn';

import { FieldLabel } from './field-label';

export interface RadioOption {
  readonly value: string;
  readonly label: string;
}

type Props = Readonly<{
  label: string;
  value: string;
  options: readonly RadioOption[];
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
}>;

/**
 * Избор от малко и равностойни стойности, показани всичките; при десет държави
 * е `Select`. Групата има `role="radiogroup"` и `aria-labelledby`: без тях
 * четецът обявява всяка стойност, без да каже на какво е.
 */
export function RadioGroup({
  label,
  value,
  options,
  onChange,
  error,
  hint,
}: Props) {
  const id = useId();
  const labelId = `${id}-label`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy =
    [error !== undefined ? errorId : null, hint !== undefined ? hintId : null]
      .filter((item): item is string => item !== null)
      .join(' ') || undefined;

  return (
    <div className="flex flex-col gap-hint">
      <FieldLabel label={label} hint={hint} hintId={hintId} labelId={labelId} />

      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        className="flex flex-wrap gap-x-4 gap-y-1"
      >
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'flex items-center gap-1.5 text-sm',
              // Изборът се вижда и без цвят — той не носи смисъла сам.
              option.value === value ? 'font-medium' : 'text-text-muted',
            )}
          >
            <input
              type="radio"
              name={id}
              value={option.value}
              checked={option.value === value}
              onChange={() => {
                onChange(option.value);
              }}
            />
            {option.label}
          </label>
        ))}
      </div>

      {error !== undefined && (
        <p id={errorId} role="alert" className="text-danger text-hint">
          {error}
        </p>
      )}
    </div>
  );
}
