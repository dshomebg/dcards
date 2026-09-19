// Средата на тестовете за база, на едно място: `vitest.config.ts` (работници),
// `vitest.globalSetup.db.ts` (миграции) и `vitest.setup.db.ts` (изолация).
//
// Стойностите са зашити нарочно — не идват от `.env`, за да няма как тест да
// стигне до развойна или производствена база.

/** Връзката към тестовия PostgreSQL (`docker-compose.test.yml`), без базата. */
const POSTGRES = 'postgresql://test:test@127.0.0.1:55434';

/**
 * Базата, в която `globalSetup` пуска миграциите. Тя е ОБРАЗЕЦ: всеки тестов
 * файл получава свое копие. Копирането иска образец без отворени връзки.
 */
export const TEMPLATE_DATABASE = 'dcards_test';

export function databaseUrl(name: string): string {
  return `${POSTGRES}/${name}`;
}

/** Служебната връзка — само за `CREATE DATABASE`, никога за заявки на тест. */
export const MAINTENANCE_DATABASE_URL = databaseUrl('postgres');

export const TEST_ENV = {
  NODE_ENV: 'test',
  // Презаписва се за всеки тестов файл от `vitest.setup.db.ts`; тук важи само
  // за `globalSetup`.
  DATABASE_URL: databaseUrl(TEMPLATE_DATABASE),
  // Никой не слуша там: клиентът е `lazyConnect` и тестовете не го викат.
  REDIS_URL: 'redis://127.0.0.1:56399',
  SESSION_SECRET: 'test-session-secret-not-a-secret-at-all',
} as const;
