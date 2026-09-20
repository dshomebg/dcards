import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const activateFromChipAction = vi.hoisted(() => vi.fn());

vi.mock('@/app/app/(protected)/cards/actions', () => ({
  activateFromChipAction,
}));

const { ActivateForm } = await import('./activate-form');

const profiles = [
  { id: 'p1', name: 'Иван Петров' },
  { id: 'p2', name: 'Мария Иванова' },
];

describe('ActivateForm', () => {
  beforeEach(() => activateFromChipAction.mockReset());

  it('activates the chosen profile for the card', async () => {
    // При успех action-ът пренасочва (хвърля); тук връща само отказ.
    activateFromChipAction.mockResolvedValue({ ok: false, message: 'x' });
    render(<ActivateForm cardId="ABCD2345" profiles={profiles} />);

    fireEvent.change(screen.getByLabelText('Профил'), {
      target: { value: 'p2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Активирай' }));

    await waitFor(() =>
      expect(activateFromChipAction).toHaveBeenCalledWith('ABCD2345', 'p2'),
    );
    expect(screen.getByRole('alert').textContent).toBe('x');
  });

  it('offers only a new profile when the org has none', () => {
    render(<ActivateForm cardId="ABCD2345" profiles={[]} />);

    expect(screen.queryByRole('button', { name: 'Активирай' })).toBeNull();
    expect(
      screen.getByRole('link', { name: 'Нов профил' }).getAttribute('href'),
    ).toBe('/app/profiles/new?card=ABCD2345');
  });
});
