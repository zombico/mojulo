/**
 * THE GEOCITY'S STREET KIT — the metro city's own doodads at true size, in metres, as TEMPLATES a scene stamps where
 * they stand (instanced repeats, drawn near the camera only). Each piece is the legacy metro's boxes (fractal-city.js
 * kerbLamp, intersectionDoodads: a lamp standard and its arm and head, a signal pole and its housing and lenses, a
 * street-name sign, a tram pole) made round by its round kit (city/round-kit.js roundStreetKit → roundKitFaces: a
 * tapered standard on its collar, a lathed head, lenses, galvanized posts), baked under the scene's light once a
 * facing (the light is baked, so a piece is never yawed: each way it faces is its own template). The paint and the
 * rails are flat pieces laid along a street.
 *
 *   kitTemplates(L) → { lamp, signal, pole, stop, bench, papers, hydro: { e, w, n, s }, sign, bin, hydrant, ring,
 *                       bollard, dash, line, yellow, rail, wire, bar }   faces in metres about the piece's foot
 *     a facing is the way its arm reaches (a lamp's over the road, a signal's mast over the lanes it faces, a pole's
 *     bracket over the tracks); `dash` a lane line's 3 m dash, `line` a solid white line's 10 m, `yellow` a centre
 *     line's 10 m pair, `rail` a 10 m pair of rails at the track's gauge, `wire` a unit span (stretched by a per-axis
 *     scale), `bar` a crosswalk's bar, all along +x, flat (their light the same any way they lie);
 *     the furniture: `bench` (facing), `bin`, `hydrant`, `papers` (along the kerb its facing runs), `ring`, `bollard`,
 *     `hydro` a residential street's wooden pole, its crossarm and the lamp hung off it (facing); a site's and a lot's:
 *     `scaffold` a bay against a wall (facing out of it), `fence` a temporary panel, `hoarding` a plywood one, `barrier`,
 *     `cone`, `car` (facing: its length along x for e/w, y for n/s; its body pale for an instance's tint), `stall`
 *
 * Pure; no dice.
 */
import { roundStreetKit, roundKitFaces, isRoundKitShape } from '../city/round-kit.js';
import { litFactor, scaleHex } from '../polygonizer/vexar.js';

// the legacy metro's kit, at its scale (fractal-city.js: a city unit is 3.66 m; a kerb lamp's standard 2.35 units tall)
const U = 3.66;
const FACE = { e: [1, 0], w: [-1, 0], n: [0, 1], s: [0, -1] };

const quad = (c, n, fill, L) => ({ corners: c, normal: n, fill: scaleHex(fill, litFactor(n, L)) });
/** A box's five faces (its roof and walls), lit. */
function boxFaces(b, L) {
  const { x, y, w, d } = b, z0 = b.z0 || 0, z1 = b.z1, x1 = x + w, y1 = y + d, t = b.tint;
  return [
    quad([[x, y, z1], [x1, y, z1], [x1, y1, z1], [x, y1, z1]], [0, 0, 1], t, L),
    quad([[x, y, z0], [x1, y, z0], [x1, y, z1], [x, y, z1]], [0, -1, 0], t, L), quad([[x1, y, z0], [x1, y1, z0], [x1, y1, z1], [x1, y, z1]], [1, 0, 0], t, L),
    quad([[x1, y1, z0], [x, y1, z0], [x, y1, z1], [x1, y1, z1]], [0, 1, 0], t, L), quad([[x, y1, z0], [x, y, z0], [x, y, z1], [x, y1, z1]], [-1, 0, 0], t, L),
  ];
}
/** A piece's boxes made round by the metro's kit and realized. */
const realize = (boxes, L) => roundStreetKit(boxes, { profile: 'metro' }).flatMap((b) => (isRoundKitShape(b.shape) ? roundKitFaces(b, L) : boxFaces(b, L)));
/** A box about a foot, its reach `a` metres along (dx, dy) from it, `w` across, z0…z1. */
const reach = (kind, dx, dy, a0, a1, w, z0, z1, tint) => (dx ? { kind, x: Math.min(dx * a0, dx * a1), w: Math.abs(a1 - a0), y: -w / 2, d: w, z0, z1, tint } : { kind, y: Math.min(dy * a0, dy * a1), d: Math.abs(a1 - a0), x: -w / 2, w, z0, z1, tint });

