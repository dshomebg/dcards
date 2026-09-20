// Писма за акаунта — чисти функции, без I/O. Без парола, без линк за вход с
// токен: само какво е станало и къде да реагираш.

export interface AccountMailOptions {
  readonly appName: string;
  readonly appUrl: string;
}

export interface AccountMail {
  readonly subject: string;
  readonly text: string;
}

export interface WelcomeMailOptions extends AccountMailOptions {
  /** Липсва при паднал Redis — писмото тръгва и без линк (AUTH-12). */
  readonly verifyUrl?: string;
}

const VERIFY_HINT = 'Потвърдете имейла си от този линк (валиден 24 часа):';

export function welcomeMail(
  name: string,
  { appName, appUrl, verifyUrl }: WelcomeMailOptions,
): AccountMail {
  const verifyLines =
    verifyUrl === undefined ? [] : ['', VERIFY_HINT, verifyUrl];
  return {
    subject: `Добре дошли в ${appName}`,
    text: [
      `Здравейте, ${name}!`,
      '',
      `Акаунтът ви в ${appName} е създаден с този имейл.`,
      `Профилите и картите са в ${appUrl}/app.`,
      ...verifyLines,
      '',
      'Ако не сте се регистрирали вие, отговорете на този имейл.',
    ].join('\n'),
  };
}

export interface VerifyEmailMailOptions {
  readonly appName: string;
  readonly verifyUrl: string;
}

/** Без име и имейл — само линкът; препратено писмо не издава нищо друго. */
export function verifyEmailMail({
  appName,
  verifyUrl,
}: VerifyEmailMailOptions): AccountMail {
  return {
    subject: `Потвърдете имейла си в ${appName}`,
    text: [
      VERIFY_HINT,
      verifyUrl,
      '',
      'Ако не сте поискали това, игнорирайте писмото.',
    ].join('\n'),
  };
}

export function passwordChangedMail({
  appName,
  appUrl,
}: AccountMailOptions): AccountMail {
  return {
    subject: `Паролата ви в ${appName} беше сменена`,
    text: [
      `Паролата на акаунта ви в ${appName} току-що беше сменена.`,
      'Другите ви сесии са затворени.',
      '',
      `Ако не сте били вие, отговорете на този имейл веднага — ${appUrl}.`,
    ].join('\n'),
  };
}
