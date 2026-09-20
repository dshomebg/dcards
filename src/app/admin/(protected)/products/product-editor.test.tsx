import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PRODUCT_ID, testProduct } from './test-fixtures';

const actions = vi.hoisted(() => ({
  createProductAction: vi.fn(),
  saveProductAction: vi.fn(),
  deleteProductAction: vi.fn(),
}));

vi.mock('./actions', () => actions);

const { ProductEditor } = await import('./product-editor');

const renderEdit = () =>
  render(<ProductEditor mode="edit" product={testProduct()} currency="BGN" />);

const submit = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name }));

describe('ProductEditor', () => {
  beforeEach(() => {
    actions.createProductAction.mockReset();
    actions.saveProductAction.mockReset();
    actions.deleteProductAction.mockReset();
  });

  it('renders the sections with the DTO values in edit mode', () => {
    renderEdit();
    for (const title of [
      'Основни',
      'Цена и материал',
      'Видимост',
      'Варианти',
    ]) {
      expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    }
    expect(screen.getByRole('heading', { name: 'Опасна зона' })).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Име').value).toBe(
      'PVC Classic',
    );
    expect(screen.getByLabelText<HTMLInputElement>('Адрес').value).toBe(
      'pvc-classic',
    );
    expect(screen.getByLabelText<HTMLInputElement>('Базова цена').value).toBe(
      '19.90',
    );
    expect(screen.getByLabelText<HTMLSelectElement>('Материал').value).toBe(
      'pvc',
    );
    expect(
      screen.getByLabelText<HTMLInputElement>('Активен продукт').checked,
    ).toBe(true);
    expect(
      screen.getByLabelText<HTMLInputElement>('Вариант 2: име').value,
    ).toBe('Черна');
  });

  it('create mode: no danger zone, sends the raw form to createProductAction', async () => {
    actions.createProductAction.mockResolvedValue({
      ok: false,
      message: 'Този адрес вече е зает от друг продукт.',
    });
    render(<ProductEditor mode="create" currency="BGN" />);
    expect(screen.queryByRole('heading', { name: 'Опасна зона' })).toBeNull();

    fireEvent.input(screen.getByLabelText('Име'), { target: { value: 'Нов' } });
    fireEvent.input(screen.getByLabelText('Адрес'), {
      target: { value: 'nov' },
    });
    fireEvent.input(screen.getByLabelText('Базова цена'), {
      target: { value: '19,90' },
    });
    submit('Създай');

    await waitFor(() =>
      expect(actions.createProductAction).toHaveBeenCalledTimes(1),
    );
    const [values] = actions.createProductAction.mock.calls[0] as [
      { basePrice: string; slug: string },
    ];
    expect(values).toMatchObject({ slug: 'nov', basePrice: '19,90' });
    expect(screen.getByRole('alert').textContent).toBe(
      'Този адрес вече е зает от друг продукт.',
    );
  });

  it('stops a bad price with the Zod message, without the action', async () => {
    renderEdit();
    fireEvent.input(screen.getByLabelText('Базова цена'), {
      target: { value: 'abc' },
    });
    submit('Запази');

    expect(await screen.findByText('Цена като 12.50')).toBeTruthy();
    expect(actions.saveProductAction).not.toHaveBeenCalled();
  });

  it('sends the whole product with variants and resets to the returned DTO', async () => {
    const returned = testProduct({ name: 'PVC Neo', basePrice: 2500 });
    actions.saveProductAction.mockResolvedValue({
      ok: true,
      product: returned,
    });
    renderEdit();
    fireEvent.input(screen.getByLabelText('Име'), {
      target: { value: 'PVC Neo' },
    });
    submit('Запази');

    await waitFor(() =>
      expect(actions.saveProductAction).toHaveBeenCalledTimes(1),
    );
    const [id, values] = actions.saveProductAction.mock.calls[0] as [
      string,
      { name: string; basePrice: string; variants: { id?: string }[] },
    ];
    expect(id).toBe(PRODUCT_ID);
    expect(values.name).toBe('PVC Neo');
    expect(values.basePrice).toBe('19.90');
    expect(values.variants.map((v) => v.id)).toEqual([
      '019969a0-0000-7000-8000-0000000000b1',
      '019969a0-0000-7000-8000-0000000000b2',
    ]);

    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Базова цена').value).toBe(
      '25.00',
    );
    expect(screen.getByRole('heading', { name: 'PVC Neo' })).toBeTruthy();
  });
});