/** The kerb lamp (fractal-city.js kerbLamp at the metro's scale): a standard, its arm, its head over the road. */
function lamp([dx, dy], L) {
  return realize([
    { kind: 'street-lamp', x: -0.045 * U, y: -0.045 * U, w: 0.09 * U, d: 0.09 * U, z0: 0, z1: 2.35 * U, tint: '#555b62' },
    reach('street-lamp', dx, dy, 0, 0.46 * U, 0.07 * U, 2.18 * U, 2.26 * U, '#555b62'),
    reach('street-lamp', dx, dy, 0.37 * U, 0.55 * U, 0.16 * U, 2.06 * U, 2.22 * U, '#f0d982'),
  ], L);
}
/** A signal (intersectionDoodads at the metro's scale): its pole, a mast arm over the lanes, a housing and three lenses. */
function signal([dx, dy], L) {
  const top = 6.2, arm = 5.5;
  return realize([
    { kind: 'street-signal', x: -0.16, y: -0.16, w: 0.32, d: 0.32, z0: 0, z1: top, tint: '#3a3d42' },
    // (the mast arm a rod: the kit's bracket arm, as a tram pole's; a signal's other raised parts are its lenses)
    reach('tram-bracket', dx, dy, 0, arm, 0.16, top - 0.5, top - 0.32, '#3a3d42'),
    reach('street-signal', dx, dy, arm - 0.5, arm, 0.45, top - 1.55, top - 0.3, '#26282b'),
    ...['#e0463a', '#e3b13a', '#46c06a'].map((c, i) => ({ ...reach('street-signal', dx, dy, arm - 0.44, arm - 0.06, 0.3, top - 0.7 - i * 0.38, top - 0.42 - i * 0.38, c) })),
  ], L);
}
/** A street-name sign at a corner: its galvanized post and its blade. */
const sign = (L) => realize([
  { kind: 'street-sign', x: -0.09, y: -0.09, w: 0.18, d: 0.18, z0: 0, z1: 3.4, tint: '#6b7176' },
  { kind: 'street-sign', x: -0.75, y: -0.05, w: 1.5, d: 0.1, z0: 2.9, z1: 3.3, tint: '#2f7a4a' },
], L);
/** A streetcar's pole at the kerb and its bracket reaching over the tracks (the overhead's). */
function pole([dx, dy], reachM, L) {
  return realize([
    { kind: 'tram-pole', x: -0.14, y: -0.14, w: 0.28, d: 0.28, z0: 0, z1: 7.2, tint: '#4a5058' },
    reach('tram-bracket', dx, dy, 0, reachM, 0.08, 6.4, 6.5, '#3a3d42'),
  ], L);
}
/** A streetcar stop at the kerb: its post and flag, and a small shelter beside it. */
function stop([dx, dy], L) {
  const back = [-dx, -dy];
  return realize([
    { kind: 'platform-post', x: -0.06, y: -0.06, w: 0.12, d: 0.12, z0: 0, z1: 2.8, tint: '#c8432f' },
    { kind: 'street-sign', x: -0.25, y: -0.04, w: 0.5, d: 0.08, z0: 2.2, z1: 2.75, tint: '#c8432f' },
    // the shelter: a roof on two posts, its glass back to the walk
    reach('shelter', back[0] || 1, back[1], 1.2, 4.6, 1.6, 2.4, 2.55, '#3a4048'),
    reach('shelter', back[0] || 1, back[1], 1.2, 4.6, 0.05, 0, 2.4, '#9fb4c0'),
  ], L);
}
/** A bench (fractal-city.js parkBench at a person's size): two seat planks, two back planks on its frame, its back to
 *  the way it faces' opposite (it looks toward (dx, dy)). */
