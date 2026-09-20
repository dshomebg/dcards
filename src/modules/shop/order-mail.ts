// Писмото за поръчка — чиста функция без I/O (ARC-2: `shop` не праща поща).
// Без име, телефон, адрес и персонализация: имейлът от формата е непроверен
// и писмо до чужд адрес не бива да носи лични данни.

import { escapeHtml } from './escape-html';
import { formatPrice, type PriceFormat } from './money';
import type { PlacedOrder } from './order.schema';

export interface OrderMailOptions {
  readonly appName: string;
  readonly appUrl: string;
  readonly format: PriceFormat;
  readonly forAdmin?: boolean;
}

export interface OrderMail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

const NOTE =
  'Линкът се отваря в браузъра, от който поръчахте. Ако не се отваря, отговорете на този имейл.';

const lineName = (item: PlacedOrder['items'][number]) =>
  item.variantName === ''
    ? item.productName
    : `${item.productName} · ${item.variantName}`;

export function orderConfirmationMail(
  order: PlacedOrder,
  options: OrderMailOptions,
): OrderMail {
  const { appName, appUrl, format } = options;
  const price = (minor: number) => formatPrice(minor, format);
  const date = new Intl.DateTimeFormat(format.locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(order.createdAt);
  const link = `${appUrl}/order/${order.number}`;
  const totals: readonly (readonly [string, number])[] = [
    ['Продукти', order.subtotal],
    ['Доставка', order.shippingCost],
    ['Общо', order.total],
  ];

  const textLines = order.items.map(
    (item) =>
      `- ${lineName(item)}: ${item.quantity} × ${price(item.unitPrice)} = ${price(item.quantity * item.unitPrice)}`,
  );
  const text = [
    `Поръчка ${order.number} — ${date}`,
    '',
    ...textLines,
    '',
    ...totals.map(([label, minor]) => `${label}: ${price(minor)}`),
    '',
    'Плащане при доставка.',
    `Преглед: ${link}`,
    NOTE,
  ].join('\n');

  const rows = order.items
    .map(
      (item) =>
        `<tr><td style="padding:4px 8px">${escapeHtml(lineName(item))}</td><td style="padding:4px 8px;text-align:right">${item.quantity} × ${price(item.unitPrice)}</td><td style="padding:4px 8px;text-align:right">${price(item.quantity * item.unitPrice)}</td></tr>`,
    )
    .join('');
  const sums = totals
    .map(
      ([label, minor]) =>
        `<tr><td colspan="2" style="padding:4px 8px;text-align:right">${label}</td><td style="padding:4px 8px;text-align:right"><strong>${price(minor)}</strong></td></tr>`,
    )
    .join('');
  const html = `<div style="font-family:sans-serif;color:#2F4A54"><h2>Поръчка ${escapeHtml(order.number)}</h2><p>${escapeHtml(date)}</p><table style="border-collapse:collapse">${rows}${sums}</table><p>Плащане при доставка.</p><p><a href="${escapeHtml(link)}">Преглед на поръчката</a></p><p style="color:#4E6E7A;font-size:13px">${escapeHtml(NOTE)}</p></div>`;

  const subject = `${options.forAdmin === true ? '[Нова поръчка] ' : ''}Поръчка ${order.number} — ${appName}`;
  return { subject, text, html };
}
