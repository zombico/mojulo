import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  resolve: { alias: { '@': resolve(here, '.') } },
  test: {
    include: ['**/*.spike.gen.test.js'],
    exclude: ['**/node_modules/**', '.next/**', 'data/**'],
  },
});