function bench([dx, dy], L) {
  const wood = '#8a6c43', frame = '#3d444b', len = 1.8, a = (lo, hi) => (dx ? { y: -len / 2, d: len, x: Math.min(-dx * lo, -dx * hi), w: Math.abs(hi - lo) } : { x: -len / 2, w: len, y: Math.min(-dy * lo, -dy * hi), d: Math.abs(hi - lo) });
  return realize([
    { kind: 'park-bench', ...a(-0.22, -0.04), z0: 0.42, z1: 0.47, tint: wood }, { kind: 'park-bench', ...a(0.0, 0.18), z0: 0.42, z1: 0.47, tint: wood },
    { kind: 'park-bench', ...a(0.22, 0.28), z0: 0.55, z1: 0.68, tint: wood }, { kind: 'park-bench', ...a(0.22, 0.28), z0: 0.74, z1: 0.88, tint: wood },
    ...[-0.75, 0.68].map((e) => ({ kind: 'park-bench', ...(dx ? { y: e, d: 0.07, x: -0.3, w: 0.6 } : { x: e, w: 0.07, y: -0.3, d: 0.6 }), z0: 0, z1: 0.42, tint: frame })),
  ], L);
}
/** A litter bin (fractal-city.js's park bin, round by the kit: a drum, its lid) at the kerb. */
const bin = (L) => realize([
  { kind: 'park-bin', x: -0.28, y: -0.28, w: 0.56, d: 0.56, z0: 0, z1: 0.82, tint: '#2f4a3a' },
  { kind: 'park-bin', x: -0.33, y: -0.33, w: 0.66, d: 0.66, z0: 0.82, z1: 0.98, tint: '#2b2e31' },
], L);
/** A fire hydrant: its barrel, its bonnet and its two nozzles. */
const hydrant = (L) => realize([
  { kind: 'park-bin', x: -0.13, y: -0.13, w: 0.26, d: 0.26, z0: 0, z1: 0.62, tint: '#c8372b' },
  { kind: 'park-bin', x: -0.16, y: -0.16, w: 0.32, d: 0.32, z0: 0.62, z1: 0.74, tint: '#d8d4c8' },
  { kind: 'hydrant', x: -0.24, y: -0.05, w: 0.48, d: 0.1, z0: 0.42, z1: 0.52, tint: '#c8372b' },
], L);
/** A row of newspaper boxes at a corner: three boxes on their legs, each its own colour. */
const papers = ([dx], L) => realize(['#2a4f8a', '#c8a23a', '#8a2a2a'].flatMap((c, i) => {
  const box = (a, b, w, z0, z1, tint) => (dx ? { kind: 'papers', y: a, d: w, x: b, w, z0, z1, tint } : { kind: 'papers', x: a, w, y: b, d: w, z0, z1, tint });
  return [box(-0.75 + i * 0.5, -0.22, 0.42, 0.35, 1.05, c), box(-0.62 + i * 0.5, -0.08, 0.14, 0, 0.35, '#3d444b')];
}), L);
/** A post-and-ring bike stand (a main street's): its post and its ring, as a galvanized post and a rod. */
const ring = (L) => realize([
  { kind: 'street-sign', x: -0.04, y: -0.04, w: 0.08, d: 0.08, z0: 0, z1: 0.95, tint: '#6b7176' },
  { kind: 'tram-bracket', x: -0.3, y: -0.02, w: 0.6, d: 0.04, z0: 0.72, z1: 0.76, tint: '#6b7176' },
], L);
/** A stainless bollard (the metro's drop-off bollard). */
const bollard = (L) => realize([{ kind: 'drop-off-bollard', x: -0.11, y: -0.11, w: 0.22, d: 0.22, z0: 0, z1: 0.95, tint: '#9aa0a6' }], L);
/** A wooden hydro pole (fractal-city.js's power pole at its size), its crossarm across the street it serves, and a lamp
 *  hung off it over the road (a residential street's cobra head), reaching (dx, dy). */
