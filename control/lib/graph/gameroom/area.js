/**
 * THE AREA — what a room stands in: its floor, its walls and what is seen beyond them (a dining room past a kitchen's
 * wall, fields and a barn past a farm's fence, a frame going up and a crane past a site's hoarding, the neighbours' houses
 * past a garden's hedge, a colonnade round a hall), the ground they stand on and the sky. The dress (dress.js) draws the
 * places; the area draws everything that is not a place, and moves nothing: the room's colliders are its walls at the
 * height drawn, and the surround is static, outside, never walked.
 *
 * An area is designable: a floor PATTERN in its colours, WALLS in a style, a height and colours, cut away (drawn to a
 * section, its cap dark, as an architect's cut) on the sides the camera looks from, the SURROUND as a list of things
 * laid outside, the ground and the sky. Each trade has its own; a world names one or writes over one.
 *
 *   AREAS      { <trade>: { about, floor, walls, surround, ground, sky, palette } } (dress.js's trades)
 *   FLOORS     the floor patterns: plane (the conceptual plane, ruled every two metres), tiles, boards, concrete, earth,
 *              lawn, flags
 *   WALLS      the wall styles, each its default height and colours: plain, tiled, fence, hoarding, stone, hedge, none
 *   SURROUNDS  the things laid outside: dining, street, fields, barn, trees, frame, crane, yard, houses, colonnade
 *   readArea(spec, trade) → an area, or null for `false` (the conceptual plane)
 *     spec: absent (the trade's own) | an area's name | false | { like?, floor?: pattern | { pattern?, colors? },
 *           walls?: style | { style?, height?, colors? }, surround?: [names] | false, ground?, sky?, cut? }
 *           cut: true (every side) | false (none) | ['n' | 's' | 'e' | 'w', …]; absent, the room's camera decides
 *   buildArea(area, { half, cut: [sides], seed }) → { faces, heights: { n, s, e, w } | null, bg, laid: [surround names] }
 *   raiseWalls(colliders, half, heights) → the room's colliders, its four walls at the heights drawn
 *   planeFaces(half) → the conceptual plane (the floor when there is no area)
 *   houseFaces(out, { x, y, z?, h }, palette, { gable?, group? }) → a house's walls, windows, door and roof
 *
 * The frame is the room's (practice-room.js floorOf): the floor -half..half, its walls half..half+0.5, z up, the
 * camera's side south (-y) under the overhead camera. Pure: the dice are seeded (city/plan/dice.js streamOf).
 */
import { streamOf } from '../city/plan/dice.js';
import { face, box, prism, drawPiece } from './dress.js';

const T = 0.5;          // the wall's thickness (floorOf's collider)
const CUT = 1.2;        // a cut wall's section height
const HEX = /^#[0-9a-f]{6}$/i;
const r3 = (v) => Math.round(v * 1000) / 1000;
const flatQ = (x0, y0, x1, y1, z, fill, group) => face([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], fill, group);

// ── the floors ───────────────────────────────────────────────────────────────────────────────────────────────────────
export const FLOORS = Object.freeze({
  plane: { about: 'the conceptual plane, ruled every two metres', colors: ['#ece6db', '#d9d0c1'] },
  tiles: { about: 'square tiles, checkered', colors: ['#e9e4da', '#d3ccbf'] },
  boards: { about: 'planks, staggered', colors: ['#b98b5e', '#a97c52', '#c49a6c'] },
  concrete: { about: 'slabs poured in bays, their joints', colors: ['#bdb8b0', '#b4aea5', '#9e988f'] },
  earth: { about: 'trodden earth in patches', colors: ['#a88356', '#a17d51', '#ad885a'] },
  lawn: { about: 'a lawn in patches', colors: ['#8fb35e', '#89ad59', '#95b964'] },
  flags: { about: 'flagstones in courses, their joints', colors: ['#b8afa2', '#a99f91', '#c3bbaf', '#8f877c'] },
});

/** The conceptual plane: 4 m quads, a rule every two metres. */
export function planeFaces(half, colors = FLOORS.plane.colors) {
  const out = [], H = half;
  for (let i = -H; i < H; i += 4) for (let j = -H; j < H; j += 4) out.push(flatQ(i, j, Math.min(i + 4, H), Math.min(j + 4, H), 0, colors[0], 'room:plane'));
  for (let k = -H + 2; k < H; k += 2) {
    out.push(flatQ(k - 0.015, -H, k + 0.015, H, 0.003, colors[1], 'room:rule'), flatQ(-H, k - 0.015, H, k + 0.015, 0.003, colors[1], 'room:rule'));
  }
  return out;
}

