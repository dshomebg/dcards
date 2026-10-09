'use client';

import { useState } from 'react';

import { FormSection } from '@/components/form';
import { ImageUpload } from '@/components/image-upload';
import { Button } from '@/components/ui/button';
import { uploadUrl } from '@/lib/upload-url';

import {
  type ProductImagesResult,
  removeProductImageAction,
  reorderProductImagesAction,
  uploadProductImageAction,
} from './image-actions';

// Огледало на `MAX_PRODUCT_IMAGES` от `shop` — сървърът е проверката.
const MAX_IMAGES = 6;

type Props = Readonly<{ productId: string; images: readonly string[] }>;

function moved(images: readonly string[], from: number, to: number): string[] {
  const next = [...images];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

/** Всяко действие се записва веднага — извън формата и „Запази" (както PLT-6). */
export function ProductImages({ productId, images: initial }: Props) {
  const [images, setImages] = useState<readonly string[]>(initial);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const apply = async (work: Promise<ProductImagesResult>) => {
    setPending(true);
    setMessage(null);
    try {
      const result = await work;
      if (result.ok) setImages(result.images);
      else setMessage(result.message);
    } catch {
      setMessage('Действието не мина — опитай пак след малко.');
    } finally {
      setPending(false);
    }
  };

  const upload = async (data: FormData) => {
    const result = await uploadProductImageAction(productId, data);
    if (!result.ok) return result;
    setImages(result.images);
    return { ok: true as const, key: result.images.at(-1) ?? '' };
  };

  const move = (from: number, to: number) =>
    void apply(reorderProductImagesAction(productId, moved(images, from, to)));

  return (
    <FormSection
      title="Снимки"
      description="Записват се веднага. Първата е основната — тя се вижда в списъка и в количката."
    >
      {images.length > 0 && (
        <ol className="flex flex-col gap-hint">
          {images.map((key, index) => (
            <li key={key} className="flex flex-wrap items-center gap-field">
              <img
                src={uploadUrl(key)}
                alt={`Снимка ${index + 1}`}
                width={64}
                height={64}
                className="h-16 w-16 rounded-(--radius-control) border border-border object-contain"
              />
              {index === 0 && (
                <span className="text-xs font-medium text-brand">Основна</span>
              )}
              <Button
                variant="ghost"
                disabled={pending || index === 0}
                onClick={() => move(index, index - 1)}
                aria-label={`Премести снимка ${index + 1} нагоре`}
              >
                ↑
              </Button>
              <Button
                variant="ghost"
                disabled={pending || index === images.length - 1}
                onClick={() => move(index, index + 1)}
                aria-label={`Премести снимка ${index + 1} надолу`}
              >
                ↓
              </Button>
              <Button
                variant="ghost"
                className="text-danger"
                disabled={pending}
                onClick={() =>
                  void apply(removeProductImageAction(productId, key))
                }
              >
                Премахни
              </Button>
            </li>
          ))}
        </ol>
      )}
      {images.length < MAX_IMAGES && (
        <ImageUpload
          value={null}
          label="Добави снимка"
          hint={`PNG, JPEG или WebP до 2 MB; до ${MAX_IMAGES} снимки.`}
          shape="square"
          upload={upload}
          onRemove={() => undefined}
        />
      )}
      {message !== null && (
        <p role="alert" className="text-danger text-xs">
          {message}
        </p>
      )}
    </FormSection>
  );
}
