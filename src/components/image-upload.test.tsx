import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ImageUpload, type UploadResult } from './image-upload';

const KEY = 'photos/00000000-0000-4000-8000-000000000000.webp';

function renderUpload(
  value: string | null,
  upload: (data: FormData) => Promise<UploadResult>,
  onRemove = vi.fn(),
) {
  render(
    <ImageUpload
      value={value}
      label="Снимка"
      shape="circle"
      upload={upload}
      onRemove={onRemove}
    />,
  );
}

const pick = (file: File) =>
  fireEvent.change(screen.getByLabelText('Снимка'), {
    target: { files: [file] },
  });

describe('ImageUpload', () => {
  it('sends the picked file as FormData and shows no message on success', async () => {
    const upload = vi.fn((_data: FormData): Promise<UploadResult> =>
      Promise.resolve({ ok: true, key: KEY }),
    );
    renderUpload(null, upload);
    pick(new File(['png'], 'me.png', { type: 'image/png' }));

    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    const data = upload.mock.calls[0]?.[0];
    expect(data).toBeInstanceOf(FormData);
    expect((data?.get('file') as File).name).toBe('me.png');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the server message on refusal and keeps the input', async () => {
    renderUpload(null, () =>
      Promise.resolve({
        ok: false,
        message: 'Приемат се само PNG, JPEG или WebP.',
      }),
    );
    pick(new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Приемат се само PNG, JPEG или WebP.',
    );
    expect(screen.getByLabelText('Снимка')).toBeTruthy();
  });

  it('stops a file over 2 MB before calling upload', () => {
    const upload = vi.fn();
    renderUpload(null, upload);
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.png', {
      type: 'image/png',
    });
    pick(big);
    expect(upload).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Файлът е до 2 MB.');
  });

  it('shows the stored image with the label as alt and removes on click', () => {
    const onRemove = vi.fn();
    renderUpload(KEY, vi.fn(), onRemove);
    const img = screen.getByRole<HTMLImageElement>('img', { name: 'Снимка' });
    expect(img.getAttribute('src')).toBe(`/api/uploads/${KEY}`);
    expect(img.className).toContain('rounded-full');
    fireEvent.click(screen.getByRole('button', { name: 'Премахни' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('hides a thrown upload behind a generic message', async () => {
    renderUpload(null, () => Promise.reject(new Error('boom')));
    pick(new File(['png'], 'me.png', { type: 'image/png' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Качването не мина — опитай пак след малко.',
    );
  });
});
