/**
 * figure-animal-foot — ONE parametric proto-foot, a preset per family.
 *
 * The limbs end at the wrist/ankle node (a rounded stub); the foot continues from
 * there down to the ground and forward into toes. Like the skull, it's one shared
 * primitive switched by `kind`, with a per-family preset — not eleven bespoke feet:
 *
 *   paw    — a soft sole pad + short toes (rodent / canine / feline / bear)
 *   hoof   — a tapered solid to a flat sole, single or cloven (equine / gazelle)
 *   pad    — a broad columnar foot, round sole (graviportal: stumpy / sauropod)
 *   talon  — a slim metatarsus + three forward toes + a back toe (theropod / bird)
 *
 * Built in STAND space at the limb's distal node, sole on the ground (z = sole),
 * toes forward (+y, the facing direction). Returns render parts `{polylines, stroke}`
 * — the same shape the flesh/skull emit, so the renderer meshes them unchanged.
 */
import { normalize3, sub3, cross3 } from './figure-vajra.js';

const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const vlen = (a) => Math.hypot(a.x, a.y, a.z);

export const FOOT_DEFAULT = {
  kind: 'paw',
  sole: 0.0,        // ground height
  topR: 0.02,       // radius where the foot meets the leg
  width: 0.024,     // sole half-width (side)
  fwd: 0.05,        // forward reach (toes)
  padH: 0.014,      // sole/pad thickness
  toeR: 0.009, toeSpread: 0.013,         // paw toes
  hoofR: 0.02, cloven: false,            // hoof
  padR: 0.045,                           // columnar pad radius
  ankleH: 0.04, toe: 0.013, spread: 0.026, backToe: true,   // talon
  N: 9, M: 16, stroke: '#c8836a',
};

function tube(a, b, ra, rb, c) {
  const ax = sub3(b, a), L = vlen(ax);
  if (L < 1e-6) return null;
  const axis = mul(ax, 1 / L);
  let up = { x: 0, y: 0, z: 1 }, side = cross3(up, axis);
  if (vlen(side) < 1e-6) side = cross3({ x: 1, y: 0, z: 0 }, axis);
  side = normalize3(side); up = normalize3(cross3(axis, side));
  const rings = [];
  for (let i = 0; i < c.N; i++) {
    const t = i / (c.N - 1), ctr = add(a, mul(ax, t)), r = ra + (rb - ra) * t, poly = [];
    for (let j = 0; j <= c.M; j++) { const an = (j / c.M) * Math.PI * 2; poly.push(add(ctr, add(mul(side, r * Math.cos(an)), mul(up, r * Math.sin(an))))); }
    rings.push(poly);
  }
  return { polylines: rings, stroke: c.stroke };
}

function ellipsoid(ctr, rx, ry, rz, c) {
  const N = Math.max(6, c.N), rings = [];
  for (let i = 0; i < N; i++) {
    const v = Math.PI * (i / (N - 1) - 0.5), cz = ctr.z + rz * Math.sin(v), rr = Math.cos(v), poly = [];
    for (let j = 0; j <= c.M; j++) { const a = (j / c.M) * Math.PI * 2; poly.push({ x: ctr.x + rx * rr * Math.cos(a), y: ctr.y + ry * rr * Math.sin(a), z: cz }); }
    rings.push(poly);
  }
  return { polylines: rings, stroke: c.stroke };
}

/**
 * Build a proto-foot at the limb's distal node `end` (the wrist/ankle), reaching to
 * the ground and forward. Returns STAND-space render parts.
 */
