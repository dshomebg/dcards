/**
 * Етикетът на контрол заедно с подсказката му (`ADM-20`).
 *
 * Един компонент за седемте контрола, вместо седем копия: подсказката носи и
 * скрития абзац за екранния четец, а той е лесното нещо за забравяне.
 */

import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { Tooltip } from './tooltip';

type Props = Readonly<{
  label: string;
  /**
   * Живо число ДО надписа — брояч на знаци и подобни.
   *
   * Не в `note`: там то стои след прегледа „Сега ще излезе…" и се губи в края
   * на дълъг ред (`ADM-24`, искане на собственика 2026-08-16).
   */
  labelExtra?: ReactNode;
  hint?: ReactNode;
  /** Идва отвън, защото контролът го сочи с `aria-describedby`. */
  hintId: string;
  /** Подаден → истински `<label>`; иначе `<span>` за `aria-labelledby`. */
  htmlFor?: string;
  labelId?: string;
  labelHidden?: boolean;
  className?: string;
  onLabelClick?: () => void;
}>;

export function FieldLabel({
  label,
  labelExtra,
  hint,
  hintId,
  htmlFor,
  labelId,
  labelHidden = false,
  className,
  onLabelClick,
}: Props) {
  const text = cn(
    'text-label font-medium',
    labelHidden ? 'sr-only' : '',
    className,
  );

  const labelNode =
    htmlFor === undefined ? (
      <span id={labelId} className={text} onClick={onLabelClick}>
        {label}
      </span>
    ) : (
      <label htmlFor={htmlFor} className={text}>
        {label}
      </label>
    );

  // Без подсказка обвивката е ИЗЛИШНА, а не безобидна: при скрит етикет тя е
  // елемент с нулева ширина, който пак получава `gap` от реда с контрола и го
  // размества с осем пиксела (`ADM-20`, ревю 2026-08-13).
  if (hint === undefined && labelExtra === undefined) return labelNode;

  if (hint === undefined) {
    return (
      <div className="flex items-center gap-2">
        {labelNode}
        {labelExtra}
      </div>
    );
  }

  return (
    // `relative` е ЗАРАДИ скрития абзац: `sr-only` е `position: absolute` и без
    // позициониран предшественик излиза извън скролера и разпъва документа —
    // измерено при `CAT-35` (виж `checkbox.tsx`).
    <div className="relative flex items-center gap-1.5">
      {labelNode}

      <Tooltip label={`Какво е „${label}"`}>{hint}</Tooltip>

      {labelExtra}

      {/* Текстът остава достъпен ДОСЛОВНО както преди промяната: контролът
          продължава да го сочи с `aria-describedby`, а панелът горе е
          `aria-hidden`. Иначе скриването зад иконка би отнело описанието на
          полето от екранния четец (`ADM-20` § 3.2). */}
      <span id={hintId} className="sr-only">
        {hint}
      </span>
    </div>
  );
}
