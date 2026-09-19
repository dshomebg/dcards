'use client';

export interface ChipOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

type ChipGroupProps<T extends string> = Readonly<{
  /** Името на групата — за четеца; на екрана го казва полето отгоре. */
  label: string;
  options: readonly ChipOption<T>[];
  selected: readonly T[];
  onToggle: (value: T) => void;
}>;

const CHIP =
  'rounded-full border px-3 py-1 text-xs font-medium transition-colors ' +
  'aria-pressed:border-brand aria-pressed:bg-brand-subtle aria-pressed:text-brand ' +
  'border-border bg-surface hover:bg-surface-muted';

/**
 * Чипове с множествен избор. Бутони с `aria-pressed`, не отметки: избраното
 * се чете по цвят И по състояние, а редът им е редът на подадените опции.
 */
export function ChipGroup<T extends string>({
  label,
  options,
  selected,
  onToggle,
}: ChipGroupProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={selected.includes(option.value)}
          onClick={() => {
            onToggle(option.value);
          }}
          className={CHIP}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
