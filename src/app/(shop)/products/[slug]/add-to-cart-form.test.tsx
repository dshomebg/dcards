import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const addToCartAction = vi.hoisted(() => vi.fn());

vi.mock('../../cart/actions', () => ({ addToCartAction }));

const { AddToCartForm } = await import('./add-to-cart-form');

const WHITE = '019969a0-0000-7000-8000-000000000001';
const BLACK = '019969a0-0000-7000-8000-000000000002';

const format = { currency: 'BGN', locale: 'bg-BG' };

const variants = [
  { id: WHITE, name: 'Бяла', price: 1990, inStock: true },
  { id: BLACK, name: 'Черна', price: 2240, inStock: false },
];

function submit(name: string, quantity = '2') {
  fireEvent.input(screen.getByLabelText('Име върху картата'), {
    target: { value: name },
  });
  fireEvent.input(screen.getByLabelText('Количество'), {
    target: { value: quantity },
  });
  fireEvent.submit(screen.getByRole('button', { name: 'Добави в количката' }));
}

describe('AddToCartForm', () => {
  beforeEach(() => {
    addToCartAction.mockReset();
    addToCartAction.mockResolvedValue({ ok: false, message: 'x' });
  });

  it('marks the exhausted variant and keeps it unselectable', () => {
    render(<AddToCartForm variants={variants} format={format} />);
    expect(screen.getByText('изчерпано')).toBeTruthy();
    const black = screen.getByRole<HTMLInputElement>('radio', {
      name: /Черна/,
    });
    expect(black.disabled).toBe(true);
    expect(
      screen.getByRole<HTMLInputElement>('radio', { name: /Бяла/ }).checked,
    ).toBe(true);
  });

  it('does not send when only an exhausted variant exists', async () => {
    render(
      <AddToCartForm
        variants={variants.filter((v) => !v.inStock)}
        format={format}
      />,
    );
    submit('Иван');
    expect(await screen.findByText('Избери вариант.')).toBeTruthy();
    expect(addToCartAction).not.toHaveBeenCalled();
  });

  it('stops an empty name and a bad quantity before the action', async () => {
    render(<AddToCartForm variants={variants} format={format} />);
    submit('', '21');
    expect(await screen.findByText('Името е задължително.')).toBeTruthy();
    expect(screen.getByText('Количеството е до 20.')).toBeTruthy();
    expect(addToCartAction).not.toHaveBeenCalled();
  });

  it('sends the folded line and shows the action message', async () => {
    addToCartAction.mockResolvedValue({
      ok: false,
      message: 'Този вариант вече не се предлага.',
    });
    render(<AddToCartForm variants={variants} format={format} />);
    submit('Иван Петров', '3');

    await waitFor(() => expect(addToCartAction).toHaveBeenCalledTimes(1));
    expect(addToCartAction).toHaveBeenCalledWith({
      variantId: WHITE,
      quantity: 3,
      personalization: { name: 'Иван Петров', title: null, notes: null },
    });
    expect(screen.getByRole('alert').textContent).toBe(
      'Този вариант вече не се предлага.',
    );
  });
});
