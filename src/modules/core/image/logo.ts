// Лого за карта: реалният формат се чете от байтовете (не от името/MIME),
// SVG и GIF са отказани, изходът е винаги WebP до 256 px по дългата страна.

import sharp from 'sharp';

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_MAX_SIDE = 256;

const ACCEPTED_FORMATS = new Set(['png', 'jpeg', 'webp']);

export type LogoErrorCode = 'too_large' | 'unsupported' | 'unreadable';

const MESSAGES: Readonly<Record<LogoErrorCode, string>> = {
  too_large: 'Файлът е до 2 MB.',
  unsupported: 'Приемат се само PNG, JPEG или WebP.',
  unreadable: 'Файлът не може да бъде прочетен като изображение.',
};

export class LogoError extends Error {
  constructor(readonly code: LogoErrorCode) {
    super(MESSAGES[code]);
    this.name = 'LogoError';
  }
}

// 2 MB могат да са 16k×16k lossless WebP → ~1 GB при декодиране (pixel flood).
// 25 Mpx (5000×5000) е повече от достатъчно за лого; sharp го налага и сам.
export const LOGO_MAX_PIXELS = 25_000_000;

const open = (input: Buffer) =>
  sharp(input, { limitInputPixels: LOGO_MAX_PIXELS });

async function inspect(
  input: Buffer,
): Promise<{ format?: string; pixels: number }> {
  try {
    // Само заглавието (без декодиране) — за да кажем „твърде голям", не „нечетим".
    const meta = await sharp(input).metadata();
    return { format: meta.format, pixels: meta.width * meta.height };
  } catch {
    throw new LogoError('unreadable');
  }
}

/** Хвърля само `LogoError`; всичко друго от sharp е грешка на сървъра. */
export async function processLogo(input: Buffer): Promise<Buffer> {
  if (input.byteLength === 0) throw new LogoError('unreadable');
  if (input.byteLength > LOGO_MAX_BYTES) throw new LogoError('too_large');
  const { format, pixels } = await inspect(input);
  if (format === undefined || !ACCEPTED_FORMATS.has(format)) {
    throw new LogoError('unsupported');
  }
  if (pixels > LOGO_MAX_PIXELS) throw new LogoError('too_large');
  return open(input)
    .rotate()
    .resize(LOGO_MAX_SIDE, LOGO_MAX_SIDE, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp()
    .toBuffer();
}
