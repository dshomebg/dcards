'use client';

import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { uploadUrl } from '@/lib/upload-url';

// Огледало на `IMAGE_MAX_BYTES` от `core` — клиентски компонент не внася barrel-а.
const MAX_BYTES = 2 * 1024 * 1024;
const TOO_LARGE = 'Файлът е до 2 MB.';
const DEFAULT_HINT = 'PNG, JPEG или WebP до 2 MB.';

export type UploadResult =
  | { readonly ok: true; readonly key: string }
  | { readonly ok: false; readonly message: string };

type Props = Readonly<{
  /** Ключ в storage-а или `null`; превюто идва от route-а — показва записаното. */
  value: string | null;
  label: string;
  hint?: string;
  shape: 'circle' | 'square';
  /** Извикващият пази ключа при успех; тук се показва само отказът. */
  upload: (formData: FormData) => Promise<UploadResult>;
  onRemove: () => void;
  error?: string;
}>;

const SHAPES = {
  circle: 'rounded-full object-cover',
  square: 'rounded-(--radius-control) object-contain',
} as const;

/** Файлът тръгва към сървъра при избор, не при „Запази". */
export function ImageUpload({
  value,
  label,
  hint = DEFAULT_HINT,
  shape,
  upload,
  onRemove,
  error,
}: Props) {
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
      const result = await upload(data);
      if (!result.ok) setMessage(result.message);
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
        {label}
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
            src={uploadUrl(value)}
            alt={label}
            width={64}
            height={64}
            className={cn('h-16 w-16 border border-border', SHAPES[shape])}
          />
          <Button variant="ghost" className="text-danger" onClick={onRemove}>
            Премахни
          </Button>
        </div>
      )}
      <p id={`${id}-hint`} className="text-text-muted text-xs">
        {uploading ? 'Качване…' : hint}
      </p>
      {shown !== undefined && (
        <p role="alert" className="text-danger text-xs">
          {shown}
        </p>
      )}
    </div>
  );
}
