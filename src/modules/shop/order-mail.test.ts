import { describe, expect, it } from 'vitest';

import { orderConfirmationMail } from './order-mail';

const placed = {
  id: 'o1',
  number: 'DC-2026-000007',
  createdAt: new Date('2026-09-20T10:00:00Z'),
  items: [
    {
      productName: 'PVC Classic',
      variantName: 'Бяла',
      quantity: 2,
      unitPrice: 1990,
    },
    {
      productName: 'Метална <b>',
      variantName: '',
      quantity: 1,
      unitPrice: 4900,
    },
  ],
  subtotal: 8880,
  shippingCost: 590,
  total: 9470,
};

const options = {
  appName: 'DCARDS',
  appUrl: 'https://www.dcards-bg.com',
  format: { currency: 'BGN', locale: 'bg-BG' },
};

// `Intl` слага неразделим интервал пред валутата — тестът гледа думите.
const plain = (value: string) => value.replaceAll(' ', ' ');

describe('orderConfirmationMail', () => {
  it('renders lines, sums, COD and the link in text and html', () => {
    const raw = orderConfirmationMail(placed, options);
    const mail = { ...raw, text: plain(raw.text), html: plain(raw.html) };
    expect(mail.subject).toBe('Поръчка DC-2026-000007 — DCARDS');
    expect(mail.text).toContain(
      'PVC Classic · Бяла: 2 × 19,90 лв. = 39,80 лв.',
    );
    expect(mail.text).toContain('Метална <b>: 1 × 49,00 лв.');
    expect(mail.text).toContain('Общо: 94,70 лв.');
    expect(mail.text).toContain('Плащане при доставка');
    expect(mail.text).toContain(
      'https://www.dcards-bg.com/order/DC-2026-000007',
    );
    expect(mail.html).toContain('Метална &lt;b&gt;');
    expect(mail.html).not.toContain('<b>');
    expect(mail.html).toContain('94,70');
  });

  it('carries no delivery or personal data — the address is unverified input', () => {
    const mail = orderConfirmationMail(placed, options);
    for (const word of [
      'Телефон',
      'Адрес',
      'Офис',
      'Получател',
      'Бележка',
      '@',
    ]) {
      expect(mail.text).not.toContain(word);
      expect(mail.html).not.toContain(word);
    }
  });

  it('prefixes the admin copy', () => {
    const mail = orderConfirmationMail(placed, { ...options, forAdmin: true });
    expect(mail.subject).toBe('[Нова поръчка] Поръчка DC-2026-000007 — DCARDS');
  });
});