function hydro([dx, dy], L) {
  const top = 10.5;
  return realize([
    { kind: 'power-pole', x: -0.15, y: -0.15, w: 0.3, d: 0.3, z0: 0, z1: top, tint: '#5a4f44' },
    { kind: 'crossarm', ...(dx ? { x: -0.06, w: 0.12, y: -1.1, d: 2.2 } : { y: -0.06, d: 0.12, x: -1.1, w: 2.2 }), z0: top - 0.5, z1: top - 0.36, tint: '#4a4138' },
    reach('street-lamp', dx, dy, 0, 1.8, 0.08, 7.6, 7.7, '#555b62'),
    reach('street-lamp', dx, dy, 1.4, 2.0, 0.3, 7.45, 7.62, '#f0d982'),
  ], L);
}
/** A scaffold bay against a wall: two standards, its ledgers at the lift, a plank deck and a toe board, the bay 2 m
 *  along the wall (x) and 2 m a lift high, standing `out` off the wall (its wall to −y, the bay toward +y facing (dx, dy)). */
function scaffold([dx, dy], L) {
  const steel = '#a8acb0', plank = '#b08a52', out = 1.1;
  const B = (x0, y0, x1, y1, z0, z1, kind, tint) => (dx ? { kind, x: Math.min(dx * y0, dx * y1), w: Math.abs(y1 - y0), y: x0, d: x1 - x0, z0, z1, tint } : { kind, x: x0, w: x1 - x0, y: Math.min(dy * y0, dy * y1), d: Math.abs(y1 - y0), z0, z1, tint });
  return realize([
    B(-1.03, 0.25, -0.97, 0.31, 0, 2, 'scaffold', steel), B(0.97, 0.25, 1.03, 0.31, 0, 2, 'scaffold', steel),
    B(-1.03, out, -0.97, out + 0.06, 0, 2, 'scaffold', steel), B(0.97, out, 1.03, out + 0.06, 0, 2, 'scaffold', steel),
    B(-1, out, 1, out + 0.05, 1.95, 2, 'scaffold', steel), B(-1, out, 1, out + 0.05, 0.95, 1.0, 'scaffold', steel),
    B(-1, 0.25, 1, out + 0.05, 1.9, 1.95, 'scaffold', plank), B(-1, out, 1, out + 0.03, 1.95, 2.12, 'scaffold', '#d8a03a'),
  ], L);
}
/** A temporary fence panel (3.5 m, its mesh a pale sheet on its frame) on its two feet, along x. */
const fence = (L) => realize([
  { kind: 'temp-fence', x: -1.75, y: -0.02, w: 3.5, d: 0.04, z0: 0.12, z1: 2.0, tint: '#c4c8cc' },
  ...[-1.75, 1.7].map((x) => ({ kind: 'temp-fence', x, y: -0.03, w: 0.05, d: 0.06, z0: 0, z1: 2.05, tint: '#8a8e92' })),
  ...[-1.75, 1.7].map((x) => ({ kind: 'temp-fence', x: x - 0.2, y: -0.15, w: 0.45, d: 0.3, z0: 0, z1: 0.12, tint: '#5a5d61' })),
], L);
/** A site's plywood hoarding panel (2.4 m), painted, along x. */
const hoarding = (L) => realize([{ kind: 'hoarding', x: -1.2, y: -0.03, w: 2.4, d: 0.06, z0: 0, z1: 2.44, tint: '#d6c49a' }, { kind: 'hoarding', x: -1.2, y: -0.05, w: 2.4, d: 0.1, z0: 2.4, z1: 2.5, tint: '#2f5a3a' }], L);
/** A plastic barrier, orange and white in bands, along x. */
const barrier = (L) => realize([0, 1, 2, 3].map((i) => ({ kind: 'barrier', x: -0.9, y: -0.2, w: 1.8, d: 0.4, z0: i * 0.22, z1: (i + 1) * 0.22, tint: i % 2 ? '#f2efe6' : '#e2662a' })), L);
/** A traffic cone (a tapered post, the kit's round, on its square foot) and its band. */
const cone = (L) => realize([
  { kind: 'cone-foot', x: -0.2, y: -0.2, w: 0.4, d: 0.4, z0: 0, z1: 0.04, tint: '#2b2e31' },
  { kind: 'power-pole', x: -0.14, y: -0.14, w: 0.28, d: 0.28, z0: 0.04, z1: 0.72, tint: '#e2662a', round: { taper: 0.2 } },
], L);
/** A parked car (its body pale, so an instance's tint is its paint; its cabin's glass dark), its length along x. */
const car = ([dx], L) => {
  const along = !!dx, Lb = 4.3, Wb = 1.8, B = (l, w, z0, z1, tint, kind = 'car') => (along ? { kind, x: -l / 2, w: l, y: -w / 2, d: w, z0, z1, tint } : { kind, y: -l / 2, d: l, x: -w / 2, w, z0, z1, tint });
  return realize([B(Lb, Wb, 0.3, 0.95, '#e8e8e8'), B(2.3, 1.6, 0.95, 1.45, '#2a3038'), B(Lb - 0.6, Wb + 0.04, 0, 0.32, '#1c1d1f')], L);
};
/** A flat piece along +x, `len` long, `w` across at offset `off`, at z 0. */
const flat = (len, w, off, fill, L) => [quad([[0, off - w / 2, 0], [len, off - w / 2, 0], [len, off + w / 2, 0], [0, off + w / 2, 0]], [0, 0, 1], fill, L)];