function floorFaces(out, H, { pattern, colors }, dice, x0 = -H, x1 = H, y0 = -H, y1 = H, group = 'room:area:floor') {
  const C = colors, pick = () => C[Math.floor(dice() * Math.min(C.length, 3))];
  if (pattern === 'plane') { out.push(...planeFaces(H, C)); return; }
  if (pattern === 'tiles') {
    for (let i = x0; i < x1; i++) for (let j = y0; j < y1; j++) out.push(flatQ(i, j, Math.min(i + 1, x1), Math.min(j + 1, y1), 0, C[(Math.round(i - x0) + Math.round(j - y0)) % 2], group));
    return;
  }
  if (pattern === 'boards') {
    const W = 0.3, Lp = 2.4;
    for (let k = 0, y = y0; y < y1; k++, y += W) {
      const off = ((k * 3) % 8) * 0.3;
      for (let x = x0 - off; x < x1; x += Lp) out.push(flatQ(Math.max(x, x0), y, Math.min(x + Lp - 0.02, x1), Math.min(y + W - 0.02, y1), 0, pick(), group));
    }
    out.push(flatQ(x0, y0, x1, y1, -0.002, '#5e4632', group));
    return;
  }
  if (pattern === 'concrete') {
    for (let i = x0; i < x1; i += 3) for (let j = y0; j < y1; j += 3) out.push(flatQ(i, j, Math.min(i + 3, x1), Math.min(j + 3, y1), 0, C[Math.floor(dice() * 2)], group));
    for (let k = x0 + 3; k < x1; k += 3) out.push(flatQ(k - 0.02, y0, k + 0.02, y1, 0.003, C[2], group));
    for (let k = y0 + 3; k < y1; k += 3) out.push(flatQ(x0, k - 0.02, x1, k + 0.02, 0.003, C[2], group));
    return;
  }
  if (pattern === 'earth' || pattern === 'lawn') {
    for (let i = x0; i < x1; i += 2) for (let j = y0; j < y1; j += 2) out.push(flatQ(i, j, Math.min(i + 2, x1), Math.min(j + 2, y1), 0, pick(), group));
    return;
  }
  if (pattern === 'flags') {
    out.push(flatQ(x0, y0, x1, y1, 0, C[3] ?? C[0], group));
    for (let y = y0; y < y1; y += 0.9) {
      let x = x0;
      // (a stone that would leave a sliver at the course's end runs to it)
      while (x < x1) { const w = 0.7 + dice() * 0.8, e = x1 - (x + w) < 0.4 ? x1 : x + w; out.push(flatQ(x + 0.03, y + 0.03, e - 0.03, Math.min(y + 0.9, y1) - 0.03, 0.003, pick(), group)); x = e; }
    }
    return;
  }
  throw new Error(`game room: floor is ${Object.keys(FLOORS).join(', ')}`);
}

// ── the walls ────────────────────────────────────────────────────────────────────────────────────────────────────────
// A side's frame: u along its run, d outward from its inner face (negative into the room), z up.
const SIDES = ['s', 'n', 'w', 'e'];
const at = (H, side, u, d, z) => (side === 'n' ? [u, H + d, z] : side === 's' ? [u, -H - d, z] : side === 'e' ? [H + d, u, z] : [-H - d, u, z]);
function sbox(out, H, side, u0, u1, d0, d1, z0, z1, fill, group) {
  const a = at(H, side, u0, d0, z0), b = at(H, side, u1, d1, z1);
  box(out, [0, 1, 2].map((k) => Math.min(a[k], b[k])), [0, 1, 2].map((k) => Math.max(a[k], b[k])), fill, group);
}
const squad = (out, H, side, u0, u1, d, z0, z1, fill, group) => out.push(face([at(H, side, u0, d, z0), at(H, side, u1, d, z0), at(H, side, u1, d, z1), at(H, side, u0, d, z1)], fill, group));
// the centres of what repeats along a run (windows, posts, pilasters), `every` apart, kept `margin` off its ends
const along = (u0, u1, every, margin = 0) => { const n = Math.max(0, Math.floor((u1 - u0 - 2 * margin) / every)); const s = (u0 + u1) / 2 - (n * every) / 2; return Array.from({ length: n + 1 }, (_, k) => s + k * every); };

function windowOn(out, H, side, u, z0, z1, w, C, g) {
  sbox(out, H, side, u - w / 2 - 0.08, u + w / 2 + 0.08, -0.05, 0, z0 - 0.08, z1 + 0.08, C.trim, g);
  squad(out, H, side, u - w / 2, u + w / 2, -0.055, z0, z1, C.glass, g);
  squad(out, H, side, u - 0.03, u + 0.03, -0.06, z0, z1, C.trim, g);
}

