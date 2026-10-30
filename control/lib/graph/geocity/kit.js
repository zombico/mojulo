/**
 * THE GEOCITY'S STREET KIT — the metro city's own doodads at true size, in metres, as TEMPLATES a scene stamps where
 * they stand (instanced repeats, drawn near the camera only). Each piece is the legacy metro's boxes (fractal-city.js
 * kerbLamp, intersectionDoodads: a lamp standard and its arm and head, a signal pole and its housing and lenses, a
 * street-name sign, a tram pole) made round by its round kit (city/round-kit.js roundStreetKit → roundKitFaces: a
 * tapered standard on its collar, a lathed head, lenses, galvanized posts), baked under the scene's light once a
 * facing (the light is baked, so a piece is never yawed: each way it faces is its own template). The paint and the
 * rails are flat pieces laid along a street.
 *
 *   kitTemplates(L) → { lamp: { e, w, n, s }, signal: { e, w, n, s }, sign, pole: { e, w, n, s }, stop: { e, w, n, s },
 *                       dash, line, yellow, rail, wire, bar, shelter }   faces in metres about the piece's foot
 *     a facing is the way its arm reaches (a lamp's over the road, a signal's mast over the lanes it faces, a pole's
 *     bracket over the tracks); `dash` a lane line's 3 m dash, `line` a solid white line's 10 m, `yellow` a centre
 *     line's 10 m pair, `rail` a 10 m pair of rails at the track's gauge, `wire` a unit span (stretched by a per-axis
 *     scale), `bar` a crosswalk's bar, all along +x, flat (their light the same any way they lie)
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
  };
}
