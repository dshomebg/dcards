import { describe, expect, it } from 'vitest';

import { inviteMail } from './organization-mail';

describe('inviteMail', () => {
  it('names the org and the inviter, carries the link and nothing about the recipient', () => {
    const mail = inviteMail({
      appName: 'DCARDS',
      orgName: 'Студио Х',
      inviterName: 'Иван Петров',
      inviteUrl: 'http://localhost:3100/invite?token=TOKEN',
    });
    expect(mail.subject).toBe('Покана за „Студио Х" в DCARDS');
    expect(mail.text).toContain('Иван Петров ви кани');
    expect(mail.text).toContain('http://localhost:3100/invite?token=TOKEN');
    expect(mail.text).toContain('7 дни');
    expect(mail.text).not.toContain('@');
  });
});
