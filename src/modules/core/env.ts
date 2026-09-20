import { z } from 'zod';

// Единственото място, което чете `process.env`. Липсваща стойност пада при старт,
// не при първата заявка в три сутринта.

// Само origin: път/query/`#` дават счупен адрес върху чип, който не се презаписва (DAT-3).
const originUrl = z.url().refine((value) => {
  const url = new URL(value);
  return (
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    url.pathname === '/' &&
    url.search === '' &&
    url.hash === ''
  );
}, 'Only scheme and host are allowed, without path, query or hash.');

const schema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  APP_NAME: z.string().default('DCARDS'),
  APP_URL: originUrl.default('http://localhost:3000'),
  // Адресът върху картите (`/c/{id}`) — къс домейн, купен отделно; иначе `APP_URL`.
  CARD_URL_BASE: originUrl.optional(),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  SESSION_SECRET: z.string().min(32),
  UPLOADS_DIR: z.string().default('./uploads'),
  MAIL_HOST: z.string().optional(),
  MAIL_PORT: z.coerce.number().int().default(465),
  MAIL_SECURE: z
    .string()
    .default('true')
    .transform((value) => value === 'true'),
  MAIL_USER: z.string().optional(),
  MAIL_PASS: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  STORE_CURRENCY: z.string().default('BGN'),
  STORE_LOCALE: z.string().default('bg-BG'),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  cached ??= schema.parse(process.env);
  return cached;
}
