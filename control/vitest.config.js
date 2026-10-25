import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Mirrors the @/* alias defined in jsconfig.json so vitest can follow imports
// through modules that use the Next.js-style alias (notably lib/mcp/*).
const here = dirname(fileURLToPath(import.meta.url));

// The e2e tier (`npm run test:e2e`, vitest.e2e.config.js): whole worlds made through the real MCP handlers, and
// games minted with `autoAudit: true`, whose gate walks every level in headless Chrome. Together they were a third
// of the suite's time, so `npm test` leaves them out and CI runs them once, in their own job, rather than on every
// leg of the matrix. Listed here so both configs read one list; the e2e config re-exports it.
// A list, not a suffix: a rename would collide with every branch still editing these files.
export const E2E = [
  'lib/mcp/tools/gameworld-city.test.js',
  'lib/mcp/tools/building-level.test.js',
  'lib/mcp/tools/design-game.test.js',
  'lib/mcp/tools/design-game.quick.test.js',
  'lib/graph/car-designer/racer-live.test.js',
  'lib/mcp/tools/export-model.realistic.test.js',
  'lib/graph/board/board-page.live.test.js',
  'lib/graph/contest/meet-page.live.test.js',
  'lib/graph/contest/court-page.live.test.js',
  'lib/graph/contest/turns-page.live.test.js',
  'lib/graph/game/play-shell-final.live.test.js',
  'lib/graph/science-worlds/conformance.chrome.test.js',
  'lib/graph/science-worlds/relativistic/conformance.chrome.test.js',
  'lib/graph/science-worlds/quantum/conformance.chrome.test.js',
  'lib/graph/science-worlds/classical/conformance.chrome.test.js',
  'lib/mcp/tools/science-setting.test.js',
];

// What no tier but its own runs (the e2e config takes this, less the e2e suites themselves).
export const EXCLUDE = [
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
  // The deep tier: exhaustive sweeps (every word at its range ends, every named preset built) that take minutes
  // and only say something when the module they sweep changed. `npm run test:deep` runs them all;
  // `npm run test:deep:changed` runs only those whose imports touch a changed file; CI runs them all.
  '**/*.deep.test.js',
  // The Godot tier's matrix (`npm run test:godot`, vitest.godot.config.js): every cosmos fixture made into a game,
  // exported and played in both engines. Minutes, and only with MOJULO_GODOT.
  '**/*.godot.test.js',
];

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
    setupFiles: ['./vitest.setup.js'],
    include: ['{lib,app,components,middleware,scripts}/**/*.test.js', 'middleware.test.js'],
    exclude: [...EXCLUDE, ...E2E],
  },
});
