import { describe, it, expect } from 'vitest';
import { outTrailSite, outTrailLaws } from './out-trail.js';
import { ISEKAI_STYLES } from './isekai.js';
import { NATURE_STYLES } from './nature.js';

// the trail grammar's laws hold over the dials' range: every seed, heartbeat and run (era/out-trail.js)
const STYLES = { meadow: ISEKAI_STYLES['isekai-meadow'], valley: NATURE_STYLES['nature-trail'], alien: ISEKAI_STYLES['alien-night'] };

describe('out-trail sweep', () => {
  it('a trail after the meadow holds every law and its seam, for every seed and heartbeat', () => {
    const st = STYLES.meadow, broken = [];
    for (let seed = 1; seed <= 8; seed++) for (const heartbeat of [0, 0.5, 1]) {
      const s = outTrailSite(st, { id: 'next', heartbeat, run: 16, after: { id: 'meadow', heartbeat: 0.8, bumpiness: 0.6, seed: 8 } }, seed);
      for (const l of outTrailLaws(s)) if (!l.ok) broken.push(`seed ${seed} heartbeat ${heartbeat}: ${l.law} = ${l.value}`);
    }
    expect(broken).toEqual([]);
  }, 240000);

  for (const [name, st] of Object.entries(STYLES)) for (const run of [12, 16, 20, 25]) {
    it(`${name}, a ${run} s run: every law holds for every seed and heartbeat`, () => {
      const broken = [];
      for (let seed = 1; seed <= 8; seed++) for (const heartbeat of [0, 0.5, 1]) {
        const s = outTrailSite(st, { run, heartbeat, bumpiness: 0.6 }, seed);
        for (const l of outTrailLaws(s)) if (!l.ok) broken.push(`seed ${seed} heartbeat ${heartbeat}: ${l.law} = ${l.value}`);
      }
      expect(broken).toEqual([]);
    }, 240000);
  }
});
