/**
 * The test tiers keep their shape: the critical tier stays the quick check before a commit.
 *
 * Its `lib/mcp/**` include takes in any suite that lands under lib/mcp/tools, and the game and world suites that
 * walk levels in headless Chrome did, one by one, until a single file set the tier's floor at several minutes.
 * The e2e tier (vitest.e2e.config.js) holds them now. These checks keep it that way:
 *
 *   1. the e2e suites run in `npm run test:e2e` (CI runs it in its own job) and in neither `npm test` nor
 *      `npm run test:critical`;
 *   2. no critical-tier suite walks a level in the real browser: a mint with `autoAudit: true` there injects a
 *      stub `runTraversal`, the way the gate's orchestration is tested (lib/graph/game/mechanics-audit.test.js).
 *
 * A name on the list need not be on disk: the list merges into branches cut before some of its suites, and a
 * renamed browser suite still trips the second check.
 */
import { describe, it, expect } from 'vitest';
import { globSync, readFileSync } from 'node:fs';
import { dirname, matchesGlob, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import base from '../../vitest.config.js';
import critical from '../../vitest.critical.config.js';
import e2e, { E2E } from '../../vitest.e2e.config.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const matches = (file, globs) => globs.some((g) => matchesGlob(file, g));
// the files a config runs: its include globs, less its excludes
const tier = ({ test }) => [...new Set(test.include.flatMap((g) => globSync(g, { cwd: ROOT })))]
  .filter((f) => !matches(f, test.exclude));

describe('test tiers', () => {
  const CRITICAL = tier(critical);

  it('the e2e suites run in test:e2e, and in neither npm test nor test:critical', () => {
    expect(E2E.filter((f) => !matches(f, e2e.test.include) || matches(f, e2e.test.exclude))).toEqual([]);
    expect(E2E.filter((f) => !matches(f, base.test.exclude))).toEqual([]);
    expect(E2E.filter((f) => CRITICAL.includes(f))).toEqual([]);
  });

  it('no critical-tier suite walks a level in the real browser', () => {
    const walks = CRITICAL.filter((f) => {
      const src = readFileSync(resolve(ROOT, f), 'utf8');
      return /\bauto_?audit\s*:\s*true\b/i.test(src) && !/\brunTraversal\b/.test(src);
    });
    expect(walks, 'add these to E2E in vitest.e2e.config.js, or inject a stub runTraversal').toEqual([]);
  });
});
