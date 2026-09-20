import { fireEvent, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import {
  type ProductFormOutput,
  type ProductFormValues,
  toFormValues,
} from './schema';
import { testProduct } from './test-fixtures';
import { VariantsFields } from './variants-fields';

function Harness() {
  const form = useForm<ProductFormValues, unknown, ProductFormOutput>({
    defaultValues: toFormValues(testProduct()),
  });
  return <VariantsFields form={form} />;
}

const valueOf = (label: string) =>
  screen.getByLabelText<HTMLInputElement>(label).value;

describe('VariantsFields', () => {
  it('renders a row per variant with name, delta, sku, stock and active', () => {
    render(<Harness />);
    expect(valueOf('Вариант 1: име')).toBe('Бяла');
    expect(valueOf('Вариант 1: разлика в цената')).toBe('0.00');
    expect(valueOf('Вариант 1: SKU')).toBe('PVC-B');
    expect(valueOf('Вариант 1: наличност')).toBe('10');
    expect(valueOf('Вариант 2: разлика в цената')).toBe('2.50');
    expect(valueOf('Вариант 2: SKU')).toBe('');
    const switches = screen.getAllByRole<HTMLInputElement>('switch');
    expect(switches.map((s) => s.checked)).toEqual([true, false]);
  });

  it('adds a row without id and removes it', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Добави вариант' }));
    expect(valueOf('Вариант 3: разлика в цената')).toBe('0.00');

    fireEvent.click(screen.getAllByRole('button', { name: 'Премахни' })[2]!);
    expect(screen.queryByLabelText('Вариант 3: име')).toBeNull();
  });

  it('moves the first row down, swapping the two; edges are disabled', () => {
    render(<Harness />);
    const up1 = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Вариант 1: нагоре',
    });
    const down2 = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Вариант 2: надолу',
    });
    expect(up1.disabled).toBe(true);
    expect(down2.disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Вариант 1: надолу' }));
    expect(valueOf('Вариант 1: име')).toBe('Черна');
    expect(valueOf('Вариант 2: име')).toBe('Бяла');
  });
});
