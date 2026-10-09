import type { Transporter } from 'nodemailer';

import { env } from '../env';
import type { RateLimiter } from '../rate-limit/limiter';
import { RATE_POLICY, rateKey } from '../rate-limit/policy';
import { rateLimit } from '../rate-limit/shared';
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
  limiter: RateLimiter = rateLimit,
): Promise<boolean> {
  if (transport === null) return withoutTransport(message);
  // Админът е фиксиран адрес — не носи риск за репутацията и не бива да
  // ослепява първи, когато някой изчерпи тавана.
  const admin = env().MAIL_ADMIN_TO;
  const toAdmin = admin !== undefined && sameAddress(message.to, admin);
  if (!toAdmin && !(await withinCap(transport, limiter, admin))) return false;
  return deliver(transport, message);
}

const sameAddress = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

async function deliver(
  transport: Transporter,
  message: MailMessage,
): Promise<boolean> {
  try {
    await transport.sendMail({ from: env().MAIL_FROM, ...message });
    return true;
  } catch (error) {
    logFailure(error);
    return false;
  }
}

/** Над тавана: писмото пада, а админът научава веднъж на прозорец. */
async function withinCap(
  transport: Transporter,
  limiter: RateLimiter,
  admin: string | undefined,
): Promise<boolean> {
  const { limit, windowSec } = RATE_POLICY.mailGlobal;
  const quota = await limiter.consume(rateKey.mailGlobal(), limit, windowSec);
  if (quota.allowed) return true;

  console.error('sendMail: global hourly cap reached — mail dropped');
  const first = await limiter.consume(rateKey.mailCapAlert(), 1, windowSec);
  if (first.allowed && admin !== undefined) {
    await deliver(transport, {
      to: admin,
      subject: 'Достигнат е часовият таван на изходящите писма',
      text: `Над ${limit} писма за час — следващите се изпускат до края на часа. Провери логовете за злоупотреба с поръчки или регистрации.`,
    });
  }
  return false;
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
