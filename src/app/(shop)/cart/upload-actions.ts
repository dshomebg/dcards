'use server';

// Логото се качва ВЕДНАГА при избор, отделно от „Добави": формата получава
// ключ и го носи в `personalization.logoKey`. Ред: размер → лимит → sharp → диск.

import {
  createLogoKey,
  ImageError,
  LOGO_MAX_BYTES,
  processLogo,
  putObject,
} from '@/modules/core';

import { uploadLimit } from './rate-limit';

export type UploadLogoResult =
  | { readonly ok: true; readonly key: string }
  | { readonly ok: false; readonly message: string };

const failure = (message: string): UploadLogoResult => ({
  ok: false,
  message,
});

const FAILED = 'Логото не беше качено — опитай пак след малко.';

/** Само име и код — байтовете и името на файла не влизат в лога. */
function logUnexpected(error: unknown): void {
  const err = error as { name?: string; code?: string } | undefined;
  console.error('uploadLogoAction failed:', err?.name, err?.code);
}

export async function uploadLogoAction(
  formData: FormData,
): Promise<UploadLogoResult> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return failure('Избери файл с лого.');
  }
  // Преди лимита: отказът на голям файл не струва нищо и не бива да брои.
  if (file.size > LOGO_MAX_BYTES) return failure('Файлът е до 2 MB.');
  const limited = await uploadLimit();
  if (limited !== null) return failure(limited);

  try {
    const webp = await processLogo(Buffer.from(await file.arrayBuffer()));
    const key = createLogoKey();
    await putObject(key, webp);
    return { ok: true, key };
  } catch (error) {
    if (error instanceof ImageError) return failure(error.message);
    logUnexpected(error);
    return failure(FAILED);
  }
}
