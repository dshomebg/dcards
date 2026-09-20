import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { testProfile } from './test-fixtures';

const actions = vi.hoisted(() => ({
  saveProfileAction: vi.fn(),
  deleteProfileAction: vi.fn(),
}));

const imageActions = vi.hoisted(() => ({
  uploadProfileImageAction: vi.fn(),
  removeProfileImageAction: vi.fn(),
}));

vi.mock('./actions', () => actions);
vi.mock('./image-actions', () => imageActions);

const { ProfileEditor } = await import('./profile-editor');

const PHOTO = 'photos/00000000-0000-4000-8000-000000000000.webp';

const FREE = { customTheme: false, branding: true };
const PRO = { customTheme: true, branding: false };

const renderEditor = (profile = testProfile(), plan = FREE) =>
  render(
    <ProfileEditor
      profile={profile}
      plan={plan}
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
    imageActions.uploadProfileImageAction.mockReset();
    imageActions.removeProfileImageAction.mockReset();
  });

  it('renders the six sections with the DTO values', () => {
    renderEditor();
    for (const title of [
      'Снимка и лого',
      'Основни',
      'Адрес',
      'Тема',
      'Видимост',
      'Линкове',
    ]) {
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

describe('ProfileEditor — Pro theme', () => {
  const LOGO = 'logos/00000000-0000-4000-8000-000000000001.webp';
  const proTheme = {
    preset: 'sand',
    primaryColor: '#8b1e3f',
    logoBackground: true,
    layout: 'default',
  } as const;

  it('Free: colour and logo background are disabled with a Pro badge; preview is gated', () => {
    renderEditor(testProfile({ theme: proTheme, logoKey: LOGO }));
    expect(screen.getByText('Pro')).toBeTruthy();
    expect(
      screen.getByLabelText<HTMLInputElement>('Основен цвят').disabled,
    ).toBe(true);
    expect(
      screen.getByLabelText<HTMLInputElement>('Лого на фон').disabled,
    ).toBe(true);
    expect(screen.queryByRole('button', { name: 'Без цвят' })).toBeNull();

    const themed = screen
      .getByRole('complementary', { name: 'Превю' })
      .querySelector<HTMLElement>('[data-profile-theme]');
    expect(themed?.getAttribute('style')).toBeNull();
    expect(themed?.hasAttribute('data-profile-logo-bg')).toBe(false);
    expect(themed?.textContent).toContain('Създадено с');
  });

  it('Pro: the fields work, the preview follows the colour, no footer', () => {
    renderEditor(testProfile({ theme: proTheme, logoKey: LOGO }), PRO);
    expect(screen.queryByText('Pro')).toBeNull();
    const colour = screen.getByLabelText<HTMLInputElement>('Основен цвят');
    expect(colour.disabled).toBe(false);
    expect(colour.value).toBe('#8b1e3f');
    expect(
      screen.getByLabelText<HTMLInputElement>('Лого на фон').disabled,
    ).toBe(false);

    const themed = () =>
      screen
        .getByRole('complementary', { name: 'Превю' })
        .querySelector<HTMLElement>('[data-profile-theme]');
    expect(themed()?.style.getPropertyValue('--profile-accent')).toBe(
      '#8b1e3f',
    );
    expect(themed()?.hasAttribute('data-profile-logo-bg')).toBe(true);
    expect(themed()?.textContent).not.toContain('Създадено с');

    fireEvent.input(colour, { target: { value: '#ffd500' } });
    expect(themed()?.style.getPropertyValue('--profile-accent')).toBe(
      '#ffd500',
    );
    expect(themed()?.style.getPropertyValue('--profile-accent-ink')).toBe(
      'var(--color-ink)',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Без цвят' }));
    expect(themed()?.style.getPropertyValue('--profile-accent')).toBe('');
  });

  it('Pro without a logo: the logo switch is disabled', () => {
    renderEditor(testProfile(), PRO);
    expect(
      screen.getByLabelText<HTMLInputElement>('Лого на фон').disabled,
    ).toBe(true);
    expect(
      screen.getAllByText('Първо качи лого в „Снимка и лого".').length,
    ).toBeGreaterThan(0);
  });
});

describe('ProfileEditor — images', () => {
  beforeEach(() => {
    actions.saveProfileAction.mockReset();
    imageActions.uploadProfileImageAction.mockReset();
    imageActions.removeProfileImageAction.mockReset();
  });

  it('uploads the photo at once and shows it in the preview, outside „Запази"', async () => {
    imageActions.uploadProfileImageAction.mockResolvedValue({
      ok: true,
      key: PHOTO,
    });
    renderEditor();
    fireEvent.change(screen.getByLabelText('Снимка'), {
      target: { files: [new File(['png'], 'me.png', { type: 'image/png' })] },
    });

    await waitFor(() =>
      expect(imageActions.uploadProfileImageAction).toHaveBeenCalledWith(
        testProfile().id,
        'photo',
        expect.any(FormData),
      ),
    );
    const preview = screen.getByRole('complementary', { name: 'Превю' });
    expect(
      await waitFor(() =>
        preview.querySelector(`img[src="/api/uploads/${PHOTO}"]`),
      ),
    ).not.toBeNull();
    expect(actions.saveProfileAction).not.toHaveBeenCalled();
  });

  it('keeps the uploaded keys when „Запази" returns a DTO without them', async () => {
    imageActions.removeProfileImageAction.mockResolvedValue({ ok: true });
    actions.saveProfileAction.mockResolvedValue({
      ok: true,
      profile: testProfile({ logoKey: null }),
    });
    const LOGO = 'logos/00000000-0000-4000-8000-000000000001.webp';
    renderEditor(testProfile({ logoKey: LOGO }));
    const preview = screen.getByRole('complementary', { name: 'Превю' });
    expect(
      preview.querySelector(`img[src="/api/uploads/${LOGO}"]`),
    ).not.toBeNull();

    save();
    await screen.findByRole('status');
    expect(
      preview.querySelector(`img[src="/api/uploads/${LOGO}"]`),
    ).not.toBeNull();

    fireEvent.click(screen.getAllByRole('button', { name: 'Премахни' })[0]!);
    await waitFor(() =>
      expect(imageActions.removeProfileImageAction).toHaveBeenCalledWith(
        testProfile().id,
        'logo',
      ),
    );
    await waitFor(() =>
      expect(
        preview.querySelector(`img[src="/api/uploads/${LOGO}"]`),
      ).toBeNull(),
    );
  });
});
