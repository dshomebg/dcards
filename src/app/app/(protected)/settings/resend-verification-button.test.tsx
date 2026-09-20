import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const resendVerificationAction = vi.hoisted(() => vi.fn());

vi.mock('./actions', () => ({ resendVerificationAction }));

const { ResendVerificationButton } =
  await import('./resend-verification-button');

describe('ResendVerificationButton', () => {
  beforeEach(() => resendVerificationAction.mockReset());

  it('calls the action once and confirms the mail', async () => {
    resendVerificationAction.mockResolvedValue({ ok: true });
    render(<ResendVerificationButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Изпрати отново' }));

    expect((await screen.findByRole('status')).textContent).toBe(
      'Писмото е изпратено — провери пощата си.',
    );
    expect(resendVerificationAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the action message as an alert', async () => {
    resendVerificationAction.mockResolvedValue({
      ok: false,
      message: 'Имейлът вече е потвърден.',
    });
    render(<ResendVerificationButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Изпрати отново' }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'Имейлът вече е потвърден.',
      ),
    );
    expect(screen.queryByRole('status')).toBeNull();
  });
});
