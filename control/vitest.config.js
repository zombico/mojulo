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
    // The heaviest generative tests (fractal-city / subway-building sampling
    // loops, plus the MCP-server import that populates the tool registry)
    // legitimately run several seconds each and cross Vitest's 5s default
    // under full-suite parallel load — flaking as timeouts and, worse, as
    // partial-registration assertion failures when ensureToolsRegistered()
    // is aborted mid-import. Give the slow tail real headroom.
    testTimeout: 30000,
    // Same headroom for hooks: mcp-orbit / runner.integration beforeEach
    // re-boots the DB + tool registry, which crosses the 10s hook default
    // under full-suite load and cascades into "Unknown tool" failures.
    hookTimeout: 30000,
    include: ['{lib,app,middleware,scripts}/**/*.test.js', 'middleware.test.js'],
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
