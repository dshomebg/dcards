import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ShareButton } from './share-button';

const url = 'https://dcards.bg/ivan-petrov';
const title = 'Иван Петров';

afterEach(() => vi.unstubAllGlobals());

describe('ShareButton', () => {
  it('uses Web Share when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share });
    render(<ShareButton url={url} title={title} />);
    fireEvent.click(screen.getByRole('button', { name: 'Сподели' }));
    await waitFor(() => expect(share).toHaveBeenCalledWith({ title, url }));
    expect(screen.queryByText(url)).toBeNull();
  });

  it('copies to the clipboard without Web Share', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<ShareButton url={url} title={title} />);
    fireEvent.click(screen.getByRole('button', { name: 'Сподели' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(url));
    expect(await screen.findByText('Копирано')).toBeTruthy();
  });

  it('shows the address as text when neither works', async () => {
    vi.stubGlobal('navigator', {});
    render(<ShareButton url={url} title={title} />);
    fireEvent.click(screen.getByRole('button', { name: 'Сподели' }));
    expect(await screen.findByText(url)).toBeTruthy();
  });
});
