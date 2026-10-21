// footwear.test.js — the library on a stub foot adapter (a box foot, toes and shank, each a ring per station): the parts
// read nothing of a body but its adapter. The sole split at the toe base and under the foot, the straps at their shares
// with a buckle on the outer side, a sandal with no upper, a part not asked for adding nothing, the same twice.
import { describe, it, expect } from 'vitest';

import { wearFootwear } from './index.js';

// a ring of 8 round `c`: level (the shank's), or square to y (the foot's and the toes', `rz` its half height)
const ring = (c, rx, rz, level) => Object.fromEntries(Array.from({ length: 8 }, (_, j) => { const a = (2 * Math.PI * j) / 8;
  return [`s${j}`, level ? [c[0] + rx * Math.cos(a), c[1] + rz * Math.sin(a), c[2]] : [c[0] + rx * Math.cos(a), c[1], c[2] + rz * Math.sin(a)]]; }));
// a segment from `from` to `to`, 9 stations, u 0 … 2
const seg = (bone, from, to, rx, rz) => ({ layer: 0, closure: 'closed', slots: Array.from({ length: 8 }, (_, j) => `s${j}`),
  stations: Array.from({ length: 9 }, (_, i) => ({ id: `st${i}`, u: i / 4, points: ring(from.map((x, q) => x + ((to[q] - x) * i) / 8), rx, rz, from[2] !== to[2]) })),
  caps: { back: from, tip: to }, bind: { bone } });
// (the foot and the toes: rings in the xz plane, square to y; the shank: rings level)
const skin = { footR: seg('footR', [0.1, 0, 0.03], [0.1, 0.12, 0.03], 0.04, 0.03), toesR: seg('toesR', [0.1, 0.12, 0.03], [0.1, 0.2, 0.03], 0.035, 0.03), shankR: seg('shankR', [0.1, 0, 0.45], [0.1, 0, 0.06], 0.045, 0.045) };
const stub = { sides: ['R'], seg: (kind, S) => `${kind}${S}`, joints: () => ({ ankle: [0.1, 0, 0.06], toeBase: [0.1, 0.12, 0.02], toeTip: [0.1, 0.2, 0.015] }),
  bare: (name) => skin[name], u: (_k, share) => 2 * share,
  upper: (F, { id, group }) => Object.fromEntries(['footR', 'toesR', ...(F.height === 'boot' ? ['shankR'] : [])].map((n) => [`${id}_${n}`, { ...skin[n], layer: 1, group }])) };

describe('footwear on a foot adapter', () => {
  it('a shoe: its upper, a sole under the foot and the toes split at the toe base, a strap and its buckle outside', () => {
    const W = wearFootwear(stub, { height: 'shoe', sole: 0.008, welt: 0.003, straps: [{ on: 'foot', at: 0.5 }], buckle: true }, { id: 'shoe' });
    expect(Object.keys(W.parts).sort()).toEqual(['shoeBuckle0_footR', 'shoeSole_footR', 'shoeSole_toesR', 'shoeStrap0_footR', 'shoe_footR', 'shoe_toesR']);
    const ys = (P) => P.stations.flatMap((s) => Object.values(s.points)).map((p) => p[1]);
    expect(Math.max(...ys(W.parts.shoeSole_footR))).toBeLessThan(Math.min(...ys(W.parts.shoeSole_toesR)) + 0.02);
    for (const k of ['shoeSole_footR', 'shoeSole_toesR']) expect(Object.values(W.parts[k].stations[0].points)[0][2]).toBeCloseTo(0, 6);
    // the buckle on the right foot's outer (+x) side of its strap
    const bx = Object.values(W.parts.shoeBuckle0_footR.stations[0].points)[0][0];
    expect(bx).toBeGreaterThan(0.1);
    expect(W.tones).toMatchObject({ Sole: expect.any(String), Strap: expect.any(String), Brass: expect.any(String) });
  });

  it('a sandal has no upper, its straps on the bare foot; what is not asked for adds nothing; the same twice', () => {
    const spec = { upper: false, sole: 0.01, welt: 0.004, straps: [{ on: 'foot', at: 0.3 }] };
    const W = wearFootwear(stub, spec, { id: 'sandal' });
    expect(Object.keys(W.parts).sort()).toEqual(['sandalSole_footR', 'sandalSole_toesR', 'sandalStrap0_footR']);
    expect(W.parts.sandalStrap0_footR.bind.bone).toBe('footR');
    expect(JSON.stringify(wearFootwear(stub, spec, { id: 'sandal' }))).toBe(JSON.stringify(W));
  });
});
