// Изображения за качване: реалният формат се чете от байтовете (не от името/
// MIME), SVG и GIF са отказани, изходът е винаги WebP. Логото пази пропорцията
// (`inside`), снимката е квадрат (`cover`, PLT-6 § 7а).

import sharp from 'sharp';

export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
/** Старото име — вносителите от магазина го ползват. */
export const LOGO_MAX_BYTES = IMAGE_MAX_BYTES;
export const LOGO_MAX_SIDE = 256;
export const PHOTO_SIDE = 512;

const ACCEPTED_FORMATS = new Set(['png', 'jpeg', 'webp']);

export type ImageErrorCode = 'too_large' | 'unsupported' | 'unreadable';

const MESSAGES: Readonly<Record<ImageErrorCode, string>> = {
  too_large: 'Файлът е до 2 MB.',
  unsupported: 'Приемат се само PNG, JPEG или WebP.',
  unreadable: 'Файлът не може да бъде прочетен като изображение.',
};

export class ImageError extends Error {
  constructor(readonly code: ImageErrorCode) {
    super(MESSAGES[code]);
    this.name = 'ImageError';
  }
}

// 2 MB могат да са 16k×16k lossless WebP → ~1 GB при декодиране (pixel flood).
// 25 Mpx (5000×5000) е повече от достатъчно; sharp го налага и сам.
export const IMAGE_MAX_PIXELS = 25_000_000;

export interface ProcessOptions {
  readonly maxSide: number;
  readonly fit: 'inside' | 'cover';
}

const open = (input: Buffer) =>
  sharp(input, { limitInputPixels: IMAGE_MAX_PIXELS });

interface Inspected {
  readonly format?: string;
  readonly width: number;
  readonly height: number;
}

async function inspect(input: Buffer): Promise<Inspected> {
  try {
    // Само заглавието (без декодиране) — за да кажем „твърде голям", не „нечетим".
    const meta = await sharp(input).metadata();
    return { format: meta.format, width: meta.width, height: meta.height };
  } catch {
    throw new ImageError('unreadable');
  }
}

/** `cover` на малък вход: квадрат по късата страна, не увеличаване. */
function targetSide(meta: Inspected, { maxSide, fit }: ProcessOptions): number {
  return fit === 'cover' ? Math.min(maxSide, meta.width, meta.height) : maxSide;
}

/** Хвърля само `ImageError`; всичко друго от sharp е грешка на сървъра. */
export async function processImage(
  input: Buffer,
  options: ProcessOptions,
): Promise<Buffer> {
  if (input.byteLength === 0) throw new ImageError('unreadable');
  if (input.byteLength > IMAGE_MAX_BYTES) throw new ImageError('too_large');
  const meta = await inspect(input);
  if (meta.format === undefined || !ACCEPTED_FORMATS.has(meta.format)) {
    throw new ImageError('unsupported');
  }
  if (meta.width * meta.height > IMAGE_MAX_PIXELS) {
    throw new ImageError('too_large');
  }
  const side = targetSide(meta, options);
  return open(input)
    .rotate()
    .resize(side, side, { fit: options.fit, withoutEnlargement: true })
    .webp()
    .toBuffer();
}

export function processLogo(input: Buffer): Promise<Buffer> {
  return processImage(input, { maxSide: LOGO_MAX_SIDE, fit: 'inside' });
}

export function processPhoto(input: Buffer): Promise<Buffer> {
  return processImage(input, { maxSide: PHOTO_SIDE, fit: 'cover' });
}

/** WebP от тома → JPEG за vCard `PHOTO` (§ 7б: в паметта, при всяка заявка). */
export function toJpeg(webp: Buffer, side: number): Promise<Buffer> {
  return sharp(webp)
    .resize(side, side, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
}
