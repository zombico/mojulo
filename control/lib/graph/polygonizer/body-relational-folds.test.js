// body-relational-folds.test.js — a FOLD RING's weights (body-relational-folds.js refine): a ring the folds insert between
// two rings takes its neighbours' weights mixed, held to the four strongest and made whole, as every other mixed ring is.
// The case that wanted it: the realistic body under the ranger's kit or a mantle, whose shirt's fold rings between a ring on
// the clavicle, scapula and arm and one on the lumbar carried five bones and were refused at the rig gate.
import { describe, expect, it } from 'vitest';

import { foldCloth } from './body-relational-folds.js';
import { mixW } from './body-relational-resample.js';

const SLOTS = ['front', 'a1R', 'sideR', 'b1R', 'back', 'b1L', 'sideL', 'a1L'];
/** a sleeve tube down z (rings 2 cm apart, radius 4 cm), each ring weighing `blendOf(i)` */
function sleeve(blendOf) {
  const stations = Array.from({ length: 8 }, (_, i) => ({ id: `st${i}`, u: i, points: Object.fromEntries(SLOTS.map((sl, k) => { const a = (2 * Math.PI * k) / SLOTS.length; return [sl, [0.3 + 0.04 * Math.sin(a), 0.04 * Math.cos(a), 1.2 - 0.02 * i]]; })) }));
  const blend = {}; stations.forEach((st, i) => { for (const sl of SLOTS) blend[`${st.id}.${sl}`] = blendOf(i); });
  return { top_armR: { layer: 1, garment: true, group: 'Top', slots: SLOTS, stations, caps: { back: [0.3, 0, 1.21], tip: [0.3, 0, 1.05] }, bind: { bone: 'upperArmR', blend } } };
}
const ELBOW = { elbowR: [0.3, 0, 1.13] };
const inserted = (P) => P.stations.filter((st) => /f\d+$/.test(st.id));

describe('a fold ring\'s weights', () => {
  it('two neighbours of four bones each, five between them: the ring keeps the four strongest, whole', () => {
    const A = { clavicleR: 0.2, scapulaR: 0.1, torso: 0.6, upperArmR: 0.1 }, B = { lumbar: 0.3, scapulaR: 0.1, torso: 0.5, upperArmR: 0.1 };
    const parts = foldCloth(sleeve((i) => (i % 2 ? B : A)), { joints: ELBOW });
    const P = parts.top_armR, rings = inserted(P);
    expect(rings.length).toBeGreaterThan(0);
    for (const st of rings) for (const sl of SLOTS) {
      const w = P.bind.blend[`${st.id}.${sl}`], e = Object.entries(w);
      expect(e.length).toBeLessThanOrEqual(4);
      expect(e.every(([, x]) => x >= 0)).toBe(true);
      expect(Math.abs(e.reduce((t, [, x]) => t + x, 0) - 1)).toBeLessThan(1e-9);
    }
  });
  it('a mix of four or fewer is the plain mix, as it was', () => {
    const A = { torso: 0.7, upperArmR: 0.3 }, B = { torso: 0.4, upperArmR: 0.6 };
    const P = foldCloth(sleeve((i) => (i % 2 ? B : A)), { joints: ELBOW }).top_armR;
    const st = inserted(P)[0], [, a, k] = st.id.match(/^(st\d+)f(\d+)$/), i = Number(a.slice(2)), n = inserted(P).filter((x) => x.id.startsWith(`${a}f`)).length;
    expect(P.bind.blend[`${st.id}.front`]).toEqual(mixW(i % 2 ? B : A, (i + 1) % 2 ? B : A, Number(k) / (n + 1)));
  });
});
