import type { InputHTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';

import { cn } from '@/lib/cn';

import { FieldLabel } from './field-label';

type SwitchProps = Readonly<
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role'> & {
    label: string;
    error?: string;
    hint?: ReactNode;
  }
>;

/**
 * Плъзгач — брат на `Checkbox`. Отдолу е истинска отметка с `role="switch"`, не
 * `<button>`: клавиатура, състояние във форма и етикет идват наготово. Значи
 * „режим включен/изключен", не „включи в набора" — затова четецът чува `switch`.
 */
export function Switch({
  label,
  error,
  hint,
  className,
  ...props
}: SwitchProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy =
    [error !== undefined ? errorId : null, hint !== undefined ? hintId : null]
      .filter((value): value is string => value !== null)
      .join(' ') || undefined;

  return (
    <div className="flex flex-col gap-hint">
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="checkbox"
          role="switch"
          aria-invalid={error !== undefined}
          aria-describedby={describedBy}
          className={cn(
            // Пистата е самото поле (`appearance-none`), а палецът е
            // `::after` — без втори елемент, който да се разминава със
            // състоянието на входа.
            'relative h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full',
            'bg-border transition-colors checked:bg-brand',
            'after:absolute after:top-0.5 after:left-0.5 after:size-4',
            'after:rounded-full after:bg-surface after:transition-transform',
            'checked:after:translate-x-4',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error !== undefined && 'outline-2 outline-offset-2 outline-danger',
            className,
          )}
          {...props}
        />

        <FieldLabel
          label={label}
          hint={hint}
          hintId={hintId}
          htmlFor={id}
          className="cursor-pointer"
        />
      </div>

      {error !== undefined && (
        <p id={errorId} className="text-danger text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
