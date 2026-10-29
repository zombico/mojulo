// The kit as pieces and the cloth's folds on the realistic body (realistic laws 8: body-relational-kit.js,
// body-relational-folds.js), each on the smallest made-up cloth that exercises it: a belt is one section top to bottom
// over whatever is worn under it, the hollows spanned; a pouch's back is pressed to what stands out most under it; webbing
// lies on the outermost thing it crosses; a fold only ever stands out from the cloth, where its motif lies, and never
// on cloth a belt cinches or a garment is worn over.
import { describe, it, expect } from 'vitest';
import { beltOn, frameBuckle, pouchOn, webbingOn, holsterOn, KIT } from './body-relational-kit.js';
import { foldCloth, FOLD_CLOTH } from './body-relational-folds.js';
import { ringSlots } from './body-relational-resample.js';
import { waistbandOf, cinchWaist } from './body-relational-tailor.js';

const SLOTS = ringSlots(16);
const angle = (j) => (2 * Math.PI * j) / SLOTS.length;
/** a tube up the z axis (or along `axis` from `base`), its radius `r(θ, z)` at each of its stations' heights */
function tube(zs, r, { group = 'Bottom', bone = 'pelvis', slots = SLOTS } = {}) {
  const ang = (j) => (2 * Math.PI * j) / slots.length;
  return { layer: 1, closure: 'closed', garment: true, group, slots, bind: { bone, blend: {} },
    stations: zs.map((z, i) => ({ id: `st${i}`, u: i, points: Object.fromEntries(slots.map((sl, j) => [sl, [Math.sin(ang(j)) * r(ang(j), z), Math.cos(ang(j)) * r(ang(j), z), z]])) })),
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

describe('a shoulder holster', () => {
  it('carries its pistol level, the grip raked down and forward out of its mouth, its back on the body, a hanger up', () => {
    // (the ribs a flat side at x = 0.15, the holster's length along +y, forward)
    const worn = range(-0.15, 0.15, 31).flatMap((y) => range(1.1, 1.4, 31).map((z) => [0.15, y, z]));
    const H = holsterOn([0.15, 0, 1.22], { fwd: [0, 1, 0], up: [0, 0, 1], out: [1, 0, 0] }, worn, { w: 0.19, h: 0.05, d: 0.032, id: 'h', gun: 'Gun' });
    expect(Object.keys(H).sort()).toEqual(['hBody', 'hGrip', 'hHanger', 'hSlide', 'hSnap', 'hStrap']);
    expect(Math.min(...pts(H.hBody).map((q) => q[0]))).toBeGreaterThan(0.15);
    // (the muzzle's end the smaller: the holster tapers back)
    const span = (P, y0) => { const q = pts(P).filter((p) => Math.abs(p[1] - y0) < 0.002); return Math.max(...q.map((p) => p[2])) - Math.min(...q.map((p) => p[2])); };
    expect(span(H.hBody, -0.095)).toBeLessThan(span(H.hBody, 0.095));
    // (the pistol out of the mouth, forward of it; the grip lower and further forward than the slide; both the gun's)
    const mean = (P, k) => pts(P).reduce((t, q) => t + q[k], 0) / pts(P).length;
    expect(mean(H.hSlide, 1)).toBeGreaterThan(0.095); expect(mean(H.hGrip, 2)).toBeLessThan(mean(H.hSlide, 2)); expect(mean(H.hGrip, 1)).toBeGreaterThan(mean(H.hSlide, 1));
    expect([H.hSlide.group, H.hGrip.group]).toEqual(['Gun', 'Gun']);
    expect(Math.max(...pts(H.hHanger).map((q) => q[2]))).toBeGreaterThan(1.22 + 0.05);
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

describe('a rig\'s straps on a body', async () => {
  const { kitPieces } = await import('./body-relational-kit.js');
  const { compileLayered } = await import('./station-loft.js');
  // (a torso up the z axis, a shirt over it, and two straps each from one side of the waist over a shoulder and back to
  // the same side, an X: the harness's walk on the torso's addresses, its half ring 8 slots)
  const torso = { ...tube(range(1.0, 1.45, 10), () => 0.14, { bone: 'torso' }), garment: undefined, group: 'Skin' };
  // (the shirt as dense as a tailor's cloth: a strap lies on the points under it)
  const shirt = tube(range(1.0, 1.45, 46), () => 0.146, { group: 'Top', bone: 'torso', slots: ringSlots(48) });
  const L1 = compileLayered({ schema: 'layered-v1', dials: {}, parts: { torso } }, {}, { details: false, creases: false }).parts;
  const X = (id, side, other) => ({ id, mode: 'strap', part: 'torso', width: 0.04, thick: 0.003, group: 'Strap', path: [[1, 4.2, side], [5, 7, side], [8.8, 5, other], [5, 1, other], [1, 3.8, side]] });
  it('anchors straps whose ends meet at the waist to one waist strap round the body, each cut on it', () => {
    const { parts, taken } = kitPieces({ parts: { torso } }, { top_body: shirt }, [X('harnessR', 'L', 'R'), X('harnessL', 'R', 'L')], { L1 });
    expect([...taken].sort()).toEqual(['harnessL', 'harnessR']);
    const waist = Object.keys(parts).filter((k) => /Waist_kit$/.test(k));
    expect(waist).toEqual(['harnessRWaist_kit']);
    // (round the whole body: every slot of it out over the shirt)
    for (const q of pts(parts.harnessRWaist_kit)) expect(radius(q), `waist ${q}`).toBeGreaterThan(0.146);
    // (each strap's ends on the band, its lowest point the band's middle, never run past it)
    const W = pts(parts.harnessRWaist_kit), mid = (Math.min(...W.map((q) => q[2])) + Math.max(...W.map((q) => q[2]))) / 2;
    for (const k of ['harnessR_kit', 'harnessL_kit']) expect(Math.min(...pts(parts[k]).map((q) => q[2]))).toBeGreaterThan(mid - 0.01);
    // (and every strap lies out over the shirt, its frames read out from the torso's axis whatever their handedness)
    for (const k of ['harnessR_kit', 'harnessL_kit']) for (const q of pts(parts[k])) if (q[2] > 1.05 && q[2] < 1.4) expect(radius(q), `${k} ${q}`).toBeGreaterThan(0.146);
  });
});

describe('a waistband (outfit law 2: no ease at the waist)', () => {
  // (a body narrowing to a waist at 1.05 over hips widest at 0.92; a tucked tail and trousers standing 2 cm off it)
  const body = (th, z) => 0.13 + 0.02 * Math.exp(-(((z - 0.92) / 0.06) ** 2));
  const zs = range(0.86, 1.08, 23), skin = tube(zs, body), tail = tube(zs, (th, z) => body(th, z) + 0.012), trousers = tube(zs, (th, z) => body(th, z) + 0.02);
  trousers.stations.forEach((st, i) => { st.u = 6 * i / (zs.length - 1); });
  const zone = waistbandOf(trousers, 5.6), r = (P, i) => radius(P.stations[i].points.front);
  cinchWaist(tail, pts(skin), zone); cinchWaist(trousers, [...pts(skin), ...pts(tail)], zone, { gap: 0.0035 });
  it('the band sits on what it is worn over, the tucked layer under it pressed to the skin', () => {
    const top = zs.length - 1;
    expect(r(tail, top) - r(skin, top)).toBeLessThan(0.0035);
    expect(r(trousers, top) - r(tail, top)).toBeGreaterThan(0.002);
    expect(r(trousers, top) - r(skin, top)).toBeLessThan(0.007);
  });
  it('the cloth below takes its ease back by the hips\' widest, and nothing goes inside what it is worn over', () => {
    const hip = zs.findIndex((z) => Math.abs(z - zone.zw) < 1e-9);
    expect(r(trousers, hip) - r(skin, hip)).toBeCloseTo(0.02, 4);
    for (let i = 0; i < zs.length; i++) for (const sl of SLOTS) expect(radius(trousers.stations[i].points[sl])).toBeGreaterThanOrEqual(radius(tail.stations[i].points[sl]) - 1e-6);
  });
});
