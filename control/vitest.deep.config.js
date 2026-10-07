import { defineConfig } from 'vitest/config';
import base from './vitest.config.js';

// The deep tier: only the *.deep.test.js sweeps, which the default config excludes. Their imports are the
// geometry modules they sweep (never the MCP registry), so `--changed` selects them tightly: change
// anime-head.js and the anime sweeps run; change a city kernel and none do.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ['{lib,app,components,scripts}/**/*.deep.test.js'],
    exclude: base.test.exclude.filter((g) => g !== '**/*.deep.test.js'),
  },
});
