// Вдига тестовия Postgres и мигрира образеца — веднъж за пуск на проекта `db`.
//
// Тестовете НЕ вървят срещу развойната база: те създават и трият редове.
// Контейнерът остава вдигнат (`pnpm test:infra:down` го спира).

import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

import {
  MAINTENANCE_DATABASE_URL,
  TEMPLATE_DATABASE,
  TEST_ENV,
} from './vitest.env.js';

const COMPOSE = ['compose', '-f', 'docker-compose.test.yml'];
const CONTAINER = 'dcards-test-postgres';
const READY_TIMEOUT_MS = 60_000;

function docker(args: string[]): string {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: 'pipe' });
}

function isHealthy(): boolean {
  try {
    const status = docker([
      'inspect',
      CONTAINER,
      '--format',
      '{{.State.Health.Status}}',
    ]);
    return status.trim() === 'healthy';
  } catch {
    return false;
  }
}

async function waitForContainer(): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (isHealthy()) return;
    await sleep(1000);
  }
  throw new Error('test database did not become healthy within 60s');
}

async function runMigrations(): Promise<void> {
  // Не през `core/db/client` — той чете средата при импорт, а тази не е
  // тестовата. Затваря се веднага: образецът се копира само без връзки.
  // `onnotice` мълчи за вече съществуващата таблица с миграции при втори пуск.
  const sql = postgres(TEST_ENV.DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(sql), { migrationsFolder: './drizzle' });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/**
 * Развален образец се ПРЕСЪЗДАВА веднъж: прекъснат пуск оставя схема без пълен
 * ред в `__drizzle_migrations` и следващият пада на вече съществуващ тип.
 */
async function migrateTemplate(): Promise<void> {
  try {
    await runMigrations();
    return;
  } catch {
    console.warn('[db tests] template is broken, recreating it');
  }

  const admin = postgres(MAINTENANCE_DATABASE_URL, { max: 1 });
  try {
    await admin`DROP DATABASE IF EXISTS ${admin(TEMPLATE_DATABASE)} WITH (FORCE)`;
    await admin`CREATE DATABASE ${admin(TEMPLATE_DATABASE)}`;
  } finally {
    await admin.end({ timeout: 5 });
  }

  await runMigrations();
}

/** Копията от прекъснат предишен пуск — иначе заемат имена и връзки. */
async function dropLeftoverClones(): Promise<void> {
  const sql = postgres(MAINTENANCE_DATABASE_URL, { max: 1 });
  try {
    const rows = await sql<{ name: string }[]>`
      SELECT datname AS name FROM pg_database
      WHERE datname LIKE ${`${TEMPLATE_DATABASE}\\_%`}
    `;
    for (const { name } of rows) {
      await sql`DROP DATABASE IF EXISTS ${sql(name)} WITH (FORCE)`;
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export async function setup(): Promise<void> {
  docker([...COMPOSE, 'up', '-d']);
  await waitForContainer();
  await migrateTemplate();
  await dropLeftoverClones();
}

/** Нарочно празно — контейнерът остава за следващия пуск. */
export function teardown(): void {
  // Нищо за спиране.
}
