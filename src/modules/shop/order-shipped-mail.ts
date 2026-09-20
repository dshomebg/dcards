// Писмото „изпратена" — чиста функция без I/O (ARC-2: `shop` не праща поща).
// Без адрес и лични данни. Линк към поръчката само при поръчка с org: гостовият
// токен е 24 ч (AUTH-11) и след дни линкът би дал 404.

import { escapeHtml } from './escape-html';
import { type Courier, COURIER_LABELS } from './order.schema';
import type { OrderMail } from './order-mail';

export interface ShippedMailInput {
  readonly number: string;
  readonly courier: Courier;
  readonly trackingNumber: string;
  readonly hasAccount: boolean;
}

export interface ShippedMailOptions {
  readonly appName: string;
  readonly appUrl: string;
}

const ACTIVATION_BEFORE = 'Картите се активират от ';
const ACTIVATION_AFTER = ' с кода на гърба или с докосване на чипа при вход.';

export function orderShippedMail(
  order: ShippedMailInput,
  { appName, appUrl }: ShippedMailOptions,
): OrderMail {
  const courier = COURIER_LABELS[order.courier];
  const cardsUrl = `${appUrl}/app/cards`;
  const orderUrl = `${appUrl}/order/${order.number}`;
  const instruction = `${ACTIVATION_BEFORE}${cardsUrl}${ACTIVATION_AFTER}`;

  const text = [
    `Поръчка ${order.number} е изпратена.`,
    '',
    `Куриер: ${courier}`,
    `Номер на пратка: ${order.trackingNumber}`,
    '',
    instruction,
    ...(order.hasAccount ? ['', `Преглед: ${orderUrl}`] : []),
  ].join('\n');

  const html = [
    '<div style="font-family:sans-serif;color:#2F4A54">',
    `<h2>Поръчка ${escapeHtml(order.number)} е изпратена</h2>`,
    `<p>Куриер: <strong>${escapeHtml(courier)}</strong><br>Номер на пратка: <strong>${escapeHtml(order.trackingNumber)}</strong></p>`,
    `<p>${escapeHtml(ACTIVATION_BEFORE)}<a href="${escapeHtml(cardsUrl)}">${escapeHtml(cardsUrl)}</a>${escapeHtml(ACTIVATION_AFTER)}</p>`,
    order.hasAccount
      ? `<p><a href="${escapeHtml(orderUrl)}">Преглед на поръчката</a></p>`
      : '',
    '</div>',
  ].join('');

  return {
    subject: `Поръчка ${order.number} е изпратена — ${appName}`,
    text,
    html,
  };
}
