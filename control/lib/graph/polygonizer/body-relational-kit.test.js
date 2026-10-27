// The kit as pieces and the cloth's folds on the realistic body (realistic laws 8: body-relational-kit.js,
// body-relational-folds.js), each on the smallest made-up cloth that exercises it: a belt is one section top to bottom
// over whatever is worn under it, the hollows spanned; a pouch's back is pressed to what stands out most under it; webbing
// lies on the outermost thing it crosses; a fold only ever stands out from the cloth, where its motif lies, and never
// on cloth a belt cinches or a garment is worn over.
import { describe, it, expect } from 'vitest';
import { beltOn, frameBuckle, pouchOn, webbingOn, KIT } from './body-relational-kit.js';
import { foldCloth, FOLD_CLOTH } from './body-relational-folds.js';
import { ringSlots } from './body-relational-resample.js';

const SLOTS = ringSlots(16);
const angle = (j) => (2 * Math.PI * j) / SLOTS.length;
/** a tube up the z axis (or along `axis` from `base`), its radius `r(θ, z)` at each of its stations' heights */
function tube(zs, r, { group = 'Bottom', bone = 'pelvis' } = {}) {
  return { layer: 1, closure: 'closed', garment: true, group, slots: SLOTS, bind: { bone, blend: {} },
    stations: zs.map((z, i) => ({ id: `st${i}`, u: i, points: Object.fromEntries(SLOTS.map((sl, j) => [sl, [Math.sin(angle(j)) * r(angle(j), z), Math.cos(angle(j)) * r(angle(j), z), z]])) })),
    caps: { back: [0, 0, zs[0] - 0.001], tip: [0, 0, zs[zs.length - 1] + 0.001] } };
}
const pts = (P) => P.stations.flatMap((st) => Object.values(st.points));
const radius = (p) => Math.hypot(p[0], p[1]);
const range = (a, b, n) => Array.from({ length: n }, (_, k) => a + ((b - a) * k) / (n - 1));

describe('a belt', () => {
  // (cloth that ripples round the waist and a hollow at the back, where the spine dips)
  const cloth = tube(range(0.9, 1.2, 31), (th, z) => 0.15 + 0.006 * Math.sin(5 * th + 40 * z) - (Math.abs(th - Math.PI) < 0.2 ? 0.03 : 0));
  const belt = beltOn(cloth, pts(cloth), 1.05, { width: 0.04, thick: 0.004 });
  it('is one section top to bottom: every ring the same shape, its edges rounded in', () => {
    const outer = belt.stations.slice(2, -2).map((st) => SLOTS.map((sl) => radius(st.points[sl])));
    for (const ring of outer) ring.forEach((r, j) => expect(r).toBeCloseTo(outer[0][j], 9));
    expect(radius(belt.stations[0].points.front)).toBeLessThan(radius(belt.stations[2].points.front));
  });
  it('clears everything worn under it across its whole width, and spans the hollow at the back', () => {
    const inner = SLOTS.map((sl) => radius(belt.stations[0].points[sl]));
    for (const q of pts(cloth)) if (Math.abs(q[2] - 1.05) < 0.02) { const j = Math.round(((Math.atan2(q[0], q[1]) + 2 * Math.PI) % (2 * Math.PI)) / angle(1)) % SLOTS.length; expect(inner[j]).toBeGreaterThanOrEqual(radius(q) - 0.0005); }
    // (the hollow spanned: the belt's back on the chord across the dent, never dipping into it)
    const back = inner[SLOTS.indexOf('back')];
    expect(back).toBeGreaterThan(0.144 * Math.cos(Math.PI / 8)); expect(back).toBeGreaterThan(0.126 + 0.006 + 0.002);
    expect(belt.bind.bone).toBe('pelvis');
  });
  it('takes a frame buckle on its front: four bars, a tongue, the tail through it and a keeper', () => {
    const B = frameBuckle({ ...belt, group: 'Leather' }, 'beltBuckle');
    expect(Object.keys(B).sort()).toEqual(['Bottom', 'Keeper', 'Left', 'Right', 'Tail', 'Tongue', 'Top'].map((k) => `beltBuckle${k}`).sort());
    // (on the front, standing off the belt's face)
    for (const P of Object.values(B)) expect(Math.min(...pts(P).map((q) => q[1]))).toBeGreaterThan(radius(belt.stations[2].points.front) - KIT.belt.gap - 0.001);
  });
});

