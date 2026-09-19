import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createProfileAction = vi.hoisted(() => vi.fn());

vi.mock('./actions', () => ({ createProfileAction }));

const { NewProfileForm } = await import('./new-profile-form');

function fill(values: { firstName: string; lastName: string; slug: string }) {
  fireEvent.input(screen.getByLabelText('Име'), {
    target: { value: values.firstName },
  });
  fireEvent.input(screen.getByLabelText('Фамилия'), {
    target: { value: values.lastName },
  });
  fireEvent.input(screen.getByLabelText('Адрес'), {
    target: { value: values.slug },
  });
  fireEvent.submit(screen.getByRole('button', { name: 'Създай профил' }));
}

describe('NewProfileForm', () => {
  beforeEach(() => createProfileAction.mockReset());

  it('stops an invalid slug before the action runs', async () => {
    render(<NewProfileForm />);
    fill({ firstName: 'Кирил', lastName: 'Иванов', slug: 'Kiril' });

    expect(await screen.findByText(/малки латински букви/)).toBeTruthy();
    expect(createProfileAction).not.toHaveBeenCalled();
  });

  it('shows the action message as an alert', async () => {
    createProfileAction.mockResolvedValue({
      ok: false,
      message: 'Планът Free позволява един профил.',
    });
    render(<NewProfileForm />);
    fill({ firstName: 'Кирил', lastName: 'Иванов', slug: 'kiril' });

    await waitFor(() => expect(createProfileAction).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('alert').textContent).toBe(
      'Планът Free позволява един профил.',
    );
  });
});
