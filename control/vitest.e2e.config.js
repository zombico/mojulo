import { defineConfig } from 'vitest/config';
import base from './vitest.config.js';

// The e2e tier (`npm run test:e2e`): whole worlds made through the real MCP handlers, and games minted with
// `autoAudit: true`, whose gate walks every level in headless Chrome (the world emitted as one inline page, loaded
// twice per level, stepped tick by tick). Each costs minutes, and the cost grows with the worlds. They live under
// lib/mcp/tools, so the critical tier's `lib/mcp/**` would take them in: it excludes this list instead, and its
// guard (lib/mcp/test-tiers.test.js) refuses a critical-tier suite that walks a level in the real browser. They
// stay in `npm test`, which CI runs. Run this tier before a commit that touches the gameworld, city, game or
// structure kernels, and before merging into the release candidate.
// A list, not a suffix: a rename would collide with every branch still editing these files.
export const E2E = [
  'lib/mcp/tools/gameworld-city.test.js',
  'lib/mcp/tools/building-level.test.js',
  'lib/mcp/tools/design-game.test.js',
  'lib/mcp/tools/design-game.quick.test.js',
  'lib/graph/car-designer/racer-live.test.js',
];

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: E2E,
  },
});
