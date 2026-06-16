import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Mirrors the @/* alias defined in jsconfig.json so vitest can follow imports
// through modules that use the Next.js-style alias (notably lib/mcp/*).
const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(here, '.'),
    },
  },
  test: {
    include: ['{lib,app,middleware}/**/*.test.js', 'middleware.test.js'],
    exclude: [
      '**/node_modules/**',
      '.next/**',
      'data/**',
      'lite-template/**',
      // Generative illustration spikes: render SVGs to
      // lite-template/integration/**/spike-output for visual review, not
      // load-bearing assertions, and dump ~hundreds of MB per full run. Run
      // one on demand: npx vitest run --config '' path/to/foo.spike.gen.test.js
      // Covers both spike families: *.spike.gen.test.js and *.spike.test.js.
      '**/*.gen.test.js',
      '**/*.spike.test.js',
    ],
  },
});
