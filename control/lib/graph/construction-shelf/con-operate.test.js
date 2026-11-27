// A machine made to be operated (con-operate.js): each part rides the deepest joint that moves it and hangs from the
// part the joint before moves; its placement under its parent, sampled across its joint, composed down the chain, lands
// where the shelf itself builds it at any joint values, rams and linkage included. One archetype (an excavator), its
// samples coarse: the concept, not the catalog.
import { describe, it, expect } from 'vitest';
import { operatorRig, OPERATED } from './con-operate.js';
import { assembleMachine } from './index.js';
import { lowerAssemblerBuild } from '../worlds/workbench-assembler.js';

const A = Object.keys(OPERATED)[0], R = operatorRig(A, { step: 10 });
const mul = (X, Y) => [0, 1, 2].flatMap((r) => [0, 1, 2, 3].map((c) => X[r * 4] * Y[c] + X[r * 4 + 1] * Y[4 + c] + X[r * 4 + 2] * Y[8 + c] + (c === 3 ? X[r * 4 + 3] : 0)));
const sample = (P, v) => { const J = R.joints[P.joint], u = Math.max(0, Math.min(J.n - 1, ((v - J.lo) / (J.hi - J.lo)) * (J.n - 1))), i = Math.min(J.n - 2, Math.floor(u)), f = u - i; return Array.from({ length: 12 }, (_, k) => P.table[i * 12 + k] * (1 - f) + P.table[(i + 1) * 12 + k] * f); };
const world = (i, pose) => { const P = R.parts[i]; if (P.joint < 0) return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]; const L = sample(P, pose[R.joints[P.joint].name]); return P.parent < 0 ? L : mul(world(P.parent, pose), L); };

describe('a machine made to be operated', () => {
  it('its joints in the chain\'s order, each part on the deepest that moves it, hung from the part the joint before moves', () => {
    expect(R.joints.map((j) => j.name)).toEqual(['slew', 'boom', 'stick', 'tool']);
    expect(R.joints[0].wrap).toBe(true);
    const by = Object.fromEntries(R.parts.map((P) => [P.id, P]));
    expect([by.house.joint, by.boom.joint, by.stick.joint, by.bucket.joint]).toEqual([0, 1, 2, 3]);
    expect([R.parts[by.boom.parent].id, R.parts[by.stick.parent].id, R.parts[by.bucket.parent].id]).toEqual(['house', 'boom', 'stick']);
    expect(R.parts[R.tip.part].id).toBe(OPERATED[A].tool);
    for (const P of R.parts) { expect(P.pos.length).toBe(P.tris * 9); expect(P.table.length).toBe(P.joint < 0 ? 0 : R.joints[P.joint].n * 12); }
  });
  it('composed down the chain at any joint values, every part lands where the shelf builds it (within a few centimetres, its samples coarse)', () => {
    const pose = { slew: 52, boom: 25, stick: -70, tool: -10 }, B = lowerAssemblerBuild(assembleMachine(A, { pose, laws: false }).manifest);
    let worst = 0;
    R.parts.forEach((P, i) => {
      const M = world(i, pose), pl = B.placements.find((x) => x.id === P.id), shelf = B.faces.slice(pl.faceStart, pl.faceStart + pl.faceCount).flatMap((f) => f.corners);
      for (let t = 0; t < Math.min(P.tris, 30); t++) {
        const q = P.pos.slice(t * 9, t * 9 + 3), w = [0, 1, 2].map((r) => M[r * 4] * q[0] + M[r * 4 + 1] * q[1] + M[r * 4 + 2] * q[2] + M[r * 4 + 3]);
        worst = Math.max(worst, Math.min(...shelf.map((c) => Math.hypot(c[0] - w[0], c[1] - w[1], c[2] - w[2]))));
      }
    });
    expect(worst).toBeLessThan(0.06);
  });
});
