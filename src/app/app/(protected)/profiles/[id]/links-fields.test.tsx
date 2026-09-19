import { fireEvent, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { LinksFields } from './links-fields';
import { type ProfileFormValues, toFormValues } from './schema';
import { testProfile } from './test-fixtures';

function Harness() {
  const form = useForm<ProfileFormValues>({
    defaultValues: toFormValues(testProfile()),
  });
  return <LinksFields form={form} />;
}

const valueOf = (label: string) =>
  screen.getByLabelText<HTMLInputElement>(label).value;

describe('LinksFields', () => {
  it('renders a row per link with type, label, value and visibility', () => {
    render(<Harness />);
    expect(screen.getByLabelText<HTMLSelectElement>('Линк 1: тип').value).toBe(
      'phone',
    );
    expect(valueOf('Линк 1: стойност')).toBe('+359881234567');
    expect(
      screen.getByLabelText('Линк 1: етикет').getAttribute('placeholder'),
    ).toBe('Телефон');
    expect(valueOf('Линк 2: етикет')).toBe('Пиши ми');
    const switches = screen.getAllByRole<HTMLInputElement>('switch');
    expect(switches.map((s) => s.checked)).toEqual([true, false, true]);
  });

  it('adds a row and removes it', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Добави линк' }));
    expect(screen.getByLabelText('Линк 4: стойност')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Премахни' })[3]!);
    expect(screen.queryByLabelText('Линк 4: стойност')).toBeNull();
  });

  it('moves the first row down, swapping the two; edges are disabled', () => {
    render(<Harness />);
    const up1 = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Линк 1: нагоре',
    });
    const down3 = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Линк 3: надолу',
    });
    expect(up1.disabled).toBe(true);
    expect(down3.disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Линк 1: надолу' }));
    expect(valueOf('Линк 1: стойност')).toBe('ivan@demo.bg');
    expect(valueOf('Линк 2: стойност')).toBe('+359881234567');
  });
});