export const WALLS = Object.freeze({
  plain: { about: 'a plain wall', height: 2.6, depth: T, colors: { wall: '#ddd5c8' },
    draw: (o, H, s, u0, u1, h, full, C, g) => sbox(o, H, s, u0, u1, 0, T, 0, h, C.wall, g) },
  tiled: { about: 'tiled above a painted dado, windows in the far walls', height: 3, depth: T, colors: { wall: '#f3f0ea', lower: '#6f9aab', trim: '#c9ced3', grout: '#dcd8d0', glass: '#bcd6e2' },
    draw: (o, H, s, u0, u1, h, full, C, g) => {
      sbox(o, H, s, u0, u1, 0, T, 0, h, C.wall, g);
      squad(o, H, s, u0, u1, -0.006, 0, Math.min(1.1, h), C.lower, g);
      if (h > 1.16) sbox(o, H, s, u0, u1, -0.03, 0, 1.1, 1.16, C.trim, g);
      for (let z = 1.46; z < h - 0.05; z += 0.3) squad(o, H, s, u0, u1, -0.008, z, z + 0.012, C.grout, g);
      if (full && h >= 2.6) for (const u of along(u0, u1, 4, 1.5)) windowOn(o, H, s, u, 1.4, 2.4, 1.4, C, g);
    } },
  fence: { about: 'a post-and-rail fence', height: 1.3, depth: T, colors: { post: '#8a6a48', rail: '#9c7b56' },
    draw: (o, H, s, u0, u1, h, full, C, g) => {
      for (const u of along(u0, u1, 2)) sbox(o, H, s, u - 0.06, u + 0.06, 0.19, 0.31, 0, h, C.post, g);
      for (const z of [0.5, 1.0]) if (z + 0.1 <= h) sbox(o, H, s, u0, u1, 0.22, 0.28, z, z + 0.1, C.rail, g);
    } },
  hoarding: { about: 'site hoarding: ply panels on posts, a hazard stripe', height: 2.4, depth: T, colors: { panel: '#c9a978', stripe: '#e8b04a', post: '#5f6368' },
    draw: (o, H, s, u0, u1, h, full, C, g) => {
      sbox(o, H, s, u0, u1, 0, 0.1, 0, h, C.panel, g);
      if (h > 0.5) squad(o, H, s, u0, u1, -0.004, 0.2, 0.5, C.stripe, g);
      for (const u of along(u0, u1, 2.4)) sbox(o, H, s, u - 0.05, u + 0.05, 0.1, 0.25, 0, h, C.post, g);
    } },
  stone: { about: 'stone between pilasters, a plinth and a cornice, high windows', height: 4.5, depth: T, colors: { wall: '#c8bca9', pilaster: '#b3a48f', plinth: '#8f8576', trim: '#d9cfbf', glass: '#6f7f8a' },
    draw: (o, H, s, u0, u1, h, full, C, g) => {
      sbox(o, H, s, u0, u1, 0, T, 0, h, C.wall, g);
      sbox(o, H, s, u0, u1, -0.06, 0, 0, Math.min(0.45, h), C.plinth, g);
      const piers = along(u0, u1, 4, 1);
      for (const u of piers) sbox(o, H, s, u - 0.3, u + 0.3, -0.22, 0, 0, h, C.pilaster, g);
      if (full) {
        sbox(o, H, s, u0, u1, -0.2, 0, h - 0.3, h, C.trim, g);
        if (h >= 4) for (let k = 0; k + 1 < piers.length; k++) windowOn(o, H, s, (piers[k] + piers[k + 1]) / 2, 2.4, 3.6, 1.1, C, g);
      }
    } },
  hedge: { about: 'a clipped hedge', height: 1.4, depth: 0.6, colors: { hedge: '#4f7f45', top: '#5f8f52' },
    draw: (o, H, s, u0, u1, h, full, C, g) => {
      sbox(o, H, s, u0, u1, -0.1, 0.6, 0, h, C.hedge, g);
      sbox(o, H, s, u0 + 0.05, u1 - 0.05, -0.05, 0.55, h, h + 0.08, C.top, g);
    } },
  none: { about: 'no walls: the floor alone in its area', height: 0, depth: 0, colors: {}, draw: () => {} },
});

