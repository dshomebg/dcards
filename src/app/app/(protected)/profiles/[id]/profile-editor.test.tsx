import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { testProfile } from './test-fixtures';

const actions = vi.hoisted(() => ({
  saveProfileAction: vi.fn(),
  deleteProfileAction: vi.fn(),
}));

vi.mock('./actions', () => actions);

const { ProfileEditor } = await import('./profile-editor');

const renderEditor = () =>
  render(
    <ProfileEditor
      profile={testProfile()}
      appName="DCARDS"
      appUrl="https://dcards.bg/"
    />,
  );

const save = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Запази' }));

describe('ProfileEditor', () => {
  beforeEach(() => {
    actions.saveProfileAction.mockReset();
    actions.deleteProfileAction.mockReset();
  });

  it('renders the five sections with the DTO values', () => {
    renderEditor();
    for (const title of ['Основни', 'Адрес', 'Тема', 'Видимост', 'Линкове']) {
      expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    }
    expect(screen.getByRole('heading', { name: 'Опасна зона' })).toBeTruthy();

    expect(screen.getByLabelText<HTMLInputElement>('Име').value).toBe('Иван');
    expect(screen.getByLabelText<HTMLInputElement>('Длъжност').value).toBe(
      'Управител',
    );
    expect(
      screen.getByLabelText<HTMLTextAreaElement>('Кратко представяне').value,
    ).toBe('Здравей.');
    expect(screen.getByLabelText<HTMLInputElement>('Адрес').value).toBe(
      'ivan-petrov',
    );
    expect(screen.getByLabelText<HTMLInputElement>('Пясък').checked).toBe(true);
    expect(
      screen.getByLabelText<HTMLInputElement>('Публичен профил').checked,
    ).toBe(true);
    expect(
      screen.getByLabelText<HTMLInputElement>('Линк 2: етикет').value,
    ).toBe('Пиши ми');
    expect(screen.getAllByRole('switch', { name: 'Видим' })).toHaveLength(3);
  });

  it('stops an empty first name with a Zod message, without the action', async () => {
    renderEditor();
    fireEvent.input(screen.getByLabelText('Име'), { target: { value: '' } });
    save();

    expect(await screen.findByText('Въведи име.')).toBeTruthy();
    expect(actions.saveProfileAction).not.toHaveBeenCalled();
  });

  it('shows the action failure as an alert', async () => {
    actions.saveProfileAction.mockResolvedValue({
      ok: false,
      message: 'Планът Free позволява до 6 линка.',
    });
    renderEditor();
    save();

    await waitFor(() =>
      expect(actions.saveProfileAction).toHaveBeenCalledTimes(1),
    );
    expect(screen.getByRole('alert').textContent).toBe(
      'Планът Free позволява до 6 линка.',
    );
  });

  it('sends the whole profile with all links and resets to the returned DTO', async () => {
    const returned = testProfile({ firstName: 'Йоан', slug: 'yoan' });
    actions.saveProfileAction.mockResolvedValue({
      ok: true,
      profile: returned,
    });
    renderEditor();
    fireEvent.input(screen.getByLabelText('Име'), {
      target: { value: 'Йоан' },
    });
    save();

    await waitFor(() =>
      expect(actions.saveProfileAction).toHaveBeenCalledTimes(1),
    );
    const [id, values] = actions.saveProfileAction.mock.calls[0] as [
      string,
      { firstName: string; links: unknown[]; title: string },
    ];
    expect(id).toBe(returned.id);
    expect(values.firstName).toBe('Йоан');
    expect(values.links).toHaveLength(3);
    expect(values.title).toBe('Управител');

    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Име').value).toBe('Йоан');
    // Заглавието на страницата и името в превюто — и двете от новото DTO.
    expect(
      screen.getAllByRole('heading', { name: 'Йоан Петров' }),
    ).toHaveLength(2);
    expect(screen.getByText('Превю на /yoan')).toBeTruthy();
  });
});
