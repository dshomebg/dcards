import type { InputHTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';

import { cn } from '@/lib/cn';

import { FieldLabel } from './field-label';

type FieldProps = Readonly<
  InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    /** Живо число ДО надписа — виж `field-label.tsx`. */
    labelExtra?: ReactNode;
    /**
     * Скрива етикета ВИЗУАЛНО, без да го маха — за поле в ред на таблица
     * (`CAT-50` § 3.1). `relative` на обвивката идва с него по същата причина,
     * която е обяснена в `checkbox.tsx`: `sr-only` е `position: absolute`.
     */
    labelHidden?: boolean;
    error?: string;
    hint?: ReactNode;
    /**
     * ВИДИМ ред под контрола — за живо число, не за обяснение.
     *
     * „в момента се продава на 41,60 €" се мени, докато човекът пише; зад
     * иконка би се виждало само ако спре и посочи (`ADM-20`, 2026-08-13).
     */
    note?: ReactNode;
    /**
     * Мярката ВЪТРЕ в полето — знак на валута, „кг", „%".
     *
     * Стои тук, а не в етикета: „Основна цена (EUR, с ДДС)" се пренасяше на два
     * реда и разместваше реда от три полета (`ADM-19` § 3.4).
     */
    suffix?: string;
    /**
     * ⚠ Колкото СЪДЪРЖАНИЕТО, не колкото колоната. Правилото е записано в
     * `design.md` § 0 („пише се широко, избира се тясно"): поле за три цифри,
     * разпънато на половин екран, се уцелва по-трудно, не по-лесно.
     */
    width?: FieldWidth;
  }
>;

export type FieldWidth = 'short' | 'medium' | 'full';

/** Мерките са по СЪДЪРЖАНИЕ: число/код · дума-две · всичко останало. */
const WIDTHS: Record<FieldWidth, string> = {
  short: 'max-w-28',
  medium: 'max-w-64',
  full: '',
};

/**
 * Кои описания сочи контролът с `aria-describedby`.
 *
 * Извадено от компонента: всяко от четирите (грешка, подсказка, бележка, мярка)
 * добавяше по едно разклонение в него и мярката за сложност вече го хвана.
 */
function presentIds(
  parts: readonly (readonly [string, unknown])[],
): string | undefined {
  const ids = parts
    .filter(([, value]) => value !== undefined)
    .map(([id]) => id);
  return ids.length === 0 ? undefined : ids.join(' ');
}

/**
 * Поле с етикет и грешка. `htmlFor` свързва етикета (иначе четецът чете само
 * „текстово поле"), `aria-describedby` дава грешката за четене, `aria-invalid`
 * я съобщава и без цвят.
 */
export function Field({
  label,
  labelExtra,
  labelHidden = false,
  error,
  hint,
  note,
  suffix,
  width = 'full',
  className,
  ...props
}: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const noteId = `${id}-note`;

  const describedBy = presentIds([
    [errorId, error],
    [hintId, hint],
    [noteId, note],
  ]);

  return (
    // `gap-hint` е разстоянието „контрол ↔ собствения му текст". То е нарочно
    // ТРИ пъти по-малко от `gap-field` между две полета — иначе подсказката се
    // чете като заглавие на следващото поле (`design.md` § „Плътност").
    <div
      className={cn(
        'flex flex-col gap-hint',
        WIDTHS[width],
        labelHidden && 'relative',
      )}
    >
      <FieldLabel
        label={label}
        labelExtra={labelExtra}
        hint={hint}
        hintId={hintId}
        htmlFor={id}
        labelHidden={labelHidden}
      />

      {/* `relative` само когато има мярка — иначе всяко поле в админа става
          позициониран предшественик за чужди абсолютни деца. */}
      <div className={suffix === undefined ? undefined : 'relative'}>
        <input
          id={id}
          aria-invalid={error !== undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-control w-full rounded-(--radius-control) border bg-surface px-3 py-2 text-sm',
            'transition-colors placeholder:text-text-muted',
            // Стрелките на `type="number"` заемат точно мястото на мярката. При
            // стъпка 0.01 те и без това не се ползват — цена се набира, не се
            // щрака нагоре (`ADM-19` § 3.4).
            suffix === undefined
              ? ''
              : 'pe-10 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
            error !== undefined ? 'border-danger' : 'border-border',
            className,
          )}
          {...props}
        />

        {suffix !== undefined && (
          // `aria-hidden`: мярката вече е в етикета или в подсказката, а
          // прочетена втори път звучи като част от стойността.
          <span
            aria-hidden
            className="text-text-muted pointer-events-none absolute inset-y-0 end-3 flex items-center text-sm"
          >
            {suffix}
          </span>
        )}
      </div>

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
