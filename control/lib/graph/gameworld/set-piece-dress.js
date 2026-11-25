/**
 * set-piece-dress — A SET PIECE IN ITS PLACE: the greybox a kind lays (set-piece-kinds.js) dressed as the place its level
 * stands in, read from the level's geocube (the world's `style.geocube`, or the level's own), so a set piece wears the
 * level's look as every other level does. Nothing it plays on moves: the blocks' colliders, breakables and slopes are
 * the kind's as laid; only what is seen is drawn anew.
 *
 *   placeOf(style)          → the place a level's style says, or null (no geocube: the greybox as it was):
 *                             { cube, look, style, colour } (the cube read; its light's look, which a World page bakes
 *                             as its sun, sky and haze, era/look.js; its settlements' architecture style,
 *                             era/arch-style.js; its colours)
 *   dressFaces(block, place, seed) → the faces a block is seen as, by its `role`:
 *     building   houses in the place's architecture (era/out-anchor-structure.js speak: walls, lights, doors, lintels,
 *                bands, a socle) in a row along the block, each scaled to fill its share of it, the roof the block's top
 *     rock       the block's sides laid in seeded beds of the place's rock, its top weathered lighter
 *     stone      the block in the place's stone, its faces each a little apart in tone
 *   surroundsOf(site, place, seed, { backdrop, bounds }) → the faces round a site, never on it: its ground in the
 *                place's sand, and beyond the play a `town` (a ring of houses facing in) or `desert` (rock crags)
 *   DRESS        the measures (a house's frontage, the town's ring, the crags' reach)
 *
 * Pure: the same blocks, place and seed give the same faces.
 */
import { readGeocube } from '../era/geocube.js';
import { speak } from '../era/out-anchor-structure.js';
import { structureStyle } from '../era/out-structures.js';
import { townLanguage } from '../era/out-town.js';
import { readStyle, MATERIAL_WORDS } from '../era/arch-style.js';
import { mulberry32 } from '../city/plan/dice.js';

export const DRESS = Object.freeze({ frontage: 10, storey: 3, ring: 16, ringStep: 13, crags: 10, cragNear: 70, cragFar: 140, ground: 10, groundReach: 90 });

const r3 = (v) => Math.round(v * 1000) / 1000;
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const tone = (hex, k) => rgbHex(hexRgb(hex).map((v) => v * k));
const mix = (a, b, t) => rgbHex(hexRgb(a).map((v, i) => v + (hexRgb(b)[i] - v) * t));
const seedOf = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const quad = (a, b, c, d, fill, group) => ({ corners: [a, b, c, d], fill, group, doubleSided: true });

/** The place a level's style says (see the header), or null where it names no geocube. */
export function placeOf(style) {
  const spec = style && style.geocube;
  if (spec == null) return null;
  const cube = readGeocube(spec);
  const towns = Object.values(cube.settlements ?? {});
  const arch = towns.map((t) => t && t.style).find((s) => s != null) ?? null;
  const c = cube.colour ?? {};
  return {
    cube, look: cube.light?.reference ?? null, style: arch,
    colour: { sand: c.sand ?? '#d2b98c', stone: c.stone ?? '#cdbb9a', trim: c.trim ?? '#e8dcc2', rock: c.floor ?? c.stone ?? '#a88a66', accent: c.accent ?? '#2d6e70' },
  };
}

// THE HOUSES: a place's architecture spoken once per place, its surfaces' colours from the style's own words
const spoken = new Map();
function languageOf(place) {
  const key = typeof place.style === 'string' ? place.style : JSON.stringify(place.style);
  if (!spoken.has(key)) {
    const S = readStyle(place.style ?? 'moorish-medina'), sStyle = structureStyle('isekai-meadow', 7);
    const word = (w) => (w && MATERIAL_WORDS[w] ? MATERIAL_WORDS[w].colour : null);
    const colours = {
      'str:plaster': S.palette.plaster ?? word(S.materials.plaster) ?? place.colour.trim,
      'str:paint': S.palette.paint ?? place.colour.accent,
      'str:stone': S.palette.stone ?? word(S.materials.stone) ?? place.colour.stone,
      'str:timber': S.palette.timber ?? word(S.materials.timber) ?? '#5a3e2b',
      'str:opening': '#17120e',
    };
    spoken.set(key, { L: townLanguage(sStyle, S.language.id ?? S.language.doc), sStyle, colours });
  }
  return spoken.get(key);
}
// a surface's tone as the language spoke it, about its group's own (a lintel's stone a little darker than a pier's)
const REF = { 'str:plaster': 0.84, 'str:paint': 0.45, 'str:stone': 0.75, 'str:timber': 0.32 };
function houseFill(T, f, warm) {
  const base = T.colours[f.group] ?? T.colours['str:plaster'];
  if (f.group === 'str:opening') return base;
  const k = Math.max(0.55, Math.min(1.2, (f.value ?? REF[f.group] ?? 0.8) / (REF[f.group] ?? 0.8)));
  return tone(f.group === 'str:plaster' ? mix(base, '#c99a6a', warm) : base, k);
}

