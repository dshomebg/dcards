import { uploadUrl } from '@/lib/upload-url';

type Props = Readonly<{ name: string; images: readonly string[] }>;

const FRAME =
  'aspect-square w-full rounded-(--radius-card) border border-border bg-surface object-contain';

/**
 * Без клиентски JS: лента със scroll-snap, миниатюрите са котви към кадъра —
 * браузърът превърта лентата сам.
 */
export function Gallery({ name, images }: Props) {
  if (images.length === 0) return null;
  return (
    <div className="flex flex-col gap-hint">
      <ul className="flex snap-x snap-mandatory overflow-x-auto">
        {images.map((key, index) => (
          <li
            key={key}
            id={`image-${index + 1}`}
            className="w-full shrink-0 snap-center"
          >
            <img
              src={uploadUrl(key)}
              alt={index === 0 ? name : `${name} — снимка ${index + 1}`}
              width={1200}
              height={1200}
              loading={index === 0 ? 'eager' : 'lazy'}
              className={FRAME}
            />
          </li>
        ))}
      </ul>
      {images.length > 1 && (
        <ul className="flex flex-wrap gap-hint">
          {images.map((key, index) => (
            <li key={key}>
              <a
                href={`#image-${index + 1}`}
                aria-label={`Снимка ${index + 1}`}
              >
                <img
                  src={uploadUrl(key)}
                  alt=""
                  width={64}
                  height={64}
                  loading="lazy"
                  className="h-16 w-16 rounded-(--radius-control) border border-border object-contain hover:border-brand"
                />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
