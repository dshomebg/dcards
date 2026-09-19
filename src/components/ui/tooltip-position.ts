/**
 * Къде да застане панелът на подсказката — чиста функция от три правоъгълника.
 *
 * Отделена от компонента, защото това е единственото в подсказката, което може
 * да се докаже машинно: админът е без DOM (`vitest.config.ts`), тоест отварянето
 * и затварянето се доказват само с око (`ADM-20` § 6).
 */

export interface AnchorRect {
  readonly top: number;
  readonly left: number;
  readonly bottom: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Placement {
  readonly top: number;
  readonly left: number;
}

/** Разстояние до иконката и най-малкото до ръба на прозореца. */
const GAP = 6;
const EDGE = 8;

/**
 * Панелът стои ПОД иконката, освен ако там не се събира — тогава отива над нея;
 * хоризонтално се подравнява по левия ѝ ръб и се прибира навътре при нужда.
 * Вътрешният `Math.max` пази панел, по-широк от прозореца, от отрицателна левица.
 */
export function tooltipPosition(
  anchor: AnchorRect,
  panel: Size,
  viewport: Size,
): Placement {
  const below = anchor.bottom + GAP;
  const fitsBelow = below + panel.height + EDGE <= viewport.height;

  return {
    top: fitsBelow ? below : Math.max(EDGE, anchor.top - GAP - panel.height),
    left: Math.min(
      Math.max(EDGE, anchor.left),
      Math.max(EDGE, viewport.width - panel.width - EDGE),
    ),
  };
}
