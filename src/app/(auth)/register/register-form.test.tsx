import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Auth from '@/modules/auth';

const register = vi.hoisted(() => vi.fn());

// Barrel-ът на `auth` носи `server-only` и `core` (пул, Redis) — тук няма нито едно.
vi.mock('server-only', () => ({}));
vi.mock('@/modules/core', () => ({ db: {}, redis: {}, env: () => ({}) }));
vi.mock('@/modules/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof Auth>()),
  register,
}));

const { RegisterForm } = await import('./register-form');

function fill(values: { name: string; email: string; password: string }) {
  fireEvent.input(screen.getByLabelText('Име'), {
    target: { value: values.name },
  });
  fireEvent.input(screen.getByLabelText('Имейл'), {
    target: { value: values.email },
  });
  fireEvent.input(screen.getByLabelText('Парола'), {
    target: { value: values.password },
  });
  fireEvent.submit(screen.getByRole('button', { name: 'Регистрация' }));
}

describe('RegisterForm', () => {
  beforeEach(() => register.mockReset());

  it('stops a short password before the action runs', async () => {
    render(<RegisterForm />);
    fill({ name: 'Кирил', email: 'k@x.bg', password: 'short' });

    expect(
      await screen.findByText('Паролата трябва да е поне 8 знака.'),
    ).toBeTruthy();
    expect(register).not.toHaveBeenCalled();
  });

  it('shows the action message as an alert', async () => {
    register.mockResolvedValue({
      ok: false,
      message: 'Този имейл вече е регистриран.',
    });
    render(<RegisterForm />);
    fill({ name: 'Кирил', email: 'k@x.bg', password: 'correct-horse-1' });

    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('alert').textContent).toBe(
      'Този имейл вече е регистриран.',
    );
  });
});
