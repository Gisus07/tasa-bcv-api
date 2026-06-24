// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Generados, vendored y código heredado — no se lintean.
    ignores: [
      'dist/**',
      'coverage/**',
      'drizzle/**',
      'legacy/**',
      'fixtures/**',
      // Scripts utilitarios sueltos (debug/one-off) fuera del tsconfig de la app.
      'scripts/**',
      'eslint.config.mjs',
      '*.config.ts',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // `any` es inevitable en los borders externos (xlsx, cheerio, undici).
      '@typescript-eslint/no-explicit-any': 'off',
      // Una promesa sin await suele ser un bug real (no ruido de borders) → visible.
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/require-await': 'warn',
      // Pasar un callback async a APIs que esperan `() => void` (node-cron schedule,
      // handlers de Hono) es intencional: el runner ejecuta la promesa por su cuenta.
      // checksVoidReturn:false conserva la regla para los demás casos de mal uso.
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: false },
      ],
      // Las reglas type-aware `no-unsafe-*` se APAGAN: el `any` proviene de los
      // borders externos sin tipos fiables (parseo XLS con xlsx, scraping HTML con
      // cheerio, respuestas de undici). En "error" rompían el CI sin acción práctica;
      // la deuda se acota tipando esos borders, no silenciando línea a línea.
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
);