describe('a pouch', () => {
  it('presses its back flat to what stands out most under it, its flap over its top, its closure and seams on its front', () => {
    const worn = [[0, 0.15, 1], [0.02, 0.162, 1.01], [-0.03, 0.155, 0.98], [0, 0.4, 1]];
    const P = pouchOn([0, 0.15, 1], { a: [1, 0, 0], b: [0, 0, 1], out: [0, 1, 0] }, worn, { w: 0.08, h: 0.11, d: 0.045, id: 'pouch' });
    expect(Object.keys(P).sort()).toEqual(['pouchBody', 'pouchFlap', 'pouchSeamL', 'pouchSeamR', 'pouchSnap', 'pouchTab']);
    // (its back on the farthest point under its footprint, a point far out in front of it ignored)
    expect(Math.min(...pts(P.pouchBody).map((q) => q[1]))).toBeGreaterThan(0.162);
    expect(Math.min(...pts(P.pouchBody).map((q) => q[1]))).toBeLessThan(0.17);
    // (the flap above the body's top and over its front)
    const top = Math.max(...pts(P.pouchBody).map((q) => q[2]));
    expect(Math.max(...pts(P.pouchFlap).map((q) => q[2]))).toBeGreaterThan(top);
    expect(Math.max(...pts(P.pouchFlap).map((q) => q[1]))).toBeGreaterThan(Math.max(...pts(P.pouchBody).map((q) => q[1])));
  });
});

describe('webbing', () => {
  it('lies on the outermost thing it crosses, never standing off it or sinking into it', () => {
    // (a strap down a flat front at y = 0.15, a belt standing 1 cm out across its lower half)
    const bases = range(1.3, 1.0, 7).map((z) => [0, 0.15, z]), ns = bases.map(() => [0, 1, 0]);
    const worn = [...range(-0.05, 0.05, 11).flatMap((x) => range(1.0, 1.3, 31).map((z) => [x, 0.15, z])), ...range(-0.05, 0.05, 11).flatMap((x) => range(1.0, 1.08, 9).map((z) => [x, 0.16, z]))];
    const S = webbingOn(bases, ns, worn, { w: 0.04, t: 0.003 });
    const innerAt = (z0) => { const st = S.stations.reduce((b, st) => (Math.abs(st.points[S.slots[0]][2] - z0) < Math.abs(b.points[S.slots[0]][2] - z0) ? st : b)); return st.points[S.slots[0]][1]; };
    expect(innerAt(1.25)).toBeGreaterThan(0.15); expect(innerAt(1.25)).toBeLessThan(0.154);
    expect(innerAt(1.03)).toBeGreaterThan(0.16);
  });
});

describe('the cloth\'s folds', () => {
  // (a sleeve hanging down the z axis, its elbow at its middle, and trousers under a belt)
  const make = () => ({ top_armR: tube(range(1.0, 1.4, 21), () => 0.045, { group: 'Top' }), bottom_legR: tube(range(0.1, 0.9, 41), () => 0.07, { group: 'Bottom' }), top_body: tube(range(0.95, 1.4, 46), () => 0.15, { group: 'Top' }) });
  const joints = { elbowR: [0, 0, 1.2], wristR: [0, 0, 1.0], kneeR: [0, 0, 0.5] };
  it('only ever stands out from the cloth, most on the bend\'s inner side, and refines the cloth where it lies', () => {
    const P = make(), before = JSON.parse(JSON.stringify(P));
    foldCloth(P, { joints, belts: [[1.02, 1.06]], boots: { R: 0.2 }, order: ['top', 'bottom'] });
    expect(P.top_armR.stations.length).toBeGreaterThan(before.top_armR.stations.length);
    const R0 = { top_armR: 0.045, bottom_legR: 0.07, top_body: 0.15 };
    for (const k of Object.keys(P)) for (const q of pts(P[k])) expect(radius(q)).toBeGreaterThanOrEqual(R0[k] - 1e-6);
    // (the elbow's inner side, +y, raised; its outer side, −y, left)
    const raised = (side) => Math.max(...P.top_armR.stations.filter((st) => Math.abs(st.points.front[2] - 1.2) < 0.04).map((st) => radius(st.points[side]) - 0.045));
    expect(raised('front')).toBeGreaterThan(FOLD_CLOTH.knit.h * 0.5);
    expect(raised('back')).toBeLessThan(1e-6);
    // (the cloth a belt cinches flat; the shirt bloused just above it)
    const at = (z) => P.top_body.stations.filter((st) => Math.abs(st.points.front[2] - z) < 0.003).map((st) => radius(st.points.front) - 0.15);
    for (const d of at(1.04)) expect(d).toBeLessThan(1e-6);
    expect(Math.max(...at(1.072))).toBeGreaterThan(0.004);
    // (the same cloth, the same folds)
    const again = make(); foldCloth(again, { joints, belts: [[1.02, 1.06]], boots: { R: 0.2 }, order: ['top', 'bottom'] });
    expect(again).toEqual(P);
  });
  it('leaves a piece a garment is worn over there: the outer one carries the fold', () => {
    const P = { ...make(), outer_armR: tube(range(1.0, 1.4, 21), () => 0.055, { group: 'Outer' }) }, before = JSON.parse(JSON.stringify(P.top_armR));
    foldCloth(P, { joints, order: ['top', 'bottom', 'outer'] });
    expect(P.top_armR).toEqual(before);
    expect(P.outer_armR.stations.length).toBeGreaterThan(21);
  });
});
