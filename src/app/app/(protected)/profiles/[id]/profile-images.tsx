'use client';

import { useState } from 'react';

import { FormSection } from '@/components/form';
import { ImageUpload } from '@/components/image-upload';
import type { ProfileImageKind } from '@/modules/platform';

import {
  removeProfileImageAction,
  uploadProfileImageAction,
} from './image-actions';

interface Props {
  readonly profileId: string;
  readonly photoKey: string | null;
  readonly logoKey: string | null;
  readonly onChange: (kind: ProfileImageKind, key: string | null) => void;
}

/** Отделна секция извън „Запази": файлът се записва при избор, ключът отива в `saved`. */
export function ProfileImages({
  profileId,
  photoKey,
  logoKey,
  onChange,
}: Props) {
  // Отказ на „Премахни" — `ImageUpload` показва само своите качвания.
  const [errors, setErrors] = useState<
    Partial<Record<ProfileImageKind, string>>
  >({});

  const upload = (kind: ProfileImageKind) => async (data: FormData) => {
    setErrors((prev) => ({ ...prev, [kind]: undefined }));
    const result = await uploadProfileImageAction(profileId, kind, data);
    if (result.ok) onChange(kind, result.key);
    return result;
  };
  const remove = (kind: ProfileImageKind) => async () => {
    const result = await removeProfileImageAction(profileId, kind);
    if (result.ok) onChange(kind, null);
    else setErrors((prev) => ({ ...prev, [kind]: result.message }));
  };

  return (
    <FormSection
      title="Снимка и лого"
      description={'Записва се веднага, без „Запази".'}
    >
      <div className="grid gap-field sm:grid-cols-2">
        <ImageUpload
          value={photoKey}
          label="Снимка"
          hint="Квадрат 512 px. PNG, JPEG или WebP до 2 MB."
          shape="circle"
          upload={upload('photo')}
          onRemove={() => void remove('photo')()}
          error={errors.photo}
        />
        <ImageUpload
          value={logoKey}
          label="Лого"
          hint="До 256 px. PNG, JPEG или WebP до 2 MB."
          shape="square"
          upload={upload('logo')}
          onRemove={() => void remove('logo')()}
          error={errors.logo}
        />
      </div>
    </FormSection>
  );
}