/** A house: its walls, a window a bay a storey, a door to the south, a gable roof (its ridge along x) or a flat one. */
export function houseFaces(out, { x: [x0, x1], y: [y0, y1], z = 0, h }, P, { gable = true, group = 'room:area:surround' } = {}) {
  const g = group, top = z + h, wall = P.wall ?? '#e9e1d3', trim = P.trim ?? '#f6f2ea', glass = P.glass ?? '#9fb6c4';
  box(out, [x0, y0, z], [x1, y1, top], wall, g);
  const storeys = Math.max(1, Math.floor(h / 2.8));
  const sides = [['s', x0, x1, y0, -1], ['n', x0, x1, y1, 1], ['w', y0, y1, x0, -1], ['e', y0, y1, x1, 1]];
  for (const [side, a0, a1, c, sgn] of sides) {
    const q = c + sgn * 0.02, pt = (u, zz) => (side === 's' || side === 'n' ? [u, q, zz] : [q, u, zz]);
    const quad = (u0, u1, z0, z1, fill) => out.push(face([pt(u0, z0), pt(u1, z0), pt(u1, z1), pt(u0, z1)], fill, g));
    const bays = along(a0, a1, 2.4, 0.9);
    for (let s = 0; s < storeys; s++) for (const u of bays) {
      const zb = z + s * 2.8 + 0.9;
      if (side === 's' && s === 0 && u === bays[Math.floor(bays.length / 2)]) { quad(u - 0.5, u + 0.5, z, z + 2.1, P.door ?? '#6f4b2e'); continue; }
      if (zb + 1.1 > top - 0.2) continue;
      quad(u - 0.58, u + 0.58, zb - 0.08, zb + 1.18, trim); quad(u - 0.5, u + 0.5, zb, zb + 1.1, glass);
    }
  }
  if (gable) {
    const ym = (y0 + y1) / 2, rh = 0.4 * (y1 - y0), o = 0.35, roof = P.roof ?? '#7a5b4a';
    out.push(face([[x0 - o, y0 - o, top - 0.2], [x1 + o, y0 - o, top - 0.2], [x1 + o, ym, top + rh], [x0 - o, ym, top + rh]], roof, g));
    out.push(face([[x0 - o, y1 + o, top - 0.2], [x1 + o, y1 + o, top - 0.2], [x1 + o, ym, top + rh], [x0 - o, ym, top + rh]], roof, g));
    for (const x of [x0, x1]) out.push(face([[x, y0, top], [x, y1, top], [x, ym, top + rh - 0.15], [x, ym, top + rh - 0.15]], wall, g));
  } else {
    out.push(flatQ(x0, y0, x1, y1, top + 0.004, P.roof ?? '#8a817a', g));
    for (const [a, b] of [[[x0, y0], [x1, y0 + 0.12]], [[x0, y1 - 0.12], [x1, y1]], [[x0, y0], [x0 + 0.12, y1]], [[x1 - 0.12, y0], [x1, y1]]]) box(out, [a[0], a[1], top - 0.25], [b[0], b[1], top + 0.02], trim, g);
  }
}

// ── the surround ─────────────────────────────────────────────────────────────────────────────────────────────────────
function tree(out, x, y, s, P, g) {
  prism(out, [x, y], 0.15 * s, 0.15 * s, 0, 1.6 * s, 6, P.trunk ?? '#6f5638', g);
  prism(out, [x, y], 1.3 * s, 1.3 * s, 1.3 * s, 2.6 * s, 7, P.leaf ?? '#5f8f52', g);
  prism(out, [x, y], 0.95 * s, 0.95 * s, 2.6 * s, 3.5 * s, 7, P.leafDark ?? '#4f7f45', g);
  prism(out, [x, y], 0.5 * s, 0.5 * s, 3.5 * s, 4.1 * s, 7, P.leaf ?? '#5f8f52', g);
}
const piece = (out, kind, x, y, size, P, g) => drawPiece(out, { at: [x, y, 0], size }, kind, P, g);

