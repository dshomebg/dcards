import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const claimCardAction = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());

vi.mock('./actions', () => ({ claimCardAction }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { ClaimCardForm } = await import('./claim-card-form');

function fill(cardId: string, code: string) {
  fireEvent.input(screen.getByLabelText('Id на картата'), {
    target: { value: cardId },
  });
  fireEvent.input(screen.getByLabelText('Код'), { target: { value: code } });
  fireEvent.submit(screen.getByRole('button', { name: 'Добави карта' }));
}

describe('ClaimCardForm', () => {
  beforeEach(() => {
    claimCardAction.mockReset();
    refresh.mockReset();
  });

  it('stops a bad code before the action runs', async () => {
    render(<ClaimCardForm />);
    fill('ABCD2345', '12345');

    expect(await screen.findByText('Кодът е 6 цифри.')).toBeTruthy();
    expect(claimCardAction).not.toHaveBeenCalled();
  });

  it('shows the action message as an alert', async () => {
    claimCardAction.mockResolvedValue({
      ok: false,
      message: 'Картата или кодът не съвпадат.',
    });
    render(<ClaimCardForm />);
    fill('abcd2345', '000123');

    await waitFor(() => expect(claimCardAction).toHaveBeenCalledTimes(1));
    expect(claimCardAction).toHaveBeenCalledWith({
      cardId: 'ABCD2345',
      code: '000123',
    });
    expect(screen.getByRole('alert').textContent).toBe(
      'Картата или кодът не съвпадат.',
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it('refreshes the list and clears the form on success', async () => {
    claimCardAction.mockResolvedValue({ ok: true });
    render(<ClaimCardForm />);
    fill('ABCD2345', '000123');

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText<HTMLInputElement>('Id на картата').value).toBe(
      '',
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
