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
 * With the cube's `exaggerate` (era/exaggerate.js, `opts.exaggerate`), every piece is chunked (each box's two thin
 * dimensions × kit.chunk about its middle: a post fatter, an arm as long) and a lamp and a signal lean out over their
 * reach by kit.lean, re-lit on their leaning faces (a pole that carries wires stands: its wires are strung to it). A
 * site's and a lot's pieces (scaffold, fencing, hoarding, barriers, cones, cars) are as they were. Absent, every byte
 * as it was. `piece(kind, facing, v)` makes the geotown's pieces at the metro's size (geotown/doodads.js,
 * signs.js, receptacles.js: a round lamp, a signal on its mast arm with a head at its end and one on its pole, a bin, a
 * hydrant, a post box, a sign `sign-<kind>`, a receptacle by its RECEPTACLES id facing its front), as { body, fixed }:
 * its body what a stamp's ink paints (drawn as made: the scene pales it), the rest (its lenses, its glass, a sign's
 * face) keeping its own colours: a plain metro's as they are made (the realistic register), an exaggerated one's
 * chunked and leant, in a `toon` register LOUD_VARIANTS shapes of each, each exaggerated and incongruent.
 *
 * Pure; a loud piece's shapes each by its own fixed dice.
 */
import { roundStreetKit, roundKitFaces, isRoundKitShape } from '../city/round-kit.js';
import { litFactor, scaleHex } from '../polygonizer/vexar.js';
import { leanFaces, skewCorners } from '../era/exaggerate.js';
import { toyCarOf, proportions, lampOf, postOf, binOf, hydrantOf, postboxOf, lathe, tilted, tube } from '../geotown/doodads.js';
import { signalHead, mastArm, signOf, place } from '../geotown/signs.js';
import { receptacleOf, RECEPTACLES } from '../geotown/receptacles.js';
import { popHex } from '../geotown/front-loud.js';
import { mulberry32, strHash } from '../city/plan/dice.js';
import { tan } from '../../util/dmath.js';

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
// the chunk an exaggerated kit's light carries (kitTemplates): its pieces' boxes thickened as they are realized
const CHUNKS = new WeakMap();
/** A box's two thin dimensions × c about its middle (its longest kept: an arm still reaches, a post still stands). */
function chunk(b, c) {
  const h = b.z1 - (b.z0 || 0), dims = [b.w, b.d, h], long = dims.indexOf(Math.max(...dims)), z0 = b.z0 || 0;
  const out = { ...b };
  if (long !== 0) { out.w = b.w * c; out.x = b.x + b.w / 2 - out.w / 2; }
  if (long !== 1) { out.d = b.d * c; out.y = b.y + b.d / 2 - out.d / 2; }
  if (long !== 2) { const m = z0 + h / 2; out.z0 = Math.max(0, m - (h * c) / 2); out.z1 = out.z0 + h * c; }
  return out;
}
/** A piece's boxes made round by the metro's kit and realized (chunked first when the light is an exaggerated kit's). */
const realize = (boxes, L) => { const c = CHUNKS.get(L); return roundStreetKit(c ? boxes.map((b) => chunk(b, c)) : boxes, { profile: 'metro' }).flatMap((b) => (isRoundKitShape(b.shape) ? roundKitFaces(b, L) : boxFaces(b, L))); };
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
/** A quay's railing panel, 2.5 m along x: its two posts, a top rail and a mid rail, galvanized (pale: a loud stamp's
 *  ink paints it). */
const railing = (L) => [
  ...[-1.25, 1.19].map((x) => ({ x, y: -0.03, w: 0.06, d: 0.06, z0: 0, z1: 1.1 })), { x: -1.25, y: -0.035, w: 2.5, d: 0.07, z0: 1.04, z1: 1.12 },
  { x: -1.25, y: -0.025, w: 2.5, d: 0.05, z0: 0.52, z1: 0.57 },
].flatMap((b) => boxFaces({ ...b, tint: '#7c8288' }, L));
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
/** A toy car along (dx, dy)'s axis, its faces lit as the kit's are: its body pale (an instance's tint paints it). */
function toyCar([dx], L) {
  return litKit(toyCarOf(dx ? 'u' : 'v', '#e8e8e8', proportions(() => 0.5, false)), (f) => f.hex ?? (f.role === 'cabin' ? '#2a3038' : '#e8e8e8'), L);
}
/** The geotown's faces ({ corners, out, role | hex }) lit as the kit's: each turned to its out, baked by its colour. */
const litKit = (fs, hexOf, L) => fs.map((f) => { const c = f.corners, n = newellK(c), o = f.out ?? n, nn = n[0] * o[0] + n[1] * o[1] + n[2] * o[2] < 0 ? n.map((v) => -v) : n; return { corners: nn === n ? c : c.slice().reverse(), normal: nn, fill: scaleHex(hexOf(f), litFactor(nn, L)) }; });
const newellK = (c) => { const n = [0, 0, 0]; for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); } const l = Math.hypot(...n) || 1; return n.map((v) => v / l); };
/** A flat piece along +x, `len` long, `w` across at offset `off`, at z 0. */
const flat = (len, w, off, fill, L) => [quad([[0, off - w / 2, 0], [len, off - w / 2, 0], [len, off + w / 2, 0], [0, off + w / 2, 0]], [0, 0, 1], fill, L)];