// Each takes (out, { H, E: the walls' outer edge, dice, P: the area's palette, g }). Things stand north, east and west;
// south, the camera's side under the overhead camera, is left open.
export const SURROUNDS = Object.freeze({
  dining: { about: 'the dining room past the far wall: a boarded floor, its tables, its windows', lay: (o, { E, H, dice, P, g }) => {
    floorFaces(o, H, { pattern: 'boards', colors: FLOORS.boards.colors }, dice, -E, E, E, E + 10, g);
    for (const y of [E + 2.6, E + 6.6]) for (const x of along(-H + 1, H - 1, 5)) piece(o, 'mess-table', x, y, [2.4, 1.8, 0.76], { cabinet: P.wood ?? '#b98b5e', trim: P.dark ?? '#5e432c' }, g);
    box(o, [-E, E + 10, 0], [E, E + 10.4, 3], P.wall ?? '#efe9df', g);
    for (const x of along(-E, E, 3.5, 1.5)) o.push(face([[x - 0.8, E + 9.98, 0.9], [x + 0.8, E + 9.98, 0.9], [x + 0.8, E + 9.98, 2.5], [x - 0.8, E + 9.98, 2.5]], P.glass ?? '#bcd6e2', g));
  } },
  street: { about: 'a street to the east: pavements, the road and its dashes, lamps', lay: (o, { E, H, P, g }) => {
    const y0 = -H - 8, y1 = H + 24;
    box(o, [E, y0, 0], [E + 3, y1, 0.12], P.kerb ?? '#b9b4ab', g);
    o.push(flatQ(E + 3, y0, E + 10, y1, 0.004, P.asphalt ?? '#5c5f63', g));
    for (let y = y0 + 1; y < y1 - 2; y += 4) o.push(flatQ(E + 6.4, y, E + 6.6, y + 2, 0.008, P.paint ?? '#f2ede4', g));
    box(o, [E + 10, y0, 0], [E + 13, y1, 0.12], P.kerb ?? '#b9b4ab', g);
    for (let y = -H + 2; y < y1; y += 8) { prism(o, [E + 2.4, y], 0.07, 0.07, 0.12, 5, 6, P.metal ?? '#5f6368', g); box(o, [E + 2.4, y - 0.15, 4.85], [E + 3.6, y + 0.15, 5.05], P.metal ?? '#5f6368', g); }
  } },
  fields: { about: 'fields north and west, their crop in rows', lay: (o, { E, H, P, g }) => {
    const soil = P.soil ?? '#8a6a48', crop = [P.crop ?? '#c9b458', P.cropAlt ?? '#7fa34a'];
    o.push(flatQ(-H, E + 1.5, H, E + 14.5, 0.004, soil, g));
    for (let k = 0, y = E + 2; y < E + 14; k++, y += 1) box(o, [-H + 0.5, y, 0], [H - 0.5, y + 0.55, 0.35], crop[Math.floor(k / 4) % 2], g);
    o.push(flatQ(-E - 13.5, -H, -E - 1.5, H, 0.004, soil, g));
    for (let k = 0, x = -E - 13; x < -E - 2; k++, x += 1) box(o, [x, -H + 0.5, 0], [x + 0.55, H - 0.5, 0.35], crop[(Math.floor(k / 4) + 1) % 2], g);
  } },
  barn: { about: 'a barn to the north-east, gabled', lay: (o, { E, P, g }) => houseFaces(o, { x: [E + 2, E + 11], y: [E + 3, E + 10], h: 4.2 }, { wall: P.barn ?? '#a8432f', roof: P.roof ?? '#4a4a4a', trim: '#f2ede4', glass: '#5f4a3c', door: '#6f4b2e' }, { group: g }) },
  trees: { about: 'trees beyond, north, east and west', lay: (o, { E, H, dice, P, g }) => {
    const bands = [[-H - 12, H + 12, E + 17, E + 25], [-E - 24, -E - 16, -H, E + 16], [E + 16, E + 24, -H, E + 16]];
    for (const [x0, x1, y0, y1] of bands) {
      const n = Math.max(3, Math.round(((x1 - x0) * (y1 - y0)) / 60));
      for (let k = 0; k < n; k++) tree(o, r3(x0 + dice() * (x1 - x0)), r3(y0 + dice() * (y1 - y0)), r3(0.9 + dice() * 0.6), P, g);
    }
  } },
  frame: { about: 'a frame going up to the north-west: steel columns, beams by the floor, the first slab poured', lay: (o, { E, H, P, g }) => {
    const xs = [-H + 1, -H + 6, -H + 11], ys = [E + 4, E + 10], col = P.steel ?? '#7b7f84', beam = P.primer ?? '#c0543a';
    for (const x of xs) for (const y of ys) box(o, [x - 0.15, y - 0.15, 0], [x + 0.15, y + 0.15, 9.6], col, g);
    for (const z of [3.2, 6.4, 9.6]) {
      for (const y of ys) box(o, [xs[0], y - 0.12, z - 0.4], [xs[2], y + 0.12, z], beam, g);
      for (const x of xs) box(o, [x - 0.12, ys[0], z - 0.4], [x + 0.12, ys[1], z], beam, g);
    }
    box(o, [xs[0] - 0.3, ys[0] - 0.3, 3.2], [xs[1] + 0.3, ys[1] + 0.3, 3.4], P.slab ?? '#b5b0a8', g);
  } },
  crane: { about: 'a tower crane to the north-east, its jib out over the frame', lay: (o, { E, P, g }) => {
    const cx = E + 6, cy = E + 8, top = 22, y = P.crane ?? '#e8b04a';
    for (const [dx, dy] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) box(o, [cx + dx - 0.08, cy + dy - 0.08, 0], [cx + dx + 0.08, cy + dy + 0.08, top], y, g);
    for (let z = 3; z < top; z += 3) { box(o, [cx - 0.7, cy - 0.75, z], [cx + 0.7, cy - 0.65, z + 0.1], y, g); box(o, [cx - 0.7, cy + 0.65, z], [cx + 0.7, cy + 0.75, z + 0.1], y, g); box(o, [cx - 0.75, cy - 0.7, z], [cx - 0.65, cy + 0.7, z + 0.1], y, g); box(o, [cx + 0.65, cy - 0.7, z], [cx + 0.75, cy + 0.7, z + 0.1], y, g); }
    box(o, [cx - 26, cy - 0.45, top], [cx + 0.8, cy + 0.45, top + 0.9], y, g);
    box(o, [cx + 0.8, cy - 0.45, top], [cx + 8, cy + 0.45, top + 0.7], y, g);
    box(o, [cx + 6, cy - 0.8, top - 2], [cx + 8, cy + 0.8, top], P.slab ?? '#b5b0a8', g);
    box(o, [cx + 0.8, cy - 0.9, top - 2.2], [cx + 2.4, cy + 0.9, top - 0.2], P.cab ?? '#f2ede4', g);
    box(o, [cx - 0.2, cy - 0.2, top + 0.9], [cx + 0.2, cy + 0.2, top + 5], y, g);
    box(o, [cx - 14.03, cy - 0.03, 9], [cx - 13.97, cy + 0.03, top], P.steel ?? '#5f6368', g);
    box(o, [cx - 14.3, cy - 0.3, 8.4], [cx - 13.7, cy + 0.3, 9], P.steel ?? '#5f6368', g);
  } },
  yard: { about: 'a materials yard to the west: crates, sandbags, drums on pallets', lay: (o, { E, H, P, g }) => {
    const pal = { cabinet: P.wood ?? '#c9a978', beam: P.steel ?? '#5f6368', trim: P.crane ?? '#e8b04a', paint: P.crane ?? '#e8b04a', services: '#9aa3ab', concrete: '#b5b0a8', column: '#7b7f84', grate: '#5f6368' };
    const rows = [['crate', 1.2, 1.2, 1.0], ['sandbags', 1.6, 0.8, 0.6], ['barrel', 0.7, 0.7, 0.95], ['crate', 1.2, 1.2, 1.0], ['sack', 0.8, 0.6, 0.5]];
    rows.forEach(([kind, w, d, h], k) => { const y = -H + 2 + k * ((2 * H - 4) / rows.length); piece(o, kind, -E - 2.5, y, [w, d, h], pal, g); piece(o, kind, -E - 5, y + 1.2, [w, d, h], pal, g); });
  } },
  houses: { about: "the neighbours' houses, gabled, round the garden", lay: (o, { E, H, P, g }) => {
    const pal = { wall: P.house ?? '#e9e1d3', roof: P.roof ?? '#8c5a46', trim: '#ffffff', glass: P.glass ?? '#9fb6c4', door: P.door ?? '#4f6f52' };
    houseFaces(o, { x: [-E - 11, -E - 3], y: [-4, 4], h: 5.4 }, pal, { group: g });
    houseFaces(o, { x: [E + 3, E + 11], y: [-3, 5], h: 5.4 }, { ...pal, wall: P.houseAlt ?? '#d9cbb5' }, { group: g });
    houseFaces(o, { x: [-H + 1, -H + 9], y: [E + 4, E + 11], h: 5.4 }, { ...pal, wall: P.houseAlt ?? '#d9cbb5' }, { group: g });
    houseFaces(o, { x: [H - 9, H - 1], y: [E + 4, E + 11], h: 5.4 }, pal, { group: g });
  } },
  colonnade: { about: 'a colonnade round the hall, north, east and west', lay: (o, { E, H, P, g }) => {
    const c = P.column ?? '#d9cfbf', beam = P.trim ?? '#cfc4b2', off = E + 3;
    const runs = [[(u) => [u, off], -off, off], [(u) => [-off, u], -H, off], [(u) => [off, u], -H, off]];
    for (const [pt, u0, u1] of runs) {
      for (const u of along(u0, u1, 3.5)) { const [x, y] = pt(u); box(o, [x - 0.5, y - 0.5, 0], [x + 0.5, y + 0.5, 0.35], beam, g); prism(o, [x, y], 0.35, 0.35, 0.35, 5, 10, c, g); box(o, [x - 0.5, y - 0.5, 5], [x + 0.5, y + 0.5, 5.3], beam, g); }
      const a = pt(u0), b = pt(u1);
      box(o, [Math.min(a[0], b[0]) - 0.5, Math.min(a[1], b[1]) - 0.5, 5.3], [Math.max(a[0], b[0]) + 0.5, Math.max(a[1], b[1]) + 0.5, 6.1], beam, g);
    }
  } },
});

