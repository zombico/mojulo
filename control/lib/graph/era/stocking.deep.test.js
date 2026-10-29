// Every base building (programs.js BASE_USES), composed and stocked (stocking.js): every room the tables stock holds its
// stock, and every supply-chain and dressing law holds.
import { describe, expect, it } from 'vitest';
import { resolveCompose } from './compose.js';
import { resolveProps } from './compose-lay.js';
import { planStage } from './stage.js';
import { withProgram, BASE_USES } from './programs.js';

describe('every base building is stocked by its laws', () => {
  for (const use of BASE_USES) {
    it(use, () => {
      const m = resolveProps(resolveCompose({ kind: 'stage', program: { use, seed: 1 }, compose: 'military greys' }));
      for (const l of planStage(withProgram(m)).compose.dress) expect(l.ok, `${use} ${l.id}: ${l.says}`).toBe(true);
    });
  }
});
