import type { InputHTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';

import { cn } from '@/lib/cn';

import { FieldLabel } from './field-label';

type CheckboxProps = Readonly<
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
    label: string;
    /**
     * Скрива етикета ВИЗУАЛНО, без да го маха — за отметка в ред на таблица.
     * `label` остава задължителен: отметка без достъпно име не се чете с четец.
     */
    labelHidden?: boolean;
    error?: string;
    hint?: ReactNode;
  }
>;

/**
 * Отметка — брат на `Field`, не негово разширение: държи се по `checked`, не по
 * `value`, а етикетът е ОТДЯСНО. Общ компонент би приел `type="text"` мълчаливо.
 */
export function Checkbox({
  label,
  labelHidden = false,
  error,
  hint,
  className,
  ...props
}: CheckboxProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy =
    [error !== undefined ? errorId : null, hint !== undefined ? hintId : null]
      .filter((value): value is string => value !== null)
      .join(' ') || undefined;

  return (
    /*
     * `relative` е ЗАРАДИ скрития етикет: `sr-only` е `position: absolute` и
     * без позициониран предшественик излиза ИЗВЪН скролера на обвивката и
     * разпъва целия документ — лепнатите ленти тогава рисуват върху съдържанието.
     */
    <div className="relative flex flex-col gap-hint">
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="checkbox"
          aria-invalid={error !== undefined}
          aria-describedby={describedBy}
          className={cn(
            'size-4 rounded-(--radius-control) border accent-brand',
            error !== undefined ? 'border-danger' : 'border-border',
            className,
          )}
          {...props}
        />

        <FieldLabel
          label={label}
          hint={hint}
          hintId={hintId}
          htmlFor={id}
          labelHidden={labelHidden}
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
