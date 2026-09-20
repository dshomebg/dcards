import { describe, expect, it } from 'vitest';

import { orderShippedMail } from './order-shipped-mail';

const options = { appName: 'DCARDS', appUrl: 'https://dcards-bg.com' };

describe('orderShippedMail', () => {
  it('carries number, courier, tracking and the activation instruction', () => {
    const mail = orderShippedMail(
      {
        number: 'DC-2026-000007',
        courier: 'econt',
        trackingNumber: '1234567890',
        hasAccount: false,
      },
      options,
    );
    expect(mail.subject).toBe('Поръчка DC-2026-000007 е изпратена — DCARDS');
    expect(mail.text).toContain('DC-2026-000007');
    expect(mail.text).toContain('Куриер: Еконт');
    expect(mail.text).toContain('Номер на пратка: 1234567890');
    expect(mail.text).toContain('https://dcards-bg.com/app/cards');
    expect(mail.text).toContain('с кода на гърба');
    expect(mail.html).toContain('href="https://dcards-bg.com/app/cards"');
    expect(mail.html).toContain('Еконт');
  });

  it('links to the order only for an account order', () => {
    const guest = orderShippedMail(
      {
        number: 'DC-1',
        courier: 'speedy',
        trackingNumber: 'T',
        hasAccount: false,
      },
      options,
    );
    expect(guest.text).not.toContain('/order/');
    expect(guest.html).not.toContain('/order/');

    const account = orderShippedMail(
      {
        number: 'DC-1',
        courier: 'speedy',
        trackingNumber: 'T',
        hasAccount: true,
      },
      options,
    );
    expect(account.text).toContain('https://dcards-bg.com/order/DC-1');
    expect(account.html).toContain('href="https://dcards-bg.com/order/DC-1"');
    expect(account.text).toContain('Спиди');
  });

  it('escapes the tracking number in html and carries no address fields', () => {
    const mail = orderShippedMail(
      {
        number: 'DC-1',
        courier: 'econt',
        trackingNumber: '<b>&"x',
        hasAccount: false,
      },
      options,
    );
    expect(mail.html).toContain('&lt;b&gt;&amp;&quot;x');
    expect(mail.html).not.toContain('<b>');
    expect(mail.text).not.toMatch(/адрес|офис|телефон/i);
  });
});