// ── the areas, a trade's own ─────────────────────────────────────────────────────────────────────────────────────────
export const AREAS = Object.freeze({
  kitchen: { about: 'a restaurant kitchen: tiled floor and walls, the dining room past the far wall, the street to the east',
    floor: { pattern: 'tiles', colors: ['#e9e4da', '#cfc8bb'] }, walls: { style: 'tiled' }, surround: ['dining', 'street'], ground: '#9a958c', sky: '#e9eef2',
    palette: { wood: '#b98b5e', dark: '#5e432c', wall: '#efe9df', glass: '#bcd6e2' } },
  farm: { about: 'a farm yard: trodden earth inside a post-and-rail fence, fields, a barn, trees',
    floor: { pattern: 'earth' }, walls: { style: 'fence' }, surround: ['fields', 'barn', 'trees'], ground: '#8fae5a', sky: '#dfeaf2',
    palette: { barn: '#a8432f', roof: '#4a4a4a' } },
  site: { about: 'a building site: slabs inside the hoarding, a frame going up, a tower crane, the materials yard',
    floor: { pattern: 'concrete' }, walls: { style: 'hoarding' }, surround: ['frame', 'crane', 'yard'], ground: '#a69a86', sky: '#e6e4dc',
    palette: {} },
  chores: { about: "a garden: a lawn inside a hedge, the neighbours' houses, trees; a roof's deck drawn as the house",
    floor: { pattern: 'lawn' }, walls: { style: 'hedge' }, surround: ['houses', 'trees'], ground: '#86a35a', sky: '#dde8ef',
    palette: { house: '#e9e1d3', houseAlt: '#d9cbb5', roof: '#8c5a46', wall: '#ede5d6' } },
  hall: { about: 'a hall: flagstones, stone walls between pilasters, high windows, a colonnade outside',
    floor: { pattern: 'flags' }, walls: { style: 'stone' }, surround: ['colonnade', 'trees'], ground: '#a59d90', sky: '#e4e0d8',
    palette: {} },
});