export function kitTemplates(L, { gauge = 1.495, poleReach = 4 } = {}) {
  const four = (f) => Object.fromEntries(Object.entries(FACE).map(([k, v]) => [k, f(v)]));
  return {
    lamp: four((v) => lamp(v, L)),
    signal: four((v) => signal(v, L)),
    sign: sign(L),
    pole: four((v) => pole(v, poleReach, L)),
    stop: four((v) => stop(v, L)),
    dash: flat(3, 0.12, 0, '#e8e4d8', L),
    line: flat(10, 0.12, 0, '#e8e4d8', L),
    yellow: [...flat(10, 0.1, -0.12, '#e3b13a', L), ...flat(10, 0.1, 0.12, '#e3b13a', L)],
    rail: [...flat(10, 0.1, -gauge / 2, '#b4b7bc', L), ...flat(10, 0.1, gauge / 2, '#b4b7bc', L)],
    wire: [quad([[0, -0.015, 0], [1, -0.015, 0], [1, 0.015, 0], [0, 0.015, 0]], [0, 0, 1], '#202224', L)],
    bar: flat(3, 0.6, 0, '#e3ded0', L),
    // a street tree's pit in the walk: its grate's dark square, centred
    pit: [quad([[-0.7, -0.7, 0], [0.7, -0.7, 0], [0.7, 0.7, 0], [-0.7, 0.7, 0]], [0, 0, 1], '#3b3a38', L)],
    bench: four((v) => bench(v, L)),
    bin: bin(L), hydrant: hydrant(L), papers: four((v) => papers(v, L)), ring: ring(L), bollard: bollard(L),
    hydro: four((v) => hydro(v, L)),
    // a site's and a lot's: scaffolding against a wall (facing out from it), fencing, hoarding, barriers, cones, a
    // parked car (along x for 'e'/'w', y for 'n'/'s'), a stall's line
    scaffold: four((v) => scaffold(v, L)), fence: fence(L), hoarding: hoarding(L), barrier: barrier(L), cone: cone(L),
    car: four((v) => car(v, L)), stall: flat(5, 0.12, 0, '#e8e4d8', L),
  };
}
