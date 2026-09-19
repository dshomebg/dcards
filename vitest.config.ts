import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

import { TEST_ENV } from './vitest.env.js';

const alias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
};

// `jsx: "preserve"` в `tsconfig` спира трансформацията на oxc — тя се задава
// изрично тук и важи само за тестовете, не за `next build`.
const jsx = { jsx: { runtime: 'automatic' } } as const;

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
          exclude: ['**/*.db.test.ts'],
        },
        resolve: { alias },
      },
      {
        oxc: jsx,
        test: {
          name: 'dom',
          include: ['src/**/*.test.tsx'],
          environment: 'happy-dom',
          // При `globals: false` `cleanup()` не се закача сам — вика се оттам.
          setupFiles: ['./vitest.setup.dom.ts'],
        },
        resolve: { alias },
      },
      {
        // Срещу собствен Postgres в Docker — `docker-compose.test.yml`. Всеки
        // файл получава своя база от мигрирания образец.
        test: {
          name: 'db',
          include: ['src/**/*.db.test.ts', 'scripts/**/*.db.test.ts'],
          env: TEST_ENV,
          globalSetup: ['./vitest.globalSetup.db.ts'],
          setupFiles: ['./vitest.setup.db.ts'],
          pool: 'forks',
          // Вдигането на контейнера отнема време при първо пускане.
          hookTimeout: 90_000,
        },
        resolve: { alias },
      },
    ],
  },
});
