import { describe, it, expect } from 'vitest';
import { outTrailSite, outTrailLaws } from './out-trail.js';
import { ISEKAI_STYLES } from './isekai.js';
import { NATURE_STYLES } from './nature.js';

// the trail grammar's laws hold at the ends of the dials' range: the shortest and longest run, the flattest and
// steepest heartbeat (era/out-trail.js). Each style meets each end once, a new seed at every corner.
const STYLES = { meadow: ISEKAI_STYLES['isekai-meadow'], valley: NATURE_STYLES['nature-trail'], alien: ISEKAI_STYLES['alien-night'] };
const RUNS = [12, 25], HEARTBEATS = [0, 1];
const lawsBroken = (s, id) => outTrailLaws(s).filter((l) => !l.ok).map((l) => `${id}: ${l.law} = ${l.value}`);

describe('out-trail sweep', () => {
  it('a trail after the meadow holds every law and its seam, at either end of the heartbeat', () => {
    const broken = HEARTBEATS.flatMap((heartbeat, i) => {
      const seed = i + 1;
      return lawsBroken(outTrailSite(STYLES.meadow, { id: 'next', heartbeat, run: 16, after: { id: 'meadow', heartbeat: 0.8, bumpiness: 0.6, seed: 8 } }, seed), `seed ${seed} heartbeat ${heartbeat}`);
    });
    expect(broken).toEqual([]);
  });

  for (const [name, st] of Object.entries(STYLES)) {
    it(`${name}: every law holds at the shortest and longest run, the flattest and steepest heartbeat`, () => {
      let seed = 0;
      const broken = RUNS.flatMap((run) => HEARTBEATS.flatMap((heartbeat) => {
        seed++;
        return lawsBroken(outTrailSite(st, { run, heartbeat, bumpiness: 0.6 }, seed), `run ${run} seed ${seed} heartbeat ${heartbeat}`);
      }));
      expect(broken).toEqual([]);
    });
  }
});
