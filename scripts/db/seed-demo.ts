// Демо профил `/demo` за ръчна проверка на публичната страница.
//
//   pnpm db:seed:demo -- --email a@x.bg
//
// Създава се в личната организация на подадения потребител: тема `sand`, шест
// линка (лимитът на Free). Идемпотентен по slug. Изходът е на английски.

import { argv, exit, stderr, stdout } from 'node:process';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { DrizzleQueryError } from 'drizzle-orm';

// Дълбок импорт нарочно: barrel-ът на `auth` носи `server-only` (виж seed-admin).
import { findUserByEmail } from '@/modules/auth/user.service';
import { db } from '@/modules/core';
import {
  createProfile,
  findPersonalOrganizationByOwner,
  findPublicProfileBySlug,
  ProfileError,
} from '@/modules/platform';

const DEMO_SLUG = 'demo';

function readEmail(): string {
  const args = argv.slice(2).filter((arg, index) => index > 0 || arg !== '--');
  const { values } = parseArgs({
    args,
    options: { email: { type: 'string' } },
  });
  if (values.email === undefined) throw new Error('--email is required');
  return values.email;
}

function describeError(error: unknown): string {
  if (error instanceof DrizzleQueryError && error.cause instanceof Error) {
    return error.cause.message;
  }
  return error instanceof Error ? error.message : String(error);
}

async function seedDemo(email: string): Promise<'created' | 'exists'> {
  const user = await findUserByEmail(db, email);
  if (user === null) throw new Error(`user not found: ${email}`);
  const org = await findPersonalOrganizationByOwner(db, user.id);
  if (org === null) throw new Error(`no personal organization for ${email}`);
  // Идемпотентност по slug; зает от друга организация → `slug_taken` по-долу.
  if ((await findPublicProfileBySlug(db, DEMO_SLUG)) !== null) return 'exists';

  try {
    await createProfile(db, {
      orgId: org.id,
      slug: DEMO_SLUG,
      firstName: 'Иван',
      lastName: 'Петров',
      title: 'Управител',
      company: 'Демо ООД',
      bio: 'NFC визитки и дигитални профили за бизнеса.',
      theme: {
        preset: 'sand',
        primaryColor: null,
        logoBackground: false,
        layout: 'default',
      },
      links: [
        { type: 'phone', value: '+359 88 123 4567' },
        { type: 'email', value: 'ivan@demo.bg' },
        { type: 'website', value: 'demo.bg' },
        { type: 'linkedin', value: 'ivan-petrov' },
        { type: 'whatsapp', value: '+359881234567' },
        { type: 'address', value: 'бул. Витоша 1, София' },
      ],
    });
    return 'created';
  } catch (error) {
    if (error instanceof ProfileError && error.code === 'slug_taken') {
      return 'exists';
    }
    throw error;
  }
}

async function main(): Promise<number> {
  try {
    const status = await seedDemo(readEmail());
    stdout.write(
      status === 'exists'
        ? `profile /${DEMO_SLUG} already exists, nothing changed\n`
        : `profile created: /${DEMO_SLUG}\n`,
    );
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
