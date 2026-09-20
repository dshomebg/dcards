// Писмото с покана — чиста функция, без I/O. Без имейла на получателя:
// препратено писмо не издава нищо освен линка.

export interface InviteMailOptions {
  readonly appName: string;
  readonly orgName: string;
  readonly inviterName: string;
  readonly inviteUrl: string;
}

export interface InviteMail {
  readonly subject: string;
  readonly text: string;
}

export function inviteMail({
  appName,
  orgName,
  inviterName,
  inviteUrl,
}: InviteMailOptions): InviteMail {
  return {
    subject: `Покана за „${orgName}" в ${appName}`,
    text: [
      `${inviterName} ви кани в организацията „${orgName}" в ${appName}.`,
      '',
      'Приемете поканата от този линк (валиден 7 дни):',
      inviteUrl,
      '',
      'Ако не очаквате покана, игнорирайте писмото.',
    ].join('\n'),
  };
}
