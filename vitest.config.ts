import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

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
    ],
  },
});