/** One house spoken on a footprint: its faces placed in the box [x0, x1] × [y0, y1] × [z0, z1], its roof at z1. `far`
 *  drops its finest parts (the lattice, the joints): a house beyond the play is seen whole, never close. */
function houseIn(place, box, seed, { far = false, front = -1 } = {}) {
  const T = languageOf(place), [x0, x1] = box.x, [y0, y1] = box.y, [z0, z1] = box.z;
  const alongX = x1 - x0 >= y1 - y0, W = alongX ? x1 - x0 : y1 - y0, Dp = alongX ? y1 - y0 : x1 - x0, H = z1 - z0;
  const n = Math.max(1, Math.min(4, Math.round(H / DRESS.storey)));
  const D = speak(T.L, 'dwelling', { w: Math.max(5.5, W), d: Math.max(10, Dp) }, T.sStyle, seed, { ring: far ? 'far' : 'near', band: [n, n], over: { front: 0, side: 0, rear: 0 } });
  const roof = D.faces.filter((f) => f.part === 'roof').flatMap((f) => f.corners.map((c) => c[2])), roofZ = roof.length ? Math.max(...roof) : n * D.dims.storeyH;
  const W0 = D.dims.W0, D0 = D.dims.D0, warm = mulberry32(seed)() * 0.12, out = [];
  // (a front to the high side is a mirror, and a house laid along y another: an odd count turns each face's winding,
  // so its corners go round the other way and its normal still faces out, as a look's bake reads it)
  const mirrored = (front > 0) !== !alongX;
  for (const f of D.faces) {
    if (f.corners.some((c) => c[2] > roofZ + 1e-6)) continue;                    // (nothing over the roof the play stands on)
    if (far && (f.part === 'surround' || f.part === 'joint')) continue;
    const corners = f.corners.map(([u, v, w]) => {
      // (the front to the side `front` says: −1 the low side of the block's short axis, +1 the high)
      const a = (u / W0) * W, b = front < 0 ? (v / D0) * Dp : Dp - (v / D0) * Dp, z = z0 + (w / roofZ) * H;
      return alongX ? [r3(x0 + a), r3(y0 + b), r3(z)] : [r3(x0 + b), r3(y0 + a), r3(z)];
    });
    if (mirrored) corners.reverse();
    out.push({ corners, fill: houseFill(T, f, warm), group: 'dress:house', doubleSided: true });
  }
  return out;
}

// a box's five or six faces in one fill each, a little apart in tone by side
function boxFaces(B, fill, group, R) {
  const [x0, x1] = B.x, [y0, y1] = B.y, [z0, z1] = B.z, j = () => 0.94 + R() * 0.1;
  return [
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], tone(fill, 1.06 * j()), group),
    quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], tone(fill, 0.9 * j()), group), quad([x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], tone(fill, 0.86 * j()), group),
    quad([x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], tone(fill, 0.8 * j()), group), quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], tone(fill, 0.95 * j()), group),
    ...(z0 > 0 ? [quad([x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0], tone(fill, 0.7), group)] : []),
  ];
}
// rock in beds: each side cut into seeded courses of the place's rock, each its own tone; the top weathered lighter
function rockFaces(B, place, R) {
  const [x0, x1] = B.x, [y0, y1] = B.y, [z0, z1] = B.z, rock = place.colour.rock, out = [];
  const beds = [];
  for (let z = z0; z < z1 - 1e-6;) { const h = Math.min(z1 - z, 0.6 + R() * 1.1); beds.push([z, z + h, 0.82 + R() * 0.26]); z += h; }
  const sides = [[[x0, y0], [x1, y0], 0.92], [[x1, y1], [x0, y1], 0.84], [[x0, y1], [x0, y0], 0.78], [[x1, y0], [x1, y1], 0.96]];
  for (const [a, b, k] of sides) for (const [za, zb, t] of beds) out.push(quad([a[0], a[1], za], [b[0], b[1], za], [b[0], b[1], zb], [a[0], a[1], zb], tone(rock, k * t), 'dress:rock'));
  out.push(quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], tone(mix(rock, place.colour.sand, 0.35), 1.04), 'dress:rock'));
  if (z0 > 0) out.push(quad([x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0], tone(rock, 0.6), 'dress:rock'));
  return out;
}

