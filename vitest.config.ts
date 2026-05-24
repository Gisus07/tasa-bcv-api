import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'forks',
    // Test files share a single Postgres container (testcontainer.helper uses
    // withReuse). Running files in parallel makes concurrent migrate() calls
    // race while creating __drizzle_migrations (Postgres pg_type duplicate key),
    // and would let one file's TRUNCATE clobber another's data. Run files
    // serially — the DB-backed files dominate the runtime either way.
    fileParallelism: false,
    include: ['src/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'],
    environment: 'node',
    globals: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/__tests__/**', 'src/index.ts'],
    },
  },
});
