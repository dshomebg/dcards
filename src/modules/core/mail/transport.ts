// Един ленив SMTP transport за процеса. Без `MAIL_HOST` няма transport —
// пращането тогава е „в конзолата" (dev) или „не" (prod), виж `send.ts`.
// Без `server-only`: barrel-ът на `core` се внася и от db тестовете.

import { createTransport, type Transporter } from 'nodemailer';

import { env } from '../env';

// nodemailer чака 2 минути по подразбиране; таймерите са по фази, не общ таван.
const TIMEOUT_MS = 5_000;

let transport: Transporter | null | undefined;

export function mailTransport(): Transporter | null {
  if (transport !== undefined) return transport;
  const { MAIL_HOST, MAIL_PORT, MAIL_SECURE, MAIL_USER, MAIL_PASS } = env();
  if (MAIL_HOST === undefined || MAIL_HOST === '') {
    transport = null;
    return transport;
  }
  transport = createTransport({
    host: MAIL_HOST,
    port: MAIL_PORT,
    secure: MAIL_SECURE,
    // 587 = `MAIL_SECURE=false`; STARTTLS без downgrade.
    requireTLS: !MAIL_SECURE,
    auth:
      MAIL_USER !== undefined && MAIL_PASS !== undefined
        ? { user: MAIL_USER, pass: MAIL_PASS }
        : undefined,
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  });
  return transport;
}