/** The faces a block is seen as (see the header); null where its role is none (the greybox's own). */
export function dressFaces(B, place, seed = 1) {
  const R = mulberry32(seedOf(`${seed}:${B.id}`));
  if (B.role === 'rock') return rockFaces(B, place, R);
  if (B.role === 'stone') return boxFaces(B, place.colour.stone, 'dress:stone', R);
  if (B.role !== 'building') return null;
  // a row of houses along the block's length, each its frontage's share of it
  const alongX = B.x[1] - B.x[0] >= B.y[1] - B.y[0], [a0, a1] = alongX ? B.x : B.y, L = a1 - a0, n = Math.max(1, Math.round(L / DRESS.frontage)), out = [];
  for (let k = 0; k < n; k++) {
    const s0 = a0 + (L * k) / n, s1 = a0 + (L * (k + 1)) / n;
    const box = alongX ? { x: [s0, s1], y: B.y, z: B.z } : { x: B.x, y: [s0, s1], z: B.z };
    out.push(...houseIn(place, box, seedOf(`${seed}:${B.id}:${k}`), { front: k % 2 ? 1 : -1 }));
  }
  return out;
}

/** The faces round a site (see the header): its ground, and its town or its crags beyond the play. */
export function surroundsOf(place, seed, { backdrop = 'desert', bounds }) {
  const R = mulberry32(seedOf(`${seed}:surrounds`)), out = [], [bx0, by0, bx1, by1] = bounds;
  const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2, span = Math.max(bx1 - bx0, by1 - by0);
  // the ground: sand a little under z 0 (a road or a street drawn there stays on it), each tile a little apart in tone, a
  // darker drift now and then; its tiles grow with the play's reach (a convoy's drive is a kilometre)
  const g = Math.min(40, Math.max(DRESS.ground, Math.ceil(span / 40))), gz = -0.03, reach = DRESS.groundReach - 30;
  for (let i = bx0 - reach; i < bx1 + reach; i += g) for (let j = by0 - reach; j < by1 + reach; j += g) {
    const t = 0.92 + R() * 0.1, drift = R() < 0.12 ? 0.86 : 1;
    out.push(quad([i, j, gz], [i + g, j, gz], [i + g, j + g, gz], [i, j + g, gz], tone(place.colour.sand, t * drift), 'dress:ground'));
  }
  if (backdrop === 'town') {
    // a ring of houses round the site, facing in, a gap now and then: the town the run goes over
    const m = DRESS.ring, X0 = bx0 - m, X1 = bx1 + m, Y0 = by0 - m, Y1 = by1 + m, step = DRESS.ringStep;
    const sides = [[[X0, Y0], [X1, Y0], 'y0'], [[X1, Y0], [X1, Y1], 'x1'], [[X1, Y1], [X0, Y1], 'y1'], [[X0, Y1], [X0, Y0], 'x0']];
    let k = 0;
    for (const [a, b, side] of sides) {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.floor(L / step));
      for (let i = 0; i < n; i++, k++) {
        if (R() < 0.18) continue;
        const t = (i + 0.5) / n, px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t, w = 9 + R() * 3, d = 10 + R() * 2, h = DRESS.storey * (1 + Math.floor(R() * 3));
        // (each a lot set back out of the ring, its front to the site)
        const box = side === 'y0' ? { x: [px - w / 2, px + w / 2], y: [py - d, py], z: [0, h] } : side === 'y1' ? { x: [px - w / 2, px + w / 2], y: [py, py + d], z: [0, h] }
          : side === 'x0' ? { x: [px - d, px], y: [py - w / 2, py + w / 2], z: [0, h] } : { x: [px, px + d], y: [py - w / 2, py + w / 2], z: [0, h] };
        const front = side === 'y0' || side === 'x0' ? 1 : -1;
        out.push(...houseIn(place, box, seedOf(`${seed}:ring:${k}`), { far: true, front }));
      }
    }
  } else {
    // crags out in the desert: bedded rock masses beyond the play, never on it; round a site, or along a long drive's
    // both sides
    const long = (bx1 - bx0) > 3 * (by1 - by0) + 60, n = long ? Math.max(DRESS.crags, Math.ceil((bx1 - bx0) / 80)) : DRESS.crags;
    for (let k = 0; k < n; k++) {
      let x, y;
      if (long) { x = bx0 + ((k + R()) / n) * (bx1 - bx0); y = (k % 2 ? 1 : -1) * (DRESS.cragNear + R() * (DRESS.cragFar - DRESS.cragNear)); }
      else { const a = (k / n) * Math.PI * 2 + R() * 0.4, r = DRESS.cragNear + R() * (DRESS.cragFar - DRESS.cragNear); x = cx + Math.cos(a) * r; y = cy + Math.sin(a) * r; }
      const w = 10 + R() * 22, d = 8 + R() * 16, h = 8 + R() * 20;
      out.push(...rockFaces({ x: [x - w / 2, x + w / 2], y: [y - d / 2, y + d / 2], z: [0, h] }, place, R));
    }
  }
  return out;
}
