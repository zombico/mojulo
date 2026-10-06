import { defineConfig } from 'vitest/config';
import base from './vitest.config.js';

// The critical tier (`npm run test:critical`): the contracts a change can break without touching a kernel.
// The MCP surface and its byte pins, the plugin profile, the carve-out and removal guards, the database and its
// migrations, versions, auth, the bundled recipe book, the install scripts, the dashboard, and every
// characterization pin. The heavy generative suites (geometry, worlds, exports) run in the full `npm test`,
// which CI still runs; this tier is the quick check before a commit, not a replacement for it.
// Spread, not mergeConfig: mergeConfig concatenates `include`, which would run the whole suite.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: [
      'lib/mcp/**/*.test.js',
      'lib/db/**/*.test.js',
      'lib/version/**/*.test.js',
      'lib/auth/**/*.test.js',
      'lib/graph/views/recipe-book/**/*.test.js',
      '{app,components,scripts}/**/*.test.js',
      'middleware.test.js',
      'lib/**/*.char.test.js',
      'lib/**/*.trace.test.js',
    ],
    exclude: [
      ...base.test.exclude,
      // Kernel-heavy suites that happen to live under lib/mcp: each spends its time generating geometry.
      'lib/mcp/tools/update-sketch.solid.test.js',
      'lib/mcp/tools/export-model.bundle.test.js',
      'lib/mcp/tools/export-model.html.test.js',
      'lib/mcp/tools/compose-world.*.test.js',
      'lib/db/repositories/manji-program-embedding.test.js',
      'lib/graph/vegetation/plants.char.test.js',
    ],
  },
});
