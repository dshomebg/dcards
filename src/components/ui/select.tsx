import type { ReactNode, SelectHTMLAttributes } from 'react';
import { useId } from 'react';

import { cn } from '@/lib/cn';

import type { FieldWidth } from './field';
import { FieldLabel } from './field-label';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

type SelectProps = Readonly<
  SelectHTMLAttributes<HTMLSelectElement> & {
    label: string;
    options: readonly SelectOption[];
    /** Скрит визуално етикет — същият договор като при `Field` и `Checkbox`. */
    labelHidden?: boolean;
    error?: string;
    hint?: ReactNode;
    /** Колкото съдържанието — виж `field.tsx`. */
    width?: FieldWidth;
  }
>;

/**
 * Списък за избор — брат на `Field`, не негово разширение: `<input>` и
 * `<select>` не приемат едни и същи атрибути.
 */
/** Същите мерки като при `Field` — виж бележката там. */
const SELECT_WIDTHS: Record<FieldWidth, string> = {
  short: 'max-w-48',
  medium: 'max-w-64',
  full: '',
};

export function Select({
  label,
  options,
  labelHidden = false,
  error,
  hint,
  width = 'full',
  className,
  ...props
}: SelectProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy =
    [error !== undefined ? errorId : null, hint !== undefined ? hintId : null]
      .filter((value): value is string => value !== null)
      .join(' ') || undefined;

  return (
    // `relative` при скрит етикет — виж същата бележка в `field.tsx`.
    <div
      className={cn(
        'flex flex-col gap-hint',
        SELECT_WIDTHS[width],
        labelHidden && 'relative',
      )}
    >
      <FieldLabel
        label={label}
        hint={hint}
        hintId={hintId}
        htmlFor={id}
        labelHidden={labelHidden}
      />

      <select
        id={id}
        aria-invalid={error !== undefined}
        aria-describedby={describedBy}
        className={cn(
          'h-control rounded-(--radius-control) border bg-surface px-3 py-2 text-sm',
          'transition-colors',
          error !== undefined ? 'border-danger' : 'border-border',
          className,
        )}
        {...props}
      >
        {options.map((option) => (
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
