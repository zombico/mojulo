import { defineConfig } from 'vitest/config';
import base, { E2E, EXCLUDE } from './vitest.config.js';

// The e2e tier (`npm run test:e2e`): whole worlds made through the real MCP handlers, and games minted with
// `autoAudit: true`, whose gate walks every level in headless Chrome (the world emitted as one inline page, loaded
// twice per level, stepped tick by tick). Each costs minutes, and the cost grows with the worlds. `npm test` leaves
// them out (the list lives in vitest.config.js) and CI runs this tier in its own job, on one leg. They live under
// lib/mcp/tools, so the critical tier's `lib/mcp/**` would take them in: it inherits the base exclude, and its guard
// (lib/mcp/test-tiers.test.js) refuses a critical-tier suite that walks a level in the real browser. Run this tier
// before a commit that touches the gameworld, city, game or structure kernels, and before merging into the release
// candidate.
export { E2E };

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: E2E,
    exclude: EXCLUDE,
  },
});
