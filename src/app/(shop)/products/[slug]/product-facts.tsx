import { type LucideIcon, QrCode, RefreshCw, Truck } from 'lucide-react';

/** Какво получава купувачът — само факти, които кодът държи (COD, профил, QR). */
export function ProductFacts({ shipping }: Readonly<{ shipping: string }>) {
  const facts: readonly (readonly [LucideIcon, string])[] = [
    [Truck, `Доставка ${shipping}, плащане при получаване.`],
    [
      RefreshCw,
      'Профилът се редактира по всяко време — картата остава същата.',
    ],
    [QrCode, 'Профилът има и QR код за телефони без NFC.'],
  ];
  return (
    <ul className="flex flex-col gap-hint text-sm text-text-muted">
      {facts.map(([Icon, text]) => (
        <li key={text} className="flex items-start gap-2">
          <Icon
            aria-hidden
            size={18}
            strokeWidth={1.75}
            className="mt-px shrink-0 text-brand"
          />
          {text}
        </li>
      ))}
    </ul>
  );
}