const KEYS = ['like', 'floor', 'walls', 'surround', 'ground', 'sky', 'cut'];
const need = (ok, msg) => { if (!ok) throw new Error(`game room: area ${msg}`); };
const hex = (v, what) => { need(typeof v === 'string' && HEX.test(v), `${what} is a colour (#rrggbb)`); return v.toLowerCase(); };

/** An area: the trade's own, one named, or one written over another (see the header); false the conceptual plane. */
export function readArea(spec, trade = 'hall') {
  if (spec === false) return null;
  const names = Object.keys(AREAS).join(', ');
  if (typeof spec === 'string') need(AREAS[spec], `is ${names}, an object over one, or false (the plane)`);
  else need(spec == null || (typeof spec === 'object' && !Array.isArray(spec)), `is ${names}, an object over one, or false (the plane)`);
  const S = spec && typeof spec === 'object' ? spec : {};
  for (const k of Object.keys(S)) need(KEYS.includes(k), `has no '${k}' (${KEYS.join(', ')})`);
  const name = typeof spec === 'string' ? spec : S.like ?? trade;
  need(AREAS[name], `'like' is ${names}`);
  const B = AREAS[name];
  // the floor: its pattern, its colours (the area's own while it keeps its pattern, else the pattern's)
  const F = typeof S.floor === 'string' ? { pattern: S.floor } : S.floor ?? {};
  need(typeof F === 'object', `floor is a pattern (${Object.keys(FLOORS).join(', ')}) or { pattern?, colors? }`);
  const pattern = F.pattern ?? B.floor.pattern;
  need(FLOORS[pattern], `floor is ${Object.keys(FLOORS).join(', ')}`);
  const fc = F.colors ?? (pattern === B.floor.pattern ? B.floor.colors : null) ?? FLOORS[pattern].colors;
  need(Array.isArray(fc) && fc.length >= 2, 'floor colors are two or more colours');
  // the walls: a style, its height and its colours
  const Wd = typeof S.walls === 'string' ? { style: S.walls } : S.walls === false ? { style: 'none' } : S.walls ?? {};
  need(typeof Wd === 'object', `walls is a style (${Object.keys(WALLS).join(', ')}), false, or { style?, height?, colors? }`);
  const style = Wd.style ?? B.walls.style;
  need(WALLS[style], `walls is ${Object.keys(WALLS).join(', ')}`);
  const height = Wd.height ?? (style === B.walls.style ? B.walls.height : null) ?? WALLS[style].height;
  need(typeof height === 'number' && height >= 0 && height <= 12, 'walls height is metres, 0 to 12');
  need(Wd.colors == null || (typeof Wd.colors === 'object' && !Array.isArray(Wd.colors)), 'walls colors is { <part>: colour }');
  const wcolors = { ...WALLS[style].colors };
  for (const [k, v] of Object.entries(Wd.colors ?? {})) { need(k in WALLS[style].colors, `walls colors are ${Object.keys(WALLS[style].colors).join(', ') || 'none'} for ${style}`); wcolors[k] = hex(v, `walls ${k}`); }
  // what stands outside
  const surround = S.surround === false ? [] : S.surround ?? B.surround;
  need(Array.isArray(surround) && surround.every((x) => SURROUNDS[x]), `surround is a list of ${Object.keys(SURROUNDS).join(', ')}, or false`);
  let cut;
  if (S.cut !== undefined) {
    need(S.cut === true || S.cut === false || (Array.isArray(S.cut) && S.cut.every((x) => SIDES.includes(x))), "cut is true, false or sides ('n', 's', 'e', 'w')");
    cut = S.cut === true ? SIDES.slice() : S.cut === false ? [] : [...new Set(S.cut)];
  }
  return {
    name, about: B.about, floor: { pattern, colors: fc.map((c, k) => hex(c, `floor colour ${k + 1}`)) }, walls: { style, height, colors: wcolors },
    surround: [...new Set(surround)], ground: hex(S.ground ?? B.ground, 'ground'), sky: hex(S.sky ?? B.sky, 'sky'), ...(cut ? { cut } : {}), palette: { ...B.palette },
  };
}

