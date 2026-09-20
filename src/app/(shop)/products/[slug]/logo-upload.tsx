'use client';

import { ImageUpload } from '@/components/image-upload';

import { uploadLogoAction } from '../../cart/upload-actions';

type Props = Readonly<{
  value: string | null;
  onChange: (key: string | null) => void;
  error?: string;
}>;

/** Формата пази само ключа; качването и превюто са в общия `ImageUpload`. */
export function LogoUpload({ value, onChange, error }: Props) {
  return (
    <ImageUpload
      value={value}
      label="Лого"
      hint="По избор. PNG, JPEG или WebP до 2 MB."
      shape="square"
      upload={async (data) => {
        const result = await uploadLogoAction(data);
        if (result.ok) onChange(result.key);
        return result;
      }}
      onRemove={() => onChange(null)}
      error={error}
    />
  );
}
