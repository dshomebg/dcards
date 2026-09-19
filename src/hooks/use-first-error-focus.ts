'use client';

import { useEffect, useRef } from 'react';

/**
 * Мести фокуса в първото поле с грешка след неуспешно записване.
 *
 * Стъпва на `aria-invalid`, а не на имена на полета — така работи за всяка
 * форма, без образецът да знае кои полета съдържа тя.
 */
export function useFirstErrorFocus(errors: Readonly<Record<string, string[]>>) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (Object.keys(errors).length === 0) return;

    const invalid = ref.current?.querySelectorAll<HTMLElement>(
      '[aria-invalid="true"]',
    );
    // Само ВИДИМОТО поле. Екран с табове държи и скритите панели монтирани, а
    // `focus()` върху `display: none` не прави нищо — фокусът оставаше на
    // предишното място и изглеждаше, че поправката не е стигнала.
    [...(invalid ?? [])].find((field) => field.offsetParent !== null)?.focus();
  }, [errors]);

  return ref;
}
