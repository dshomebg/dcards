import { fireEvent, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { Field } from '@/components/ui/field';
import { RadioGroup } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';

import { ProfilePreview } from './profile-preview';
import { type ProfileFormValues, THEME_OPTIONS, toFormValues } from './schema';
import { testProfile } from './test-fixtures';

// Превюто + минимум контроли, за да се провери живото обновяване без action.
function Harness() {
  const { control, register, watch, setValue } = useForm<ProfileFormValues>({
    defaultValues: toFormValues(testProfile()),
  });
  return (
    <>
      <Field label="Име" type="text" {...register('firstName')} />
      <Field label="Адрес" type="text" {...register('slug')} />
      <Switch label="Видим 1" {...register('links.0.isVisible')} />
      <RadioGroup
        label="Тема"
        value={watch('theme.preset')}
        options={THEME_OPTIONS}
        onChange={(value) => {
          setValue(
            'theme.preset',
            value as ProfileFormValues['theme']['preset'],
          );
        }}
      />
      <ProfilePreview
        control={control}
        slug="ivan-petrov"
        appName="DCARDS"
        appUrl="https://dcards.bg/"
      />
    </>
  );
}

const preview = () => screen.getByRole('complementary', { name: 'Превю' });

describe('ProfilePreview', () => {
  it('shows only visible links and follows typing', () => {
    render(<Harness />);
    const items = preview().querySelectorAll('li');
    expect(items).toHaveLength(2);
    expect(preview().textContent).not.toContain('ivan@demo.bg');

    fireEvent.input(screen.getByLabelText('Име'), {
      target: { value: 'Йоан' },
    });
    expect(preview().textContent).toContain('Йоан Петров');

    fireEvent.click(screen.getByLabelText('Видим 1'));
    expect(preview().querySelectorAll('li')).toHaveLength(1);
  });

  it('follows the theme choice', () => {
    render(<Harness />);
    const themed = () => preview().querySelector('[data-profile-theme]');
    expect(themed()?.getAttribute('data-profile-theme')).toBe('sand');
    fireEvent.click(screen.getByLabelText('Тъмна'));
    expect(themed()?.getAttribute('data-profile-theme')).toBe('dark');
  });

  it('keeps the saved slug while the address field changes; frame is inert', () => {
    render(<Harness />);
    fireEvent.input(screen.getByLabelText('Адрес'), {
      target: { value: 'nov-adres' },
    });
    const img = preview().querySelector('img');
    expect(img?.getAttribute('src')).toBe('/api/qr/ivan-petrov');
    expect(preview().querySelector('[inert]')).not.toBeNull();
  });
});
