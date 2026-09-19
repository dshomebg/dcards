import { describe, expect, it } from 'vitest';

import { tooltipPosition } from './tooltip-position';

const PANEL = { width: 288, height: 80 };
const VIEWPORT = { width: 1280, height: 800 };

describe('положението на подсказката', () => {
  it('застава под иконката, когато там има място', () => {
    const place = tooltipPosition(
      { top: 100, left: 400, bottom: 114 },
      PANEL,
      VIEWPORT,
    );

    expect(place).toEqual({ top: 120, left: 400 });
  });

  it('прескача НАД иконката, когато отдолу не се събира', () => {
    // Иконка на 40 пиксела от долния ръб: 746 + 6 + 80 + 8 надхвърля 800.
    const place = tooltipPosition(
      { top: 732, left: 400, bottom: 746 },
      PANEL,
      VIEWPORT,
    );

    expect(place.top).toBe(646);
  });

  it('прибира панела навътре, вместо да го изкара вдясно', () => {
    const place = tooltipPosition(
      { top: 100, left: 1200, bottom: 114 },
      PANEL,
      VIEWPORT,
    );

    // 1280 − 288 − 8. Иначе панелът щеше да започва на 1200 и да излезе с 216.
    expect(place.left).toBe(984);
  });

  it('не дава отрицателна позиция при панел, по-широк от прозореца', () => {
    const place = tooltipPosition(
      { top: 100, left: 4, bottom: 114 },
      { width: 400, height: 80 },
      { width: 390, height: 800 },
    );

    expect(place.left).toBe(8);
  });

  it('не изкарва панела над горния ръб при нисък прозорец', () => {
    // Нито отдолу се събира, нито отгоре има цели 80 пиксела.
    const place = tooltipPosition({ top: 20, left: 100, bottom: 34 }, PANEL, {
      width: 1280,
      height: 100,
    });

    expect(place.top).toBe(8);
  });
});
