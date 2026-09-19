import { env, loadEnvFile } from 'node:process';

import { defineConfig } from 'drizzle-kit';

try {
  loadEnvFile('.env');
} catch {
  // няма .env — стойностите идват отвън
}

export default defineConfig({
  dialect: 'postgresql',
  // Схемите живеят при своите модули, не в обща папка — целият домейн на едно място.
  schema: './src/modules/**/*.schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: env.DATABASE_URL ?? '',
  },
  verbose: true,
  strict: true,
});
