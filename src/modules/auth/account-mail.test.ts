import { describe, expect, it } from 'vitest';

import {
  passwordChangedMail,
  verifyEmailMail,
  welcomeMail,
} from './account-mail';

const options = { appName: 'DCARDS', appUrl: 'https://www.dcards-bg.com' };

describe('account mails', () => {
  it('welcomes by name with the app link and no secrets', () => {
    const mail = welcomeMail('Иван', options);
    expect(mail.subject).toBe('Добре дошли в DCARDS');
    expect(mail.text).toContain('Здравейте, Иван!');
    expect(mail.text).toContain('https://www.dcards-bg.com/app');
    expect(mail.text.toLowerCase()).not.toContain('парола');
  });

  it('adds the verification link only when it is given', () => {
    const verifyUrl = 'https://www.dcards-bg.com/verify-email?token=abc';
    expect(welcomeMail('Иван', options).text).not.toContain('verify-email');
    expect(welcomeMail('Иван', { ...options, verifyUrl }).text).toContain(
      verifyUrl,
    );
  });

  it('sends the verification link without name or email', () => {
    const verifyUrl = 'https://www.dcards-bg.com/verify-email?token=abc';
    const mail = verifyEmailMail({ appName: 'DCARDS', verifyUrl });
    expect(mail.subject).toBe('Потвърдете имейла си в DCARDS');
    expect(mail.text).toContain(verifyUrl);
    expect(mail.text).not.toContain('@');
  });

  it('announces a password change without the new password', () => {
    const mail = passwordChangedMail(options);
    expect(mail.subject).toContain('сменена');
    expect(mail.text).toContain('Другите ви сесии са затворени.');
  });
});
