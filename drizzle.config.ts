import { defineConfig } from 'drizzle-kit';

// `drizzle-kit generate` only needs the schema; `migrate`/`push`/`studio`
// also need a live DB. Default to a placeholder so `generate` works offline.
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://placeholder:placeholder@localhost:5432/placeholder';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
