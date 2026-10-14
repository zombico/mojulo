import { describe, it, expect } from 'vitest';
import { speciesParams } from './species.js';
import { buildFauna } from './build.js';
import { PER_RIG } from './test-cases.js';
import { locomotionFor } from './locomotion/index.js';

// Growth, read on one species per rig: `scale` grows the whole animal about the ground point, and `legScale`
// lengthens the legs under a trunk that keeps its size. Both keep the feet on z = 0 and leave x and y to the legs' rows.
const joints = (P) => buildFauna(P).joints;   // rounded to the micron
// legScale stretches legs that stand: a wing-walker's folded fore limb lies along x and cannot be stretched in z
const legged = PER_RIG.filter((id) => speciesParams(id).legs?.length && locomotionFor(speciesParams(id).family, id).rig !== 'wingwalker');

describe('fauna growth', () => {
  it('scale grows every joint about the ground point', () => {
    for (const id of PER_RIG) {
      const P = speciesParams(id), k = P.scale ?? 1, A = joints(P), B = joints({ ...P, scale: 2 * k });
      expect(Object.keys(B), id).toEqual(Object.keys(A));
      for (const [j, v] of Object.entries(A)) v.forEach((x, a) => expect(Math.abs(B[j][a] - 2 * x), `${id}.${j}`).toBeLessThan(1e-5));
    }
  });

  it('legScale lengthens the legs: feet stay down, the trunk rises whole, nothing moves across or along', () => {
    expect(legged.length).toBeGreaterThan(1);
    for (const id of legged) {
      const P = speciesParams(id), A = joints(P), B = joints({ ...P, legScale: 1.5 });
      const legJ = new Set(P.legs.flatMap((r) => [r[1], r[2]]));
      for (const [j, v] of Object.entries(A)) {
        expect([B[j][0], B[j][1]], `${id}.${j} keeps x and y`).toEqual([v[0], v[1]]);
        if (Math.abs(v[2]) < 1e-9) expect(Math.abs(B[j][2]), `${id}.${j} stays on the ground`).toBeLessThan(1e-5);
      }
      const body = Object.keys(A).filter((j) => !legJ.has(j)), rise = B[body[0]][2] - A[body[0]][2];
      expect(rise, `${id} rises`).toBeGreaterThan(0);
      for (const j of body) expect(Math.abs(B[j][2] - A[j][2] - rise), `${id}.${j} rises with the trunk`).toBeLessThan(1e-5);
    }
  });
});
