import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const changePasswordAction = vi.hoisted(() => vi.fn());

// `schema.ts` минава през barrel-а на `auth`: `server-only` и `core` (пул, Redis).
vi.mock('server-only', () => ({}));
vi.mock('@/modules/core', () => ({ db: {}, redis: {}, env: () => ({}) }));
vi.mock('./actions', () => ({ changePasswordAction }));

const { ChangePasswordForm } = await import('./change-password-form');

const CURRENT = 'Текуща парола';
const NEXT = 'Нова парола';
const CONFIRM = 'Повтори новата парола';

function fill(values: { current: string; next: string; confirm: string }) {
  fireEvent.input(screen.getByLabelText(CURRENT), {
    target: { value: values.current },
  });
  fireEvent.input(screen.getByLabelText(NEXT), {
    target: { value: values.next },
  });
  fireEvent.input(screen.getByLabelText(CONFIRM), {
    target: { value: values.confirm },
  });
  fireEvent.submit(screen.getByRole('button', { name: 'Смени паролата' }));
}

const valid = {
  current: 'old-secret-1',
  next: 'new-secret-22',
  confirm: 'new-secret-22',
};

describe('ChangePasswordForm', () => {
  beforeEach(() => changePasswordAction.mockReset());

  it('stops a mismatched confirmation before the action runs', async () => {
    render(<ChangePasswordForm />);
    fill({ ...valid, confirm: 'nope' });

    expect(await screen.findByText('Паролите не съвпадат.')).toBeTruthy();
    expect(changePasswordAction).not.toHaveBeenCalled();
  });

  it('stops a new password equal to the current one', async () => {
    render(<ChangePasswordForm />);
    fill({
      current: 'same-secret-1',
      next: 'same-secret-1',
      confirm: 'same-secret-1',
    });

    expect(
      await screen.findByText(
        'Новата парола трябва да е различна от текущата.',
      ),
    ).toBeTruthy();
    expect(changePasswordAction).not.toHaveBeenCalled();
  });

  it('shows the action message as an alert', async () => {
    changePasswordAction.mockResolvedValue({
      ok: false,
      message: 'Текущата парола не е вярна.',
    });
    render(<ChangePasswordForm />);
    fill(valid);

    await waitFor(() => expect(changePasswordAction).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('alert').textContent).toBe(
      'Текущата парола не е вярна.',
    );
  });

  it('confirms the change and clears the fields', async () => {
    changePasswordAction.mockResolvedValue({ ok: true });
    render(<ChangePasswordForm />);
    fill(valid);

    expect((await screen.findByRole('status')).textContent).toBe(
      'Паролата е сменена.',
    );
    for (const label of [CURRENT, NEXT, CONFIRM]) {
      expect(screen.getByLabelText<HTMLInputElement>(label).value).toBe('');
    }
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
