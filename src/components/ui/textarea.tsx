import type { ReactNode, TextareaHTMLAttributes } from 'react';
import { useId } from 'react';

import { cn } from '@/lib/cn';

import { FieldLabel } from './field-label';

type TextareaProps = Readonly<
  TextareaHTMLAttributes<HTMLTextAreaElement> & {
    label: string;
    /** Живо число ДО надписа — виж `field-label.tsx`. */
    labelExtra?: ReactNode;
    error?: string;
    hint?: ReactNode;
    /** ВИДИМ ред под контрола — за живо число. Виж `field.tsx`. */
    note?: ReactNode;
  }
>;

/**
 * Многоредово поле — брат на `Field`, не негово разширение: `<input>` и
 * `<textarea>` не приемат едни и същи атрибути. Огледалният код за достъпност
 * е цената и се плаща съзнателно.
 */
export function Textarea({
  label,
  labelExtra,
  error,
  hint,
  note,
  className,
  rows = 4,
  ...props
}: TextareaProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const noteId = `${id}-note`;

  const describedBy =
    [
      error !== undefined ? errorId : null,
      hint !== undefined ? hintId : null,
      note !== undefined ? noteId : null,
    ]
      .filter((value): value is string => value !== null)
      .join(' ') || undefined;

  return (
    // Без `h-control`: височината тук е брой редове, не единна мярка.
    <div className="flex flex-col gap-hint">
      <FieldLabel
        label={label}
        labelExtra={labelExtra}
        hint={hint}
        hintId={hintId}
        htmlFor={id}
      />

      <textarea
        id={id}
        rows={rows}
        aria-invalid={error !== undefined}
        aria-describedby={describedBy}
        className={cn(
          'rounded-(--radius-control) border bg-surface px-3 py-2 text-sm',
          'transition-colors placeholder:text-text-muted',
          // Само вертикално: хоризонталното разтягане чупи подредбата на
          // формата, а нужното тук е повече редове, не по-широко поле.
          'resize-y',
          error !== undefined ? 'border-danger' : 'border-border',
          className,
        )}
        {...props}
      />

      {note !== undefined && (
        <p id={noteId} className="text-text-muted text-hint">
          {note}
        </p>
      )}

      {error !== undefined && (
        <p id={errorId} className="text-danger text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
