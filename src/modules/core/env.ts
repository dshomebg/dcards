import { z } from 'zod';

// Единственото място, което чете `process.env`. Липсваща стойност пада при старт,
// не при първата заявка в три сутринта.
const schema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  APP_NAME: z.string().default('DCARDS'),
  APP_URL: z.url().default('http://localhost:3000'),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  SESSION_SECRET: z.string().min(32),
  // Временният админ до етап 1 (таблица `users`). Незадължителни: без тях
  // приложението стартира, само входът отказва.
  ADMIN_BOOTSTRAP_EMAIL: z.email().optional(),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().min(8).optional(),
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