/** The area's faces round a room of `half` (see the header), the walls cut away on the sides in `cut`. */
export function buildArea(A, { half, cut = ['s'], seed = 1 } = {}) {
  const H = half, faces = [], sides = A.cut ?? cut, W = WALLS[A.walls.style];
  // the ground beyond, a hair under the floor
  faces.push(flatQ(-H - 60, -H - 60, H + 60, H + 60, -0.01, A.ground, 'room:area:ground'));
  floorFaces(faces, H, A.floor, streamOf(seed, 'gameroom-area', 'floor'));
  let heights = null;
  if (A.walls.style !== 'none' && A.walls.height > 0) {
    heights = {};
    const ext = Math.max(W.depth, T);
    for (const side of SIDES) {
      const isCut = sides.includes(side), h = isCut ? Math.min(CUT, A.walls.height) : A.walls.height;
      const [u0, u1] = side === 'n' || side === 's' ? [-H - ext, H + ext] : [-H, H];
      W.draw(faces, H, side, u0, u1, h, !isCut, A.walls.colors, 'room:area:wall');
      // a cut wall's section, dark, as an architect's cut (a low wall's top is its own)
      if (isCut && A.walls.height > CUT && ['plain', 'tiled', 'stone', 'hoarding'].includes(A.walls.style)) {
        const d1 = A.walls.style === 'hoarding' ? 0.1 : T;
        const a = at(H, side, u0, 0, h + 0.003), b = at(H, side, u1, d1, h + 0.003);
        faces.push(flatQ(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), h + 0.003, '#4a4540', 'room:area:cut'));
      }
      heights[side] = r3(h);
    }
  }
  const E = H + T, dice = streamOf(seed, 'gameroom-area', 'surround');
  for (const s of A.surround) SURROUNDS[s].lay(faces, { E, H, dice, P: A.palette, g: `room:area:${s}` });
  return { faces, heights, bg: A.sky, laid: A.surround.slice() };
}

/** The room's four walls (floorOf's first colliders: south, north, west, east) at the heights drawn. */
export function raiseWalls(colliders, half, heights) {
  if (!heights) return colliders;
  const H = half;
  return colliders.map((c, k) => {
    if (k > 3) return c;
    const side = c.max[1] <= -H ? 's' : c.min[1] >= H ? 'n' : c.max[0] <= -H ? 'w' : c.min[0] >= H ? 'e' : null;
    return side && heights[side] != null ? { ...c, max: [c.max[0], c.max[1], heights[side]] } : c;
  });
}