// ── an exaggerated metro's pieces, the geotown's (doodads.js, signs.js, receptacles.js): round, lathed; in a toon
// register each of LOUD_VARIANTS shapes exaggerated and incongruent, a stamp picking one ──
export const LOUD_VARIANTS = 3;
// (a house's pieces, stamped on its walls and its yard: kit.js housePiece; a window's shapes, a loud one's off square)
export const HOUSE_KINDS = new Set(['window', 'door', 'fence']), WINDOW_SHAPES = 6;
// (the paints of its signs' and signals' roles, signs.js; a loud street's popped but the dark and the white)
const SIGN_PAINT = { frame: '#ece8de', glass: '#2a3340', door: '#5a3a2a', fence: '#8a6a4a', bollard: '#24272b', 'canopy-a': '#f4f2ea', 'canopy-b': '#2f6fb0', pole: '#555b62', signal: '#26282b', plate: '#22252b', border: '#f2d23a', rim: '#1c1d20', 'lens-red': '#e0463a', 'lens-amber': '#e3b13a', 'lens-green': '#46c06a', 'sign-red': '#c8202a', 'sign-white': '#f4f2ea', 'sign-yellow': '#f2c21a', 'sign-blue': '#1f5aa8', 'sign-green': '#1f6e3a', slot: '#1d2023', streetbin: '#2f4a3a', hydrant: '#c8372b', yellow: '#e3b13a', cap: '#d8d4c8', postbox: '#c8372b', lamp: '#f0d982' };
const KEEP = new Set(['plate', 'rim', 'slot', 'sign-white', 'signal', 'pole', 'cap', 'canopy-a', 'bollard', 'frame', 'glass', 'door', 'fence']);
// (the roles a stamp's ink paints: its body; the rest, its lenses, its glass, its sign's face, keep their own colours)
const BODY = new Set(['pole', 'signal', 'streetbin', 'hydrant', 'postbox', 'bollard', 'canopy-b', 'frame', 'door', 'fence']);
/** Faces in the local frame turned so its −y (a receptacle's front) looks toward (vx, vy). */
const facingOf = (fs, [vx, vy]) => { const a = Math.atan2(vy, vx) + Math.PI / 2, c = Math.cos(a), sn = Math.sin(a), T = ([x, y, z]) => [x * c - y * sn, x * sn + y * c, z]; return fs.map((f) => ({ ...f, corners: f.corners.map(T), out: f.out ? T(f.out) : f.out })); };
const LAMP_H = 2.35 * U, SIG_TOP = 6.2, SIG_ARM = 5.5;
// (a house's window, its door and a metre of its fence, in the frame of the wall they stand on: `t` along it, out of it
// toward (dx, dy); a window's shape v > 0 pulled off square by k, at least three corners off 90°: era/exaggerate.js)
const WIN = [1.2, 1.4], WIN_FRAME = 0.12;
function housePiece(kind, [dx, dy], v, k) {
  const at = (tt, z, p) => [-dy * tt + dx * p, dx * tt + dy * p, z], o = [dx, dy, 0];
  if (kind === 'door') return [{ corners: [at(-0.5, 0, 0.04), at(0.5, 0, 0.04), at(0.5, 2.1, 0.04), at(-0.5, 2.1, 0.04)], out: o, role: 'door' }];
  if (kind === 'fence') return [{ corners: [at(-0.5, 0, 0.012), at(0.5, 0, 0.012), at(0.5, 1.15, 0.012), at(-0.5, 1.15, 0.012)], out: o, role: 'fence' }, { corners: [at(0.5, 0, -0.012), at(-0.5, 0, -0.012), at(-0.5, 1.15, -0.012), at(0.5, 1.15, -0.012)], out: [-dx, -dy, 0], role: 'fence' }];
  const gw = WIN[0] - 2 * WIN_FRAME, gh = WIN[1] - 2 * WIN_FRAME, off = v > 0 && k > 0 ? skewCorners(strHash(`window|${v}`), gw, gh, k, 4.5) : [[0, 0], [0, 0], [0, 0], [0, 0]];
  const inner = [[-gw / 2, WIN_FRAME], [gw / 2, WIN_FRAME], [gw / 2, WIN_FRAME + gh], [-gw / 2, WIN_FRAME + gh]].map((p, i) => [p[0] + off[i][0], p[1] + off[i][1]]);
  const cu = inner.reduce((a, p) => a + p[0], 0) / 4, cz = inner.reduce((a, p) => a + p[1], 0) / 4, outer = inner.map(([u, z]) => [u + Math.sign(u - cu) * WIN_FRAME, z + Math.sign(z - cz) * WIN_FRAME]);
  const out = [{ corners: inner.map(([u, z]) => at(u, z, 0.03)), out: o, role: 'glass' }];
  for (let q = 0; q < 4; q++) { const b = (q + 1) % 4; out.push({ corners: [at(...outer[q], 0.08), at(...outer[b], 0.08), at(...inner[b], 0.08), at(...inner[q], 0.08)], out: o, role: 'frame' }); }
  return out;
}
function loudPiece(kind, [dx, dy], D, R) {
  if (kind === 'lamp') return lampOf(0, 0, 0, [dx, dy], LAMP_H, D);
  if (kind === 'signal') {
    // its pole, a mast arm out over the lanes (dx, dy), a head at its end and one on the pole, each looking across the
    // crossing (the arm's way turned a quarter left: the far side's approach)
    const head = [-dy, dx], zA = SIG_TOP - 0.4;
    return [
      ...postOf(0, 0, 0, SIG_TOP, 0.16, 'pole', D),
      ...place(mastArm(SIG_ARM, D), [0, 0, zA], [dy, -dx]),
      ...place(signalHead(D, R), [dx * SIG_ARM * 0.9, dy * SIG_ARM * 0.9, zA - 0.3 - 1.12], head),
      ...place(signalHead(D, R), [head[0] * 0.32, head[1] * 0.32, 2.6], head),
    ];
  }
  if (kind === 'bin') return binOf(0, 0, 0, D);
  if (kind === 'hydrant') return hydrantOf(0, 0, 0, [dx, dy], D);
  if (kind === 'postbox') return postboxOf(0, 0, 0, D);
  if (kind.startsWith('sign-')) return place(signOf(kind.slice(5), D, R, kind === 'sign-diamond' ? 1 : 0), [0, 0, 0], [dx, dy]);
  if (kind === 'mooring') {
    // a quay's mooring bollard: a cast foot, its waist, its head swelling over it (a toon one's head too big, knocked
    // off its line)
    const r = 0.14 * Math.sqrt(D.body), h = 0.5 * D.height, hd = 0.22 * (D.toon ? D.head * 0.7 : 1);
    return [...lathe(0, 0, 0, [[r * 1.6, 0], [r * 1.6, 0.06], [r, 0.1], [r * 0.92 * D.bulge, h * 0.5], [r, h]], 12, 'bollard', () => [0, 0], [false, false]),
      ...tilted(0, 0, h, [[r, 0], [hd, 0.08], [hd, 0.16], [hd * 0.55, 0.22], [0, 0.23]], 12, 'bollard', D.tilt, dx, dy)];
  }
  if (kind === 'parasol') {
    // a beach parasol: its pole, its canopy's eight gores in two colours by turns, under and over (a toon one's too
    // big, tipped)
    const H = 2.2 * (D.toon ? 0.8 + 0.3 * D.height : 1), rr = 1.1 * (D.toon ? D.head * 0.6 : 1), up = 0.42, t = D.toon ? D.tilt : 0, out = [...postOf(0, 0, 0, H + up, 0.025, 'pole', D)];
    const rim = (i) => { const a = (Math.PI * 2 * i) / 8; return [rr * Math.cos(a), rr * Math.sin(a), H - rr * Math.sin(t) * Math.cos(a)]; }, ap = [0, 0, H + up];
    for (let i = 0; i < 8; i++) { const a = rim(i), b = rim(i + 1), role = i % 2 ? 'canopy-a' : 'canopy-b'; out.push({ corners: [a, b, ap], out: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, rr], role }, { corners: [b, a, [0, 0, H + up - 0.05]], out: [0, 0, -1], role }); }
    return out;
  }
  if (RECEPTACLES[kind]) return facingOf(receptacleOf(kind, D, R), [dx, dy]);
  throw new Error(`geocity kit: no loud piece '${kind}'`);
}