export function protoFoot(end, cfg = {}) {
  const c = { ...FOOT_DEFAULT, ...cfg };
  const x = end.x, y = end.y, g = c.sole, top = { x, y, z: end.z };
  const parts = [], push = (p) => p && parts.push(p);

  if (c.kind === 'hoof') {
    const offs = c.cloven ? [-1, 1] : [0], hw = c.cloven ? c.width * 0.55 : 0, sc = c.cloven ? 0.62 : 1;
    for (const o of offs) {
      const a = { x: x + o * hw * 1.1, y, z: end.z }, b = { x: x + o * hw, y: y + c.fwd, z: g };
      push(tube(a, b, c.topR * sc, c.hoofR * sc, c));
      push(ellipsoid({ x: b.x, y: b.y, z: g + 0.005 }, c.hoofR * sc, c.hoofR * 1.25 * sc, 0.006, c));   // flat sole
    }
  } else if (c.kind === 'pad') {
    push(tube(top, { x, y: y + c.fwd * 0.25, z: g + c.padR * 0.5 }, c.topR, c.padR, c));
    push(ellipsoid({ x, y: y + c.fwd * 0.25, z: g + c.padR * 0.4 }, c.padR, c.padR * 1.15, c.padR * 0.5, c));   // broad round sole
  } else if (c.kind === 'talon') {
    const hub = { x, y: y + c.fwd * 0.12, z: g + c.ankleH };
    push(tube(top, hub, c.topR, c.topR * 0.75, c));                                   // metatarsus
    for (const t of [-1, 0, 1]) push(tube(hub, { x: x + t * c.spread, y: y + c.fwd, z: g }, c.toe, c.toe * 0.35, c));   // 3 forward toes
    if (c.backToe) push(tube(hub, { x, y: y - c.fwd * 0.4, z: g }, c.toe * 0.8, c.toe * 0.3, c));        // hallux
  } else {   // paw
    push(tube(top, { x, y: y + c.fwd * 0.2, z: g + c.padH }, c.topR, c.width * 0.95, c));                // ankle → pad
    push(ellipsoid({ x, y: y + c.fwd * 0.3, z: g + c.padH }, c.width, c.fwd * 0.7, c.padH, c));          // sole pad
    for (const t of [-1, 0, 1]) push(ellipsoid({ x: x + t * c.toeSpread, y: y + c.fwd * 0.85, z: g + c.padH * 0.85 }, c.toeR, c.toeR * 1.5, c.padH * 0.85, c));   // toes
  }
  return parts;
}

// ─── Per-family proto-feet ──────────────────────────────────────────────
export const FOOT_PRESETS = {
  rodent: { kind: 'paw', topR: 0.012, width: 0.016, fwd: 0.038, padH: 0.009, toeR: 0.006, toeSpread: 0.01 },
  canine: { kind: 'paw', topR: 0.016, width: 0.02, fwd: 0.05, padH: 0.012, toeR: 0.008, toeSpread: 0.012 },
  feline: { kind: 'paw', topR: 0.015, width: 0.022, fwd: 0.046, padH: 0.013, toeR: 0.009, toeSpread: 0.013 },
  stumpy: { kind: 'pad', topR: 0.05, padR: 0.058, fwd: 0.03 },
  equine: { kind: 'hoof', topR: 0.026, hoofR: 0.021, width: 0.03, fwd: 0.02 },
  gazelle: { kind: 'hoof', cloven: true, topR: 0.016, hoofR: 0.013, width: 0.024, fwd: 0.026 },
  sauropod: { kind: 'pad', topR: 0.045, padR: 0.052, fwd: 0.03 },
  theropod: { kind: 'talon', topR: 0.03, ankleH: 0.05, toe: 0.016, spread: 0.032, fwd: 0.1 },
  raptor: { kind: 'talon', topR: 0.018, ankleH: 0.042, toe: 0.011, spread: 0.024, fwd: 0.075 },
  avian: { kind: 'talon', topR: 0.014, ankleH: 0.034, toe: 0.008, spread: 0.018, fwd: 0.052 },
  ursine: { kind: 'paw', topR: 0.028, width: 0.032, fwd: 0.058, padH: 0.016, toeR: 0.011, toeSpread: 0.017 },
  raccoon: { kind: 'paw', topR: 0.013, width: 0.018, fwd: 0.042, padH: 0.011, toeR: 0.007, toeSpread: 0.012 },
};

// Which distal limb nodes touch the ground (get feet), by fore-limb mode.
// BIPEDS (foreMode 'tuck'/'wing') stand on the two hind feet; everything ELSE is a quadruped
// on all four. Default to quadruped when foreMode is unset — the resolved cfg from a string or
// merged archetype may not carry the DEFAULT 'ground', and a MISSING value must never be mistaken
// for a biped (that bug silently fed `balanceFeet` a 2-foot base → it slid every quadruped's hind
// legs FORWARD under the COM, jutting them forward of the rump).
export function groundedFeet(foreMode) {
  return (foreMode === 'tuck' || foreMode === 'wing') ? ['ankleL', 'ankleR'] : ['wristL', 'wristR', 'ankleL', 'ankleR'];
}
