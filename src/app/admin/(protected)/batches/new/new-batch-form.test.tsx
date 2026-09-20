import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createBatchAction = vi.hoisted(() => vi.fn());

vi.mock('../actions', () => ({ createBatchAction }));

const { NewBatchForm } = await import('./new-batch-form');

function fill(values: { name: string; quantity: string }) {
  fireEvent.input(screen.getByLabelText('Име'), {
    target: { value: values.name },
  });
  fireEvent.input(screen.getByLabelText('Брой карти'), {
    target: { value: values.quantity },
  });
  fireEvent.submit(screen.getByRole('button', { name: 'Създай партида' }));
}

describe('NewBatchForm', () => {
  beforeEach(() => createBatchAction.mockReset());

  it('stops 0, 1001 and an empty name before the action runs', async () => {
    render(<NewBatchForm />);
    fill({ name: 'Първа', quantity: '0' });
    expect(await screen.findByText(/от 1 до 1000/)).toBeTruthy();

    fill({ name: 'Първа', quantity: '1001' });
    expect(await screen.findByText(/от 1 до 1000/)).toBeTruthy();

    fill({ name: '', quantity: '20' });
    expect(await screen.findByText('Въведи име.')).toBeTruthy();
    expect(createBatchAction).not.toHaveBeenCalled();
  });

  it('sends a numeric quantity and shows the action message as an alert', async () => {
    createBatchAction.mockResolvedValue({
      ok: false,
      message: 'Не се намери свободен набор от id — опитай пак.',
    });
    render(<NewBatchForm />);
    fill({ name: 'Първа', quantity: '20' });

    await waitFor(() => expect(createBatchAction).toHaveBeenCalledTimes(1));
    expect(createBatchAction).toHaveBeenCalledWith({
      name: 'Първа',
      quantity: 20,
    });
    expect(screen.getByRole('alert').textContent).toBe(
      'Не се намери свободен набор от id — опитай пак.',
    );
  });
});
