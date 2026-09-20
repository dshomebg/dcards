import type { Transporter } from 'nodemailer';

import { env } from '../env';
import { mailTransport } from './transport';

export interface MailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html?: string;
}

let warnedOnce = false;

/** Логва само име и код — адресът и темата са лични данни (DAT-6). */
function logFailure(error: unknown): void {
  const err = error as { name?: string; code?: string } | undefined;
  console.error('sendMail failed:', err?.name, err?.code);
}

/**
 * Никога не хвърля: `true` = прието от SMTP (или отпечатано в dev). Провалът
 * е грижа на извикващия само ако иска да го покаже — поръчката не зависи от него.
 */
export async function sendMail(
  message: MailMessage,
  transport: Transporter | null = mailTransport(),
): Promise<boolean> {
  if (transport === null) return withoutTransport(message);
  try {
    await transport.sendMail({ from: env().MAIL_FROM, ...message });
    return true;
  } catch (error) {
    logFailure(error);
    return false;
  }
}

function withoutTransport(message: MailMessage): boolean {
  if (env().NODE_ENV === 'production') {
    if (!warnedOnce) {
      console.warn('sendMail: MAIL_HOST is not set — mail is disabled');
      warnedOnce = true;
    }
    return false;
  }
  console.info(
    `[mail] to=<hidden> subject=${message.subject}\n${message.text}`,
  );
  return true;
}
