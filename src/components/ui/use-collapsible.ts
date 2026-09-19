'use client';

import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface Collapsible {
  readonly ref: RefObject<HTMLDivElement | null>;
  readonly collapsed: boolean;
  /** Има ли изобщо какво да се крие. Късо съдържание не показва бутон. */
  readonly overflows: boolean;
  readonly toggle: () => void;
}

/**
 * Свива дълго съдържание, докато човек не поиска да го види. Мерят се пиксели,
 * не редове — „пет реда" зависи от шрифт и ширина. Свиването е само НАЧАЛНО
 * състояние: автоматично свиване, докато някой пише, е най-лошото.
 */
export function useCollapsible(maxHeight: number): Collapsible {
  const ref = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(true);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (element === null) return;

    const measure = (): void => {
      setOverflows(element.scrollHeight > maxHeight);
    };

    measure();

    // Съдържанието расте, докато човек пише, а полето може да смени ширината си
    // при преоразмеряване на прозореца — и двете менят отговора.
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [maxHeight]);

  const toggle = useCallback(() => {
    setCollapsed((current) => !current);
  }, []);

  return { ref, collapsed: collapsed && overflows, overflows, toggle };
}
