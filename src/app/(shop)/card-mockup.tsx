// Илюстрация на картата от токените — без файл и без JS. Стои в началото на
// витрината и на мястото на снимката, докато продуктът няма своя.

import { Nfc } from 'lucide-react';

type Props = Readonly<{
  name: string;
  /** `sm` за картата в списъка — по-малко текст, същите пропорции. */
  size?: 'sm' | 'lg';
}>;

export function CardMockup({ name, size = 'lg' }: Props) {
  const large = size === 'lg';
  return (
    <div
      aria-hidden="true"
      className="relative aspect-[85.6/54] w-full overflow-hidden rounded-2xl bg-brand text-bg shadow-(--shadow-card)"
    >
      <div className="absolute -top-1/3 -right-1/4 size-3/4 rounded-full bg-ink/30" />
      <div className="absolute -bottom-1/2 -left-1/4 size-3/4 rounded-full bg-sand/15" />
      <div
        className={`relative flex h-full flex-col justify-between ${large ? 'p-6' : 'p-4'}`}
      >
        <div className="flex items-start justify-between gap-2">
          <span
            className={`truncate font-semibold tracking-wide ${large ? 'text-lg' : 'text-sm'}`}
          >
            {name}
          </span>
          <Nfc
            size={large ? 28 : 20}
            strokeWidth={1.5}
            className="shrink-0 text-brass"
          />
        </div>
        {large && (
          <div className="flex flex-col gap-1">
            <span className="h-2 w-2/5 rounded-full bg-bg/80" />
            <span className="h-2 w-1/4 rounded-full bg-bg/50" />
          </div>
        )}
      </div>
    </div>
  );
}