export function kitTemplates(L0, { gauge = 1.495, poleReach = 4, exaggerate = null, toon = false } = {}) {
  const four = (f) => Object.fromEntries(Object.entries(FACE).map(([k, v]) => [k, f(v)]));
  // (an exaggerated kit: its own light object carries the chunk to realize; a piece that reaches leans out over it)
  const X = exaggerate?.kit ?? null, L = X && X.chunk > 1 ? { ...L0 } : L0, tA = X ? tan((X.lean * Math.PI) / 180) : 0;
  if (L !== L0) CHUNKS.set(L, X.chunk);
  const leans = (fs, v) => (tA ? leanFaces(fs, v, tA, (n) => litFactor(n, L0)) : fs);
  // (a loud street's lines: `paint` times as wide, its yellow pushed, its bars skewed by `skew`)
  const SP = exaggerate?.streets ?? null, PW = SP ? SP.paint : 1, YL = SP ? popHex('#e3b13a', SP.pop) : '#e3b13a', SK = SP ? SP.skew * 1.6 * 0.6 : 0;
  // (the geotown's piece by kind, facing and shape: { body (a loud stamp's ink paints it), fixed }, made once; a plain
  // metro's as made (the realistic register), an exaggerated one's chunked, a toon register's shapes each its own dice)
  const loudMade = new Map(), paintOf = (role) => (SP && !KEEP.has(role) ? popHex(SIGN_PAINT[role], SP.pop) : SIGN_PAINT[role]) ?? '#6b7176';
  const piece = (kind, facing, v = 0) => {
    const key = `${kind}:${facing}:${v}`;
    if (loudMade.has(key)) return loudMade.get(key);
    const R = mulberry32(strHash(`${kind}|${v}|shape`)), D = toon ? proportions(R, true) : { ...proportions(R, false), body: X ? X.chunk : 1 };
    const fs = HOUSE_KINDS.has(kind) ? housePiece(kind, FACE[facing] ?? [1, 0], v, exaggerate?.homes?.skew ?? 0) : loudPiece(kind, FACE[facing] ?? [1, 0], D, mulberry32(strHash(`${kind}|${v}|parts`)));
    const reaches = kind === 'lamp' || kind === 'signal', v2 = FACE[facing] ?? [1, 0], lean = (q) => (reaches ? leans(q, v2) : q);
    const whole = !!RECEPTACLES[kind], hexOf = (f) => f.hex ?? paintOf(f.role);
    const T = { body: lean(litKit(fs.filter((f) => whole || BODY.has(f.role)), hexOf, L0)), fixed: lean(litKit(fs.filter((f) => !whole && !BODY.has(f.role)), hexOf, L0)) };
    loudMade.set(key, T);
    return T;
  };
  return {
    piece,
    lamp: four((v) => leans(lamp(v, L), v)),
    signal: four((v) => leans(signal(v, L), v)),
    sign: sign(L),
    pole: four((v) => pole(v, poleReach, L)),
    stop: four((v) => stop(v, L)),
    dash: flat(3, 0.12 * PW, 0, '#e8e4d8', L),
    line: flat(10, 0.12 * PW, 0, '#e8e4d8', L),
    yellow: [...flat(10, 0.1 * PW, -0.12 * PW, YL, L), ...flat(10, 0.1 * PW, 0.12 * PW, YL, L)],
    rail: [...flat(10, 0.1, -gauge / 2, '#b4b7bc', L), ...flat(10, 0.1, gauge / 2, '#b4b7bc', L)],
    wire: [quad([[0, -0.015, 0], [1, -0.015, 0], [1, 0.015, 0], [0, 0.015, 0]], [0, 0, 1], '#202224', L)],
    // (a loud street's crosswalk bar a parallelogram, its far side slid along it)
    bar: SP ? [quad([[0, -0.3, 0], [3, -0.3, 0], [3 + SK, 0.3, 0], [SK, 0.3, 0]], [0, 0, 1], '#f2eee4', L)] : flat(3, 0.6, 0, '#e3ded0', L),
    // a street tree's pit in the walk: its grate's dark square, centred
    pit: [quad([[-0.7, -0.7, 0], [0.7, -0.7, 0], [0.7, 0.7, 0], [-0.7, 0.7, 0]], [0, 0, 1], '#3b3a38', L)],
    bench: four((v) => bench(v, L)),
    bin: bin(L), hydrant: hydrant(L), papers: four((v) => papers(v, L)), ring: ring(L), bollard: bollard(L), railing: railing(L),
    hydro: four((v) => hydro(v, L)),
    // a site's and a lot's: scaffolding against a wall (facing out from it), fencing, hoarding, barriers, cones, a
    // parked car (along x for 'e'/'w', y for 'n'/'s'), a stall's line
    // (a site's and a lot's pieces are the works', not the street's furniture: as they were)
    scaffold: four((v) => scaffold(v, L0)), fence: fence(L0), hoarding: hoarding(L0), barrier: barrier(L0), cone: cone(L0),
    // (an exaggerated street's parked cars toy cars: geotown/doodads.js, their bodies pale for an instance's tint)
    car: four((v) => (exaggerate ? toyCar(v, L0) : car(v, L0))), stall: flat(5, 0.12 * PW, 0, '#e8e4d8', L),
  };
}
