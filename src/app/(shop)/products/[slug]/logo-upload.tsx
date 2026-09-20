'use client';

import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { logoUrl } from '@/lib/logo-url';

import { uploadLogoAction } from '../../cart/upload-actions';

// Огледало на `LOGO_MAX_BYTES` от `core` — клиентски компонент не внася barrel-а.
const MAX_BYTES = 2 * 1024 * 1024;
const TOO_LARGE = 'Файлът е до 2 MB.';

type Props = Readonly<{
  value: string | null;
  onChange: (key: string | null) => void;
  error?: string;
}>;

/**
 * Файлът тръгва към сървъра при избор, не при „Добави": формата пази само
 * ключа. Превюто идва от route-а, така че показва точно записаното.
 */
export function LogoUpload({ value, onChange, error }: Props) {
  const id = useId();
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onFile = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = '';
    if (file === undefined) return;
    setMessage(null);
    // Над тавана транспортът отказва преди action-а — без отговор, без съобщение.
    if (file.size > MAX_BYTES) {
      setMessage(TOO_LARGE);
      return;
    }
    setUploading(true);
    const data = new FormData();
    data.set('file', file);
    try {
      const result = await uploadLogoAction(data);
      if (result.ok) onChange(result.key);
      else setMessage(result.message);
    } catch {
      setMessage('Качването не мина — опитай пак след малко.');
    } finally {
      setUploading(false);
    }
  };

  const shown = message ?? error;

  return (
    <div className="flex flex-col gap-hint">
      <label htmlFor={id} className="text-label font-medium">
        Лого <span className="text-text-muted font-normal">(по избор)</span>
      </label>
      {value === null ? (
        <input
          id={id}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={uploading}
          aria-describedby={`${id}-hint`}
          onChange={(event) => void onFile(event.currentTarget)}
          className="text-sm file:me-3 file:rounded-(--radius-control) file:border file:border-border file:bg-surface file:px-3 file:py-1"
        />
      ) : (
        <div className="flex items-center gap-field">
          <img
            src={logoUrl(value)}
            alt="Качено лого"
            width={64}
            height={64}
            className="h-16 w-16 rounded-(--radius-control) border border-border object-contain"
          />
          <Button
            variant="ghost"
            className="text-danger"
            onClick={() => onChange(null)}
          >
            Премахни
          </Button>
        </div>
      )}
      <p id={`${id}-hint`} className="text-text-muted text-xs">
        {uploading ? 'Качване…' : 'PNG, JPEG или WebP до 2 MB.'}
      </p>
      {shown !== undefined && (
        <p role="alert" className="text-danger text-xs">
          {shown}
        </p>
      )}
    </div>
  );
}
