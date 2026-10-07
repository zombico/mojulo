import { describe, it, expect } from 'vitest';
import { MADE_PATTERNS, MADE_PATTERN_IDS, MADE_KITS, MADE_RAILS, madeStyle, designPiece } from './out-made.js';

// the rails sit inside the laws: every kit, seed and pattern, and every dimension at both ends of its rail (era/out-made.js)
describe('out-made sweep', () => {
  for (const kit of MADE_KITS) it(`${kit}: every pattern holds its laws for every seed`, () => {
    const broken = [];
    for (let seed = 1; seed <= 150; seed++) {
      const st = madeStyle(kit, seed);
      for (const id of MADE_PATTERN_IDS) for (const l of designPiece(id, st, seed).laws) if (l.ok === false) broken.push(`${id} seed ${seed}: ${l.law} = ${l.value}`);
    }
    expect(broken).toEqual([]);
  });

  it('every dimension at either end of its rail, in every kit\'s thinnest and chunkiest tokens', () => {
    const broken = [];
    for (const kit of MADE_KITS) for (const chunk of MADE_RAILS[kit].chunk) for (const seed of [1, 2, 3]) {
      const st = madeStyle(kit, seed, { tokens: { chunk } });
      for (const id of MADE_PATTERN_IDS) for (const [k, rail] of Object.entries(MADE_PATTERNS[id].rails)) for (const v of [rail[0], rail[1]]) {
        for (const l of designPiece(id, st, seed, { [k]: v }).laws) if (l.ok === false) broken.push(`${kit} ${id} ${k}=${v}: ${l.law} = ${l.value}`);
      }
    }
    expect(broken).toEqual([]);
  });
});
