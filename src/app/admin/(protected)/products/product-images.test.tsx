import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PRODUCT_ID } from './test-fixtures';

const actions = vi.hoisted(() => ({
  uploadProductImageAction: vi.fn(),
  removeProductImageAction: vi.fn(),
  reorderProductImagesAction: vi.fn(),
}));

vi.mock('./image-actions', () => actions);

const { ProductImages } = await import('./product-images');

const key = (n: number) =>
  `products/00000000-0000-4000-8000-00000000000${n}.webp`;
const [A, B, C] = [key(1), key(2), key(3)];

beforeEach(() => {
  for (const action of Object.values(actions)) action.mockReset();
});

describe('ProductImages', () => {
  it('marks the first image as primary and disables the impossible moves', () => {
    render(<ProductImages productId={PRODUCT_ID} images={[A, B]} />);
    expect(screen.getAllByText('Основна')).toHaveLength(1);
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'Премести снимка 1 нагоре',
      }).disabled,
    ).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'Премести снимка 2 надолу',
      }).disabled,
    ).toBe(true);
    expect(screen.getByLabelText('Добави снимка')).toBeTruthy();
  });

  it('sends the full new order and shows what the server saved', async () => {
    actions.reorderProductImagesAction.mockResolvedValue({
      ok: true,
      images: [B, A, C],
    });
    render(<ProductImages productId={PRODUCT_ID} images={[A, B, C]} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Премести снимка 2 нагоре' }),
    );
    await waitFor(() =>
      expect(actions.reorderProductImagesAction).toHaveBeenCalledWith(
        PRODUCT_ID,
        [B, A, C],
      ),
    );
    await waitFor(() =>
      expect(screen.getAllByRole('img')[0]?.getAttribute('src')).toBe(
        `/api/uploads/${B}`,
      ),
    );
  });

  it('removes by key and shows the refusal', async () => {
    actions.removeProductImageAction.mockResolvedValue({
      ok: false,
      message: 'Снимката не принадлежи на този продукт.',
    });
    render(<ProductImages productId={PRODUCT_ID} images={[A]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Премахни' }));
    expect(
      await screen.findByText('Снимката не принадлежи на този продукт.'),
    ).toBeTruthy();
    expect(actions.removeProductImageAction).toHaveBeenCalledWith(
      PRODUCT_ID,
      A,
    );
  });

  it('hides the add slot at six images', () => {
    const six = [1, 2, 3, 4, 5, 6].map(key);
    render(<ProductImages productId={PRODUCT_ID} images={six} />);
    expect(screen.queryByLabelText('Добави снимка')).toBeNull();
  });
});
