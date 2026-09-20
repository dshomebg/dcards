import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const addToCartAction = vi.hoisted(() => vi.fn());
const uploadLogoAction = vi.hoisted(() => vi.fn());

vi.mock('../../cart/actions', () => ({ addToCartAction }));
vi.mock('../../cart/upload-actions', () => ({ uploadLogoAction }));

const { AddToCartForm } = await import('./add-to-cart-form');

const WHITE = '019969a0-0000-7000-8000-000000000001';
const BLACK = '019969a0-0000-7000-8000-000000000002';

const format = { currency: 'BGN', locale: 'bg-BG' };

const variants = [
  { id: WHITE, name: 'Бяла', price: 1990, inStock: true },
  { id: BLACK, name: 'Черна', price: 2240, inStock: false },
];

function submit(name: string, quantity = '2') {
  fireEvent.input(screen.getByLabelText('Име върху картата'), {
    target: { value: name },
  });
  fireEvent.input(screen.getByLabelText('Количество'), {
    target: { value: quantity },
  });
  fireEvent.submit(screen.getByRole('button', { name: 'Добави в количката' }));
}

beforeEach(() => {
  addToCartAction.mockReset();
  addToCartAction.mockResolvedValue({ ok: false, message: 'x' });
  uploadLogoAction.mockReset();
});

describe('AddToCartForm', () => {
  it('marks the exhausted variant and keeps it unselectable', () => {
    render(<AddToCartForm variants={variants} format={format} />);
    expect(screen.getByText('изчерпано')).toBeTruthy();
    const black = screen.getByRole<HTMLInputElement>('radio', {
      name: /Черна/,
    });
    expect(black.disabled).toBe(true);
    expect(
      screen.getByRole<HTMLInputElement>('radio', { name: /Бяла/ }).checked,
    ).toBe(true);
  });

  it('does not send when only an exhausted variant exists', async () => {
    render(
      <AddToCartForm
        variants={variants.filter((v) => !v.inStock)}
        format={format}
      />,
    );
    submit('Иван');
    expect(await screen.findByText('Избери вариант.')).toBeTruthy();
    expect(addToCartAction).not.toHaveBeenCalled();
  });

  it('stops an empty name and a bad quantity before the action', async () => {
    render(<AddToCartForm variants={variants} format={format} />);
    submit('', '21');
    expect(await screen.findByText('Името е задължително.')).toBeTruthy();
    expect(screen.getByText('Количеството е до 20.')).toBeTruthy();
    expect(addToCartAction).not.toHaveBeenCalled();
  });

  it('sends the folded line and shows the action message', async () => {
    addToCartAction.mockResolvedValue({
      ok: false,
      message: 'Този вариант вече не се предлага.',
    });
    render(<AddToCartForm variants={variants} format={format} />);
    submit('Иван Петров', '3');

    await waitFor(() => expect(addToCartAction).toHaveBeenCalledTimes(1));
    expect(addToCartAction).toHaveBeenCalledWith({
      variantId: WHITE,
      quantity: 3,
      personalization: {
        name: 'Иван Петров',
        title: null,
        notes: null,
        logoKey: null,
      },
    });
    expect(screen.getByRole('alert').textContent).toBe(
      'Този вариант вече не се предлага.',
    );
  });
});

describe('AddToCartForm — logo', () => {
  const KEY = 'logos/00000000-0000-4000-8000-000000000000.webp';

  function pick(file: File) {
    fireEvent.change(screen.getByLabelText(/Лого/), {
      target: { files: [file] },
    });
  }

  it('uploads on pick, shows the preview and sends the key with the line', async () => {
    uploadLogoAction.mockResolvedValue({ ok: true, key: KEY });
    render(<AddToCartForm variants={variants} format={format} />);
    pick(new File(['png'], 'logo.png', { type: 'image/png' }));

    const preview = await screen.findByRole<HTMLImageElement>('img', {
      name: 'Лого',
    });
    expect(preview.getAttribute('src')).toBe(`/api/uploads/${KEY}`);
    expect(uploadLogoAction).toHaveBeenCalledTimes(1);
    expect(uploadLogoAction.mock.calls[0]?.[0]).toBeInstanceOf(FormData);

    submit('Иван', '1');
    await waitFor(() => expect(addToCartAction).toHaveBeenCalledTimes(1));
    expect(addToCartAction.mock.calls[0]?.[0].personalization.logoKey).toBe(
      KEY,
    );
  });

  it('shows the upload message and keeps the line without a logo', async () => {
    uploadLogoAction.mockResolvedValue({
      ok: false,
      message: 'Приемат се само PNG, JPEG или WebP.',
    });
    render(<AddToCartForm variants={variants} format={format} />);
    pick(new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Приемат се само PNG, JPEG или WebP.',
    );
    expect(screen.queryByRole('img')).toBeNull();

    submit('Иван', '1');
    await waitFor(() => expect(addToCartAction).toHaveBeenCalledTimes(1));
    expect(
      addToCartAction.mock.calls[0]?.[0].personalization.logoKey,
    ).toBeNull();
  });

  it('"Премахни" clears the key and brings the file input back', async () => {
    uploadLogoAction.mockResolvedValue({ ok: true, key: KEY });
    render(<AddToCartForm variants={variants} format={format} />);
    pick(new File(['png'], 'logo.png', { type: 'image/png' }));
    await screen.findByRole('img', { name: 'Лого' });

    fireEvent.click(screen.getByRole('button', { name: 'Премахни' }));
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByLabelText(/Лого/)).toBeTruthy();

    submit('Иван', '1');
    await waitFor(() => expect(addToCartAction).toHaveBeenCalledTimes(1));
    expect(
      addToCartAction.mock.calls[0]?.[0].personalization.logoKey,
    ).toBeNull();
  });
});
