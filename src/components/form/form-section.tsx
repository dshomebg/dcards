import type { ReactNode } from 'react';

import { cardStyles } from '@/components/ui/surface';

type FormSectionProps = Readonly<{
  title: string;
  description?: string;
  children: ReactNode;
}>;

export function FormSection({
  title,
  description,
  children,
}: FormSectionProps) {
  return (
    // Токени, не сурови числа — секцията да се мени с останалата плътност.
    // КАРТА, като списъците: върху сивата страница полетата иначе висят без
    // подложка до бял слот за снимка — две повърхности в една форма.
    <section className={cardStyles('flex flex-col gap-block p-5')}>
      <div className="flex flex-col gap-hint">
        <h2 className="font-medium">{title}</h2>
        {description !== undefined && (
          <p className="text-text-muted text-hint">{description}</p>
        )}
      </div>

      <div className="flex flex-col gap-field">{children}</div>
    </section>
  );
}
