// Първият админ: потребител с `is_admin` + лична организация, в една транзакция.
//
//   pnpm db:seed:admin -- --email a@x.bg --password correct-horse-1 [--name …]
//
// Липсващ аргумент се чете от SEED_ADMIN_EMAIL/PASSWORD/NAME. Идемпотентен:
// съществуващ имейл (без оглед на регистъра) не се пипа — нито парола, нито
// права. Изходът е на английски (CLAUDE.md § 1).

import { argv, env, exit, stderr, stdout } from 'node:process';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { DrizzleQueryError } from 'drizzle-orm';
import { z } from 'zod';

// Дълбок импорт нарочно: barrel-ът на `auth` носи `session.ts` с `server-only`,
// който хвърля при импорт извън Next. `platform` няма такъв товар.
import { createUser, findUserByEmail } from '@/modules/auth/user.service';
import { type Db, db } from '@/modules/core';
import { createPersonalOrganization } from '@/modules/platform';

export const seedAdminInputSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  name: z.string().trim().min(1).default('Администратор'),
});

export type SeedAdminInput = z.input<typeof seedAdminInputSchema>;

export type SeedAdminResult =
  | {
      readonly status: 'created';
      readonly userId: string;
      readonly orgId: string;
    }
  | { readonly status: 'exists' };

/** Хвърля `ZodError` при невалиден вход — преди да пипне базата. */
export async function seedAdmin(
  database: Db,
  input: SeedAdminInput,
): Promise<SeedAdminResult> {
  const parsed = seedAdminInputSchema.parse(input);

  return database.transaction(async (tx) => {
    const existing = await findUserByEmail(tx, parsed.email);
    if (existing !== null) return { status: 'exists' };

    // Създаден от оператор — няма кого да потвърждава имейла.
    const user = await createUser(tx, {
      email: parsed.email,
      password: parsed.password,
      name: parsed.name,
      isAdmin: true,
      emailVerifiedAt: new Date(),
    });
    const org = await createPersonalOrganization(tx, {
      ownerUserId: user.id,
      name: user.name,
    });
    return { status: 'created', userId: user.id, orgId: org.id };
  });
}

function readCliInput(): SeedAdminInput {
  // pnpm подава и разделителя `--` — за `parseArgs` той е край на опциите.
  const args = argv.slice(2).filter((arg, index) => index > 0 || arg !== '--');
  const { values } = parseArgs({
    args,
    options: {
      email: { type: 'string' },
      password: { type: 'string' },
      name: { type: 'string' },
    },
  });
  return {
    email: values.email ?? env.SEED_ADMIN_EMAIL ?? '',
    password: values.password ?? env.SEED_ADMIN_PASSWORD ?? '',
    name: values.name ?? env.SEED_ADMIN_NAME,
  };
}

function describeError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
  }
  // Drizzle слага параметрите на заявката в `message` — при `users` това е
  // хешът на паролата. Печата се причината (грешката на Postgres), не обвивката.
  if (error instanceof DrizzleQueryError && error.cause instanceof Error) {
    return error.cause.message;
  }
  return error instanceof Error ? error.message : String(error);
}

async function main(): Promise<number> {
  try {
    const result = await seedAdmin(db, readCliInput());
    if (result.status === 'exists') {
      stdout.write('user already exists, nothing changed\n');
    } else {
      stdout.write(
        `admin created: user ${result.userId}, organization ${result.orgId}\n`,
      );
    }
    return 0;
  } catch (error) {
    stderr.write(`seed failed: ${describeError(error)}\n`);
    return 1;
  } finally {
    await db.$client.end({ timeout: 5 });
  }
}

const isDirectRun =
  argv[1] !== undefined && pathToFileURL(argv[1]).href === import.meta.url;

if (isDirectRun) exit(await main());
