import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ScanChart } from './scan-chart';

const days = Array.from({ length: 30 }, (_, i) => ({
  day: `2026-09-${String(i + 1).padStart(2, '0')}`,
  count: i === 29 ? 7 : 0,
}));

describe('ScanChart', () => {
  it('renders one bar per day with an accessible summary', () => {
    const { container } = render(<ScanChart days={days} />);
    expect(container.querySelectorAll('rect')).toHaveLength(30);
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain(
      'най-много 7',
    );
    expect(container.querySelector('title')?.textContent).toContain(': 0');
  });

  it('stays flat at max 0 without NaN heights', () => {
    const flat = days.map((d) => ({ ...d, count: 0 }));
    const { container } = render(<ScanChart days={flat} />);
    for (const rect of container.querySelectorAll('rect')) {
      expect(rect.getAttribute('height')).toBe('2');
      expect(rect.getAttribute('y')).toBe('160');
    }
  });
});
