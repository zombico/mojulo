// body-relational-ornament.test.js — what is worked on the realistic body's tailored cloth (body-relational-wear.js): a
// skirt's hem work as a motif (`hemMotif`: a thread in peaks and a rule under it, lying on the skirt's flare, its ends a
// thread's and never a disc across the skirt) and a medallion's necklace laid on what is worn (`layNecklaces`: the chain
// on the cloth at the front and out of it elsewhere, the pendant on the chest). Smallest inputs: a flared tube, a
// cylinder of cloth.
import { describe, expect, it } from 'vitest';
import { hemMotif, layNecklaces } from './body-relational-wear.js';

const N = 24, SLOTS = Array.from({ length: N }, (_, k) => `s${k}`);
// a flared skirt: rings from the waist (z 1, r 0.15) down to the hem (z 0.2, r 0.3), and its lining
const radiusAt = (z) => 0.15 + (1 - z) * 0.1875;
const ring = (z, id, r = radiusAt(z)) => ({ id, points: Object.fromEntries(SLOTS.map((sl, k) => [sl, [r * Math.sin((2 * Math.PI * k) / N), r * Math.cos((2 * Math.PI * k) / N), z]])) });
const SKIRT = { closure: 'closed', slots: SLOTS, stations: [...Array.from({ length: 33 }, (_, k) => ring(1 - k * 0.025, `stSkirt${32 - k}`)), ring(0.7, 'stSkirtLining', 0.06)], bind: { bone: 'pelvis', blend: {} } };
const MOTIF = { amp: 0.011, period: 4, h: 0.0065, rule: 0.005, gap: 0.02, lift: 0.0015 };

describe('the hem work as a motif', () => {
  const M = hemMotif(SKIRT, 0.32, MOTIF);
  it('a thread in peaks and a rule under it, each lying on the cloth where the skirt flares', () => {
    for (const P of [M.work, M.rule]) for (const st of P.stations) for (const p of Object.values(st.points)) {
      const r = Math.hypot(p[0], p[1]); expect(Math.abs(r - radiusAt(p[2]))).toBeLessThan(0.006);
    }
    const zOf = (P) => P.stations.map((st) => (st.points.s01R[2] + st.points.s01L[2]) / 2), zw = zOf(M.work), zr = zOf(M.rule);
    expect(Math.max(...zw) - Math.min(...zw)).toBeCloseTo(2 * MOTIF.amp, 3);
    expect(Math.max(...zr) - Math.min(...zr)).toBeLessThan(1e-6);
    expect(Math.max(...zr)).toBeLessThan(Math.min(...zw));
  });
  it('each is a thread round the skirt, its ends a thread\'s, never a disc across it', () => {
    for (const P of [M.work, M.rule]) {
      expect(P.stations.length).toBe(N + 1);
      for (const [cap, st] of [[P.caps.back, P.stations[0]], [P.caps.tip, P.stations[P.stations.length - 1]]]) expect(Math.hypot(cap[0] - st.points.front[0], cap[1] - st.points.front[1])).toBeLessThan(0.01);
    }
  });
  it('none where the skirt has no ring below the border; deterministic', () => {
    expect(hemMotif(SKIRT, 0.21, MOTIF)).toBeNull();
    expect(JSON.stringify(hemMotif(SKIRT, 0.32, MOTIF))).toBe(JSON.stringify(M));
  });
});

describe('a necklace laid on what is worn', () => {
  // a trunk of cloth, a cylinder of radius 0.14 from z 1.0 to 1.42, and a neck (0.06) above it; front +y
  const pts = [];
  for (let z = 1.0; z <= 1.6; z += 0.01) for (let k = 0; k < 72; k++) { const a = (2 * Math.PI * k) / 72, r = z <= 1.42 ? 0.14 : 0.06; pts.push([r * Math.sin(a), r * Math.cos(a), z]); }
  const torso = { stations: [1.0, 1.2, 1.4, 1.6].map((z) => ({ points: { a: [0.01, 0, z], b: [-0.01, 0, z] } })) };
  // the chain as the authored body hung it: inside this cloth, lowest at the front
  const loop = Array.from({ length: 20 }, (_, i) => { const a = (2 * Math.PI * i) / 20, c = Math.cos(a); return [Math.sin(a) * 0.1, 0.02 + c * 0.1, 1.38 - c * 0.08]; });
  const kit = [
    { id: 'medallion', ghost: true, part: 'torso', signature: { kind: 'polyline', pts: [...loop, loop[0]], r: 0.006 } },
    { id: 'medallionBail', ghost: true, part: 'torso', signature: { kind: 'polyline', pts: [loop[0], [0, 0.12, 1.27]], r: 0.007 } },
    { id: 'medallionPendant', ghost: true, part: 'torso', signature: { kind: 'disc', c: [0, 0.12, 1.24], n: [0, 1, 0.12], r: 0.04, h: 0.014 } },
    { id: 'belt', mode: 'band', part: 'pelvis', s: [1, 2] },
  ];
  const L = layNecklaces(kit, pts, torso);
  it('the chain, its bail and its pendant are laid; nothing else in the kit is', () => {
    expect([...L.keys()].sort()).toEqual(['medallion', 'medallionBail', 'medallionPendant']);
  });
  it('the chain lies outside the cloth everywhere, on it at the front', () => {
    const chain = L.get('medallion').pts;
    for (const p of chain) { const r = Math.hypot(p[0], p[1]), cloth = p[2] <= 1.42 ? 0.14 : 0.06; expect(r).toBeGreaterThan(cloth); }
    const front = chain[0]; expect(front[1]).toBeGreaterThan(0.14); expect(front[1]).toBeLessThan(0.14 + 0.006 + 0.003 + 0.002);
  });
  it('the pendant hangs from the chain\'s lowest point, on the chest by half its thickness', () => {
    const c = L.get('medallionPendant').c, bail = L.get('medallionBail').pts;
    expect(bail[0]).toEqual(L.get('medallion').pts[0]);
    expect(c[1]).toBeGreaterThan(0.14 + 0.007); expect(c[1]).toBeLessThan(0.14 + 0.007 + 0.01);
    expect(c[2]).toBeLessThan(bail[0][2]);
  });
  it('nothing to lay without a necklace; deterministic', () => {
    expect(layNecklaces([kit[3]], pts, torso).size).toBe(0);
    expect(JSON.stringify([...layNecklaces(kit, pts, torso)])).toBe(JSON.stringify([...L]));
  });
});
