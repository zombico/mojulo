/**
 * brawl dress — THE STREET'S DRESS: what stands along a brawl's belt beside the band, so a street reads as a place and
 * each of its screens as its own. It is laid on the belt, never on the level under it, so any street takes it: the
 * strips it may fill are the level's to say (the far walk between the band and the fronts, the near walk between the
 * band and the camera).
 *
 * Three shelves, each a table (a new thing is a row):
 *   DRESS_PIECES   a thing built from boxes and slopes in its own frame (s along the street, n across it, z up): a crate,
 *                  a stack of them, a barrel, a pallet, sacks, a market stall under its canopy, a cafe table under its
 *                  parasol, a sandwich board, a planter, a bench, a paper box, a skip, tyres, a hand cart, and on the
 *                  WALL a poster, a tag (the crew's mark) and a hung banner
 *   DRESS_SETS     a screen's theme: the pieces its far side draws from (by weight), how close they stand, what its
 *                  wall carries, and the few LOW things its near side takes (nothing there stands over a body's knee:
 *                  the near side is between the camera and the fight)
 *   the layout     seeded: a screen's far side walked from its start to its end, a piece and a gap at a time, each
 *                  against the fronts; its wall's marks at their stride; its near side sparse
 *
 *   readDress(dress, belt, where)   → the settled dress { seed, sets: [a set a screen], colour?, far, near?, wall }
 *   dressFaces(dress, belt)         → [{ corners: [[x, y, z]…] world metres, out: [x, y, z], hex }] its faces, unshaded
 *   dressSceneFaces(dress, belt, light?) → the same as a World page's faces (wound to their `out`, shaded by the level's light)
 *   DRESS_SETTINGS, dressSets(belt, setting), settingOfKit(kit)   the kinds of place, each its sets and its turn
 *   dressLaws(dress, belt)          → [{ law, ok, what }] the principles of a side-scrolling map, measured (they advise)
 *   boxModels(whats)                → the street's breakables as skandart's vessels, and what each leaves broken
 *   dressCount(dress, belt)         → { pieces, faces, bySet }
 *
 * `colour` is the crew's (the faction the street is held by): its tags, its banners and one canopy in a market wear it.
 * A dress collides with nothing: it stands outside the band, by its strips. Pure and deterministic (seeded dice only).
 */
import { beltPoint, beltFloor, beltDrift } from './brawl-belt.js';
import { THINGS } from './brawl-things.js';
import { streamOf } from '../city/plan/dice.js';
import { shadeHex } from '../polygonizer/vexar.js';
import { skandartVessels } from '../era/skandart-vessels.js';
import { skandartRead } from '../era/skandart.js';
import { debrisPiece, DEBRIS } from '../era/debris-shelf.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const HEX = /^#[0-9a-f]{6}$/i;
const r3 = (v) => Math.round(v * 1000) / 1000;

// the dress's own colours (a piece's own unless the crew's colour is asked: `crew`)
const C = Object.freeze({
  timber: '#9a7448', timberDark: '#6e5132', slat: '#b08a5a', iron: '#3a3d42', steel: '#7d848c', tyre: '#1f2023', sack: '#c9b58c', sackDark: '#a8946c',
  canvas: ['#b8442e', '#2f6a8a', '#d9b44a', '#3f7a4f', '#e9e2d0'], stripe: '#f1ead8', leaf: '#3f6e3a', leafDark: '#2f5530', soil: '#4a3a2c', terracotta: '#b5683f',
  bag: '#17181b', bagTie: '#2c2e33', card: ['#a98758', '#8f7148', '#b89868'], steel: '#8b9198', steelDark: '#6b7178', rust: '#7a4a32', lit: '#f2e9c4', fire: '#f08a2a', ember: '#c8451e',
  machine: ['#c8322a', '#2a62b8', '#e8e4d8'], neon: ['#ff4f8a', '#35e0d0', '#ffd23a', '#7a5cff'], spray: ['#f2f0e8', '#111214', '#ffd23a', '#35e0d0', '#ff4f8a'], wood: '#8a6a44', asphalt: '#2a2b2e', scrap: ['#e8dfc8', '#c9d4d8', '#d8b4a8'],
  goods: ['#d2452f', '#e0a030', '#6a9a3a', '#e8d9a0', '#8a4a7a'], paper: ['#e8dfc8', '#c9d4d8', '#e6c9a0', '#d8b4a8'], ink: '#24262b', chalk: '#ece8dc', skip: '#2f5d4a', paperBox: ['#b3261e', '#1f4fa8', '#d9b44a'],
});

// ── SKANDART on the street (era/skandart.js): a place's debris and what it kept. Two of its shelves are used as they
// are: its VESSELS (era/skandart-vessels.js: crates, barrels, steel drums, footlockers standing in a group, some tipped,
// some already broken where they stood, by how far gone the place is) and its DEBRIS SHELF (era/debris-shelf.js: what
// piles up when a place comes down, each piece built by its row). A piece too small to be read from where the street is
// seen is left out, as skandart's law has it. ──
const hex2 = (v) => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0');
const tintHex = (t) => `#${hex2(t[0])}${hex2(t[1])}${hex2(t[2])}`;
// (the street is seen from further off than a room's filler: the least piece read, a little over a 1080-line frame's)
const LEAST = Math.round(skandartRead(1080).least * 1.4 * 1000) / 1000;
// each matter's colour as debris (a piece's tone is its source's)
const MATTER_HEX = Object.freeze({ brick: '#8c4a3a', concrete: '#8d8f8e', stone: '#9a968c', render: '#cfc4a8', paper: '#e8dfc8', glass: '#9fc6c9', wood: '#8a6a44', board: '#d8d2c2', steel: '#6b7178', slate: '#4a5058', terracotta: '#b5683f' });
/** A group of skandart's vessels in the piece's frame, its back to the wall: `kinds` the roles and their shares, `look`
 * old (wood and clay) or industrial (painted steel), `amount` how far gone (more tipped, more broken). */
function vessels(kinds, look, amount, len, R) {
  const V = skandartVessels({ kit: {} }, [{ x: 0, y: 0, len, N: [0, -1, 0], U: [1, 0, 0], out: 0 }], { amount, seed: 1 + Math.floor(R() * 1e6), card: { kinds, look }, read: { least: LEAST } });
  // (its group stands from the wall's line out: set back so its back is the piece's back)
  const back = Math.max(0, ...V.faces.flatMap((f) => f.corners.map((c) => c[1])));
  return V.faces.map((f) => ({ corners: f.corners.map(([x, y, z]) => [x, y - back, Math.max(0, z)]), out: f.outNormal ?? f.normal, hex: tintHex(f.tint ?? [0.5, 0.45, 0.4]) }));
}
/** Debris off the shelf scattered over a patch (a × b m, the piece's own frame): `mix` { id: how many }, the bigger
 * farther from the wall (a fall sorts what comes down it). */
function debris(mix, a, b, R) {
  const out = [];
  for (const [id, n] of Object.entries(mix)) for (let k = 0; k < n; k++) {
    // (never under what the street's frame reads: a small thing is built at the least size it is seen at, or left out)
    const D = DEBRIS[id], w0 = D.size[0] + (D.size[1] - D.size[0]) * R();
    if (D.size[1] < LEAST) continue;
    const w = Math.max(w0, LEAST * 1.4);
    const P = debrisPiece(id, w, Math.floor(R() * 1e6)), t = R() * Math.PI * 2, c = Math.cos(t), si = Math.sin(t);
    const big = (w - D.size[0]) / Math.max(1e-6, D.size[1] - D.size[0]), s = (R() - 0.5) * a, n = b / 2 - (0.1 + big * 0.6 + R() * 0.3) * b;
    for (const f of P.faces) out.push({ corners: f.corners.map(([x, y, z]) => [s + x * c - y * si, n + x * si + y * c, z + 0.004]), out: [f.normal[0] * c - f.normal[1] * si, f.normal[0] * si + f.normal[1] * c, f.normal[2]], hex: MATTER_HEX[f.matter ?? D.matter] ?? '#8a8a86' });
  }
  return out;
}

// ── the primitives (a piece's own frame: s along, n across, z up; `out` in the same frame) ──
// (the contemporary interiors' own: a plant, a base, an office)
const K = Object.freeze({
  safety: '#e8a21c', black: '#1b1c1f', orange: '#d9601c', white: '#ecebe6', rackBlue: '#2f4f86', rackOrange: '#d9641e', tankSteel: '#9aa1a8', valve: '#c22d24', machine: '#3f6a4a', machineY: '#d8b11e',
  locker: ['#5f7186', '#6f7f6a', '#7a7f88'], olive: '#4b5334', khaki: '#a8996c', khakiDark: '#8a7c56', camo: ['#4b5334', '#6b6a44', '#2f3a2a', '#7c7450'], gun: '#232528', lamp: '#fff4c4',
  desk: '#b79a72', deskDark: '#7b6248', screen: '#9fd0e6', plastic: '#d9d9d4', plasticDark: '#b9bab6', fabric: ['#3e5f7a', '#7a4a3e', '#4f6a52', '#6a6a72'], board: '#f4f4f0', frame: '#3b3d42', glass: '#bcd9e4', blind: '#e2ddd0', exit: '#2fae5c', water: '#6fb7e0',
  art: ['#c8553a', '#3a6f9a', '#d9b44a', '#4f8a5a', '#8a5a9a'], mapPaper: '#e6dcc0',
});
const quad = (a, b, c, d, out, hex) => ({ corners: [a, b, c, d], out, hex });
/** A box s0..s1 × n0..n1 × z0..z1: its four sides and its top (its foot is on the ground or on another box). */
function box(s0, n0, s1, n1, z0, z1, hex, top = hex) {
  return [
    quad([s0, n0, z0], [s1, n0, z0], [s1, n0, z1], [s0, n0, z1], [0, -1, 0], hex),
    quad([s1, n1, z0], [s0, n1, z0], [s0, n1, z1], [s1, n1, z1], [0, 1, 0], hex),
    quad([s0, n1, z0], [s0, n0, z0], [s0, n0, z1], [s0, n1, z1], [-1, 0, 0], hex),
    quad([s1, n0, z0], [s1, n1, z0], [s1, n1, z1], [s1, n0, z1], [1, 0, 0], hex),
    quad([s0, n0, z1], [s1, n0, z1], [s1, n1, z1], [s0, n1, z1], [0, 0, 1], top),
  ];
}
/** An eight-sided drum at (s, n), radius r, z0..z1 (a barrel, a tyre, a pot). */
function drum(s, n, r, z0, z1, hex, top = hex) {
  const out = [], at = (k, z) => [s + r * Math.cos((k * Math.PI) / 4), n + r * Math.sin((k * Math.PI) / 4), z], rim = [];
  for (let k = 0; k < 8; k++) { const m = ((k + 0.5) * Math.PI) / 4; out.push(quad(at(k, z0), at(k + 1, z0), at(k + 1, z1), at(k, z1), [Math.cos(m), Math.sin(m), 0], hex)); rim.push(at(k, z1)); }
  out.push({ corners: rim, out: [0, 0, 1], hex: top });
  return out;
}
const post = (s, n, z0, z1, hex, r = 0.03) => box(s - r, n - r, s + r, n + r, z0, z1, hex).slice(0, 4);

// ── the pieces: { says, size: [along, across], tall, wall?, build(R, crew) → faces in the piece's frame, its middle at
// the origin, its back at +across/2 } ──
const crate = (s, n, z, w, R) => { const h = R() < 0.5 ? C.timber : C.slat; return [...box(s - w / 2, n - w / 2, s + w / 2, n + w / 2, z, z + w, h), ...box(s - w / 2 - 0.01, n - w / 2 - 0.01, s + w / 2 + 0.01, n - w / 2, z + w * 0.42, z + w * 0.58, C.timberDark).slice(0, 1)]; };
export const DRESS_PIECES = Object.freeze({
  crate: { says: 'a crate or a barrel left standing (skandart\'s vessels)', size: [0.9, 0.9], tall: 1, build: (R) => vessels({ crate: 2, barrel: 1 }, 'old', 0.2, 1, R) },
  crates: { says: 'crates and barrels in a group, one on another, one tipped or broken (skandart\'s vessels)', size: [2.6, 1.1], tall: 1.6, build: (R) => vessels({ crate: 3, barrel: 1, chest: 1 }, 'old', 0.55, 2.6, R) },
  barrel: { says: 'a barrel on its end', size: [0.7, 0.7], tall: 0.95, build: () => [...drum(0, 0, 0.33, 0, 0.95, C.timberDark, C.timber), ...drum(0, 0, 0.345, 0.2, 0.26, C.iron).slice(0, 8), ...drum(0, 0, 0.345, 0.68, 0.74, C.iron).slice(0, 8)] },
  barrels: { says: 'barrels and kegs in a group (skandart\'s vessels)', size: [2.2, 1], tall: 1.1, build: (R) => vessels({ barrel: 3, keg: 2 }, 'old', 0.45, 2.2, R) },
  pallet: { says: 'a pallet with a few boxes on it', size: [1.3, 1.1], tall: 0.7, build: (R) => [...box(-0.6, -0.5, 0.6, 0.5, 0.02, 0.14, C.slat), ...box(-0.5, -0.4, 0.05, 0.3, 0.14, 0.5 + R() * 0.2, C.paper[0]), ...box(0.1, -0.35, 0.52, 0.35, 0.14, 0.42, C.paper[2])] },
  sacks: { says: 'sacks heaped', size: [1.2, 0.8], tall: 0.6, build: () => [...box(-0.55, -0.3, 0, 0.3, 0, 0.26, C.sack), ...box(0.03, -0.32, 0.56, 0.28, 0, 0.26, C.sackDark), ...box(-0.3, -0.26, 0.3, 0.26, 0.26, 0.5, C.sack)] },
  stall: { says: 'a market stall: a table of goods under a striped canopy on four posts', size: [2.4, 1.3], tall: 2.5, crew: true,
    build(R, crew) {
      const hue = crew ?? C.canvas[Math.floor(R() * C.canvas.length)], out = [...box(-1.1, -0.45, 1.1, 0.45, 0.72, 0.8, C.timber), ...box(-1.1, -0.45, 1.1, -0.42, 0.2, 0.72, hue).slice(0, 1)];
      for (const [a, b] of [[-1.1, -0.45], [1.1, -0.45], [-1.1, 0.45], [1.1, 0.45]]) out.push(...post(a, b, 0, b < 0 ? 2.1 : 2.45, C.timberDark));
      // (its goods in their trays, and the canopy: sloped to the street, striped along it)
      for (let k = 0; k < 4; k++) out.push(...box(-1 + k * 0.52, -0.35, -0.56 + k * 0.52, 0.35, 0.8, 0.9 + R() * 0.08, C.goods[Math.floor(R() * C.goods.length)]));
      for (let k = 0; k < 6; k++) { const a = -1.25 + k * (2.5 / 6), b = a + 2.5 / 6; out.push(quad([a, -0.65, 2.05], [b, -0.65, 2.05], [b, 0.55, 2.5], [a, 0.55, 2.5], [0, -0.35, 0.94], k % 2 ? C.stripe : hue), quad([a, -0.65, 1.85], [b, -0.65, 1.85], [b, -0.65, 2.05], [a, -0.65, 2.05], [0, -1, 0], k % 2 ? C.stripe : hue)); }
      return out;
    } },
  cafe: { says: 'a cafe table and two chairs under a parasol', size: [2.2, 1.6], tall: 2.5, crew: true,
    build(R, crew) {
      const hue = crew ?? C.canvas[Math.floor(R() * C.canvas.length)], out = [...post(0, 0, 0, 0.72, C.iron, 0.035), ...drum(0, 0, 0.4, 0.72, 0.76, C.chalk)];
      for (const k of [-1, 1]) out.push(...box(k * 0.75 - 0.2, -0.2, k * 0.75 + 0.2, 0.2, 0.42, 0.46, C.timber), ...box(k * 0.93 - 0.02, -0.2, k * 0.93 + 0.02, 0.2, 0.46, 0.88, C.timber), ...post(k * 0.75, 0, 0, 0.42, C.iron));
      out.push(...post(0, 0, 0.76, 2.2, C.iron, 0.02));
      for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4, b = ((k + 1) * Math.PI) / 4, m = (a + b) / 2; out.push({ corners: [[0, 0, 2.5], [1.1 * Math.cos(a), 1.1 * Math.sin(a), 2.15], [1.1 * Math.cos(b), 1.1 * Math.sin(b), 2.15]], out: [Math.cos(m) * 0.4, Math.sin(m) * 0.4, 0.9], hex: k % 2 ? C.stripe : hue }); }
      return out;
    } },
  board: { says: 'a sandwich board on the walk', size: [0.6, 0.6], tall: 1, build: (R) => { const p = C.paper[Math.floor(R() * C.paper.length)]; return [quad([-0.28, -0.22, 0], [0.28, -0.22, 0], [0.28, 0, 0.95], [-0.28, 0, 0.95], [0, -0.97, 0.24], C.ink), quad([-0.22, -0.2, 0.2], [0.22, -0.2, 0.2], [0.22, -0.04, 0.85], [-0.22, -0.04, 0.85], [0, -0.97, 0.24], p), quad([0.28, 0.22, 0], [-0.28, 0.22, 0], [-0.28, 0, 0.95], [0.28, 0, 0.95], [0, 0.97, 0.24], C.ink)]; } },
  planter: { says: 'a planter box, a clipped shrub in it', size: [1.2, 0.6], tall: 1.1, build: () => [...box(-0.55, -0.25, 0.55, 0.25, 0, 0.45, C.terracotta, C.soil), ...box(-0.48, -0.2, 0.48, 0.2, 0.45, 0.95, C.leaf, C.leafDark), ...box(-0.3, -0.14, 0.3, 0.14, 0.95, 1.1, C.leafDark)] },
  pot: { says: 'a pot with a shrub', size: [0.6, 0.6], tall: 0.9, build: () => [...drum(0, 0, 0.26, 0, 0.4, C.terracotta, C.soil), ...drum(0, 0, 0.3, 0.4, 0.85, C.leaf, C.leafDark)] },
  bench: { says: 'a bench, its back to the wall', size: [1.9, 0.6], tall: 0.9, build: () => [...box(-0.9, -0.22, 0.9, 0.2, 0.42, 0.47, C.timber), ...box(-0.9, 0.2, 0.9, 0.24, 0.5, 0.88, C.timber), ...post(-0.78, 0, 0, 0.42, C.iron, 0.04), ...post(0.78, 0, 0, 0.42, C.iron, 0.04)] },
  paperbox: { says: 'a newspaper box', size: [0.5, 0.45], tall: 1.05, build: (R) => { const h = C.paperBox[Math.floor(R() * C.paperBox.length)]; return [...box(-0.22, -0.2, 0.22, 0.2, 0.25, 1.05, h), ...box(-0.18, -0.21, 0.18, -0.2, 0.6, 0.95, C.paper[0]).slice(0, 1), ...post(0, 0, 0, 0.25, C.iron, 0.06)]; } },
  skip: { says: 'a rubbish skip, its lid sloped', size: [1.9, 1.1], tall: 1.3, build: () => [...box(-0.9, -0.5, 0.9, 0.5, 0.08, 1.05, C.skip).slice(0, 4), quad([-0.92, -0.52, 1.05], [0.92, -0.52, 1.05], [0.92, 0.52, 1.3], [-0.92, 0.52, 1.3], [0, -0.24, 0.97], C.iron), { corners: [[-0.92, 0.52, 1.05], [-0.92, -0.52, 1.05], [-0.92, 0.52, 1.3]], out: [-1, 0, 0], hex: C.skip }, { corners: [[0.92, -0.52, 1.05], [0.92, 0.52, 1.05], [0.92, 0.52, 1.3]], out: [1, 0, 0], hex: C.skip }, quad([0.92, 0.52, 1.05], [-0.92, 0.52, 1.05], [-0.92, 0.52, 1.3], [0.92, 0.52, 1.3], [0, 1, 0], C.skip)] },
  tyres: { says: 'tyres stacked', size: [0.8, 0.8], tall: 0.9, build: (R) => { const out = [], n = 3 + Math.floor(R() * 2); for (let k = 0; k < n; k++) out.push(...drum((R() - 0.5) * 0.06, (R() - 0.5) * 0.06, 0.34, k * 0.22, k * 0.22 + 0.2, C.tyre, C.iron)); return out; } },
  cart: { says: 'a hand cart, its handles up', size: [1.7, 0.9], tall: 1, build: () => [...box(-0.6, -0.38, 0.6, 0.38, 0.4, 0.75, C.slat, C.timberDark), ...drum(-0.2, -0.42, 0.28, 0.12, 0.2, C.iron).map(tipWheel(-0.2, -0.42)), ...box(0.6, -0.36, 1.05, -0.3, 0.7, 0.76, C.timberDark), ...box(0.6, 0.3, 1.05, 0.36, 0.7, 0.76, C.timberDark), ...post(0.45, 0, 0, 0.4, C.timberDark, 0.04)] },
  bollard: { says: 'an iron bollard', size: [0.3, 0.3], tall: 0.8, build: () => [...drum(0, 0, 0.09, 0, 0.72, C.iron), ...drum(0, 0, 0.12, 0.72, 0.8, C.iron)] },
  // (the street gone rough)
  drums: { says: 'steel drums and steel crates in a group, some tipped (skandart\'s vessels, the industrial look)', size: [2.6, 1.1], tall: 1.3, build: (R) => vessels({ barrel: 3, crate: 2, chest: 1 }, 'industrial', 0.6, 2.6, R) },
  rubble: { says: 'what the wall sheds, at its foot: bricks, spall, flakes of render (the debris shelf)', size: [2.4, 1.1], tall: 0.3, build: (R) => debris({ brick: 22, spall: 12, 'render-flake': 10, 'concrete-chunk': 5 }, 2.2, 1, R) },
  wreckage: { says: 'a heap of what came down: broken concrete, bricks, planks, a sheet of roof (the debris shelf)', size: [2.6, 1.4], tall: 0.6, build: (R) => debris({ 'concrete-chunk': 12, 'slab-chunk': 3, brick: 16, plank: 4, splinter: 6, 'deck-sheet': 1, spall: 8 }, 2.4, 1.3, R) },
  shards: { says: 'broken glass and papers on the walk (the debris shelf)', size: [1.8, 1], tall: 0.05, build: (R) => debris({ 'glass-shard': 18, paper: 8 }, 1.6, 0.9, R) },
  bags: { says: 'rubbish bags heaped', size: [1.3, 0.8], tall: 0.7, build: (R) => { const out = []; for (const [a, b, r, h] of [[-0.36, 0, 0.3, 0.5], [0.22, 0.06, 0.32, 0.58], [-0.04, -0.2, 0.24, 0.4]]) out.push(...drum(a + (R() - 0.5) * 0.08, b, r, 0, h, C.bag, C.bagTie), ...drum(a, b, 0.07, h, h + 0.1, C.bagTie)); return out; } },
  boxes: { says: 'cardboard boxes dumped, some flat', size: [1.4, 0.9], tall: 0.9, build: (R) => { const h = () => C.card[Math.floor(R() * C.card.length)]; return [...box(-0.65, -0.3, -0.05, 0.3, 0, 0.45, h()), ...box(0, -0.35, 0.6, 0.25, 0, 0.36, h()), ...box(-0.45, -0.22, 0.08, 0.24, 0.45, 0.82, h()), ...box(0.1, -0.42, 0.68, -0.36, 0, 0.5, h())]; } },
  vending: { says: 'a vending machine, its front lit', size: [1, 0.8], tall: 1.9, build: (R) => { const h = C.machine[Math.floor(R() * C.machine.length)]; return [...box(-0.45, -0.35, 0.45, 0.35, 0, 1.85, h), ...box(-0.36, -0.36, 0.16, -0.35, 0.7, 1.7, C.lit).slice(0, 1), ...box(0.22, -0.36, 0.38, -0.35, 0.9, 1.4, C.ink).slice(0, 1), ...box(-0.36, -0.36, 0.38, -0.35, 0.18, 0.42, C.ink).slice(0, 1)]; } },
  drumfire: { says: 'an oil drum with a fire in it', size: [0.7, 0.7], tall: 1.2, build: () => [...drum(0, 0, 0.3, 0, 0.88, C.rust, C.ember), ...drum(0, 0, 0.31, 0.3, 0.34, C.iron).slice(0, 8), ...drum(0, 0, 0.2, 0.88, 1.02, C.fire, C.fire), ...drum(0, 0, 0.1, 1.02, 1.18, '#ffd23a', '#ffd23a')] },
  litter: { says: 'litter on the walk: papers and a stain', size: [1.6, 1], tall: 0.02, build: (R) => { const out = [{ corners: Array.from({ length: 8 }, (_, k) => [0.2 + 0.5 * Math.cos((k * Math.PI) / 4), 0.1 + 0.32 * Math.sin((k * Math.PI) / 4), 0.012]), out: [0, 0, 1], hex: C.asphalt }]; for (let k = 0; k < 4; k++) { const a = -0.7 + R() * 1.2, b = -0.4 + R() * 0.7, w = 0.16 + R() * 0.14; out.push(quad([a, b, 0.018], [a + w, b + 0.04, 0.018], [a + w - 0.05, b + w, 0.018], [a - 0.04, b + w - 0.03, 0.018], [0, 0, 1], C.scrap[Math.floor(R() * C.scrap.length)])); } return out; } },
  // (on the wall: flat, a hand proud of it; its back is the wall's line)
  shutter: { says: 'a steel shutter rolled down over a shopfront, sprayed', size: [3, 0.05], tall: 2.7, wall: true, crew: true,
    build: (R, crew) => { const out = []; for (let k = 0; k < 12; k++) out.push(quad([-1.45, 0, 0.1 + k * 0.21], [1.45, 0, 0.1 + k * 0.21], [1.45, 0, 0.31 + k * 0.21], [-1.45, 0, 0.31 + k * 0.21], [0, -1, 0], k % 2 ? C.steel : C.steelDark)); out.push(...box(-1.5, -0.05, 1.5, 0, 2.62, 2.74, C.iron).slice(0, 1)); const h = crew ?? C.spray[2 + Math.floor(R() * 3)], z = 0.6 + R() * 0.3; out.push(quad([-0.9, -0.006, z], [-0.6, -0.006, z], [-0.1, -0.006, z + 1.1], [-0.4, -0.006, z + 1.1], [0, -1, 0], h), quad([-0.3, -0.006, z + 1.1], [0, -0.006, z + 1.1], [0.5, -0.006, z], [0.2, -0.006, z], [0, -1, 0], h), quad([0.45, -0.006, z + 0.2], [1.1, -0.006, z + 0.2], [1.1, -0.006, z + 0.45], [0.45, -0.006, z + 0.45], [0, -1, 0], C.spray[Math.floor(R() * 2)])); return out; } },
  piece: { says: 'a big piece sprayed along the wall: blocks of colour, outlined', size: [3.6, 0.05], tall: 2.2, wall: true, crew: true,
    build: (R, crew) => { const out = [], main = crew ?? C.spray[2 + Math.floor(R() * 3)], hi = C.spray[2 + Math.floor(R() * 3)]; let a = -1.7; for (let k = 0; k < 5; k++) { const w = 0.5 + R() * 0.25, lean = (R() - 0.5) * 0.3, z = 0.45 + R() * 0.2, h = 1.1 + R() * 0.4; out.push(quad([a - 0.05, 0, z - 0.05], [a + w + 0.05, 0, z - 0.05], [a + w + lean + 0.05, 0, z + h + 0.05], [a + lean - 0.05, 0, z + h + 0.05], [0, -1, 0], C.spray[1]), quad([a, -0.004, z], [a + w, -0.004, z], [a + w + lean, -0.004, z + h], [a + lean, -0.004, z + h], [0, -1, 0], k % 2 ? hi : main), quad([a + 0.08, -0.008, z + h * 0.62], [a + w - 0.08, -0.008, z + h * 0.62], [a + w - 0.08 + lean * 0.2, -0.008, z + h * 0.8], [a + 0.08 + lean * 0.2, -0.008, z + h * 0.8], [0, -1, 0], C.spray[0])); a += w + 0.12; } return out; } },
  boards: { says: 'a window boarded up', size: [1.5, 0.05], tall: 2.5, wall: true, build: () => { const out = []; for (let k = 0; k < 5; k++) out.push(quad([-0.7, 0, 1 + k * 0.28], [0.7, 0, 1.04 + k * 0.28], [0.7, 0, 1.26 + k * 0.28], [-0.7, 0, 1.22 + k * 0.28], [0, -1, 0], k % 2 ? C.wood : C.timberDark)); out.push(quad([-0.6, -0.004, 1.05], [-0.42, -0.004, 1.05], [0.6, -0.004, 2.3], [0.42, -0.004, 2.3], [0, -1, 0], C.wood)); return out; } },
  aircon: { says: 'an air conditioner\'s box on the wall, its pipe down', size: [0.9, 0.5], tall: 4.2, wall: true, build: () => [...box(-0.42, -0.42, 0.42, 0, 3.5, 4.1, C.chalk, C.steel), ...box(-0.34, -0.43, 0.1, -0.42, 3.58, 4.02, C.steelDark).slice(0, 1), ...box(0.3, -0.08, 0.36, -0.02, 0.3, 3.5, C.steelDark).slice(0, 4)] },
  pipe: { says: 'a drainpipe down the wall, rust under it', size: [0.4, 0.2], tall: 9, wall: true, build: () => [...box(-0.07, -0.14, 0.07, 0, 0.1, 9, C.iron).slice(0, 4), ...box(-0.12, -0.18, 0.12, 0, 2.9, 3.05, C.iron).slice(0, 4), quad([-0.2, 0, 0.1], [0.24, 0, 0.1], [0.12, 0, 1.3], [-0.1, 0, 1.3], [0, -1, 0], C.rust)] },
  neon: { says: 'a blade sign out from the wall, lit', size: [0.4, 1], tall: 5, wall: true, build: (R) => { const h = C.neon[Math.floor(R() * C.neon.length)], z = 3.1 + R() * 0.5; return [...box(-0.07, -0.95, 0.07, -0.1, z, z + 1.7, C.ink), quad([-0.075, -0.88, z + 0.1], [-0.075, -0.17, z + 0.1], [-0.075, -0.17, z + 1.6], [-0.075, -0.88, z + 1.6], [-1, 0, 0], h), quad([0.075, -0.17, z + 0.1], [0.075, -0.88, z + 0.1], [0.075, -0.88, z + 1.6], [0.075, -0.17, z + 1.6], [1, 0, 0], h), ...box(-0.03, -0.1, 0.03, 0, z + 0.3, z + 0.36, C.iron).slice(0, 4), ...box(-0.03, -0.1, 0.03, 0, z + 1.3, z + 1.36, C.iron).slice(0, 4)]; } },
  escape: { says: 'a fire escape up the wall: landings on brackets, railed, a ladder between them and one hung over the walk', size: [2.8, 1], tall: 10, wall: true,
    build: () => {
      const out = [], I = C.iron;
      for (const [k, z] of [[0, 3.3], [1, 6.3], [2, 9.3]]) {
        // a landing: its grating, its rail round three sides on posts
        out.push(...box(-1.3, -0.95, 1.3, 0, z - 0.06, z, C.steelDark, I));
        for (const a of [-1.3, -0.45, 0.45, 1.3]) out.push(...post(a, -0.93, z, z + 1, I, 0.025));
        out.push(...box(-1.3, -0.95, 1.3, -0.91, z + 0.96, z + 1.02, I), ...box(-1.3, -0.95, 1.3, -0.91, z + 0.48, z + 0.52, I), ...box(-1.32, -0.95, -1.28, 0, z + 0.96, z + 1.02, I), ...box(1.28, -0.95, 1.32, 0, z + 0.96, z + 1.02, I));
        // the ladder down from it (the lowest hung short of the walk), leaning along the wall
        const z0 = k === 0 ? 2.3 : z - 3, s0 = k % 2 ? 0.9 : -0.9, s1 = k === 0 ? s0 : -s0;
        for (const dn of [-0.75, -0.35]) out.push(quad([s0 - 0.03, dn, z0], [s0 + 0.03, dn, z0], [s1 + 0.03, dn, z], [s1 - 0.03, dn, z], [0, -1, 0], I));
        for (let r = 0; r <= 8; r++) { const t = r / 8, a = s0 + (s1 - s0) * t, zz = z0 + (z - z0) * t; out.push(quad([a - 0.02, -0.75, zz], [a + 0.02, -0.75, zz], [a + 0.02, -0.35, zz + 0.03], [a - 0.02, -0.35, zz + 0.03], [0, -0.3, 0.95], I)); }
      }
      return out;
    } },
  poster: { says: 'posters pasted on the wall', size: [1.4, 0.05], tall: 2.2, wall: true, build: (R) => { const out = []; let a = -0.65; for (let k = 0; k < 3 && a < 0.4; k++) { const w = 0.38 + R() * 0.12, h = 0.5 + R() * 0.2, z = 1 + R() * 0.5; out.push(quad([a, 0, z], [a + w, 0, z], [a + w, 0, z + h], [a, 0, z + h], [0, -1, 0], C.paper[Math.floor(R() * C.paper.length)]), quad([a + 0.05, -0.004, z + h * 0.55], [a + w - 0.05, -0.004, z + h * 0.55], [a + w - 0.05, -0.004, z + h * 0.88], [a + 0.05, -0.004, z + h * 0.88], [0, -1, 0], C.goods[Math.floor(R() * C.goods.length)])); a += w + 0.04; } return out; } },
  tag: { says: 'the crew\'s mark painted on the wall: a slash and a bar in its colour', size: [1.8, 0.05], tall: 1.9, wall: true, crew: true,
    build: (R, crew) => { const h = crew ?? C.goods[0], z = 0.7 + R() * 0.3; return [quad([-0.8, 0, z], [-0.55, 0, z], [0.1, 0, z + 1], [-0.15, 0, z + 1], [0, -1, 0], h), quad([-0.2, 0, z], [0.05, 0, z], [0.7, 0, z + 1], [0.45, 0, z + 1], [0, -1, 0], h), quad([-0.85, 0, z + 0.4], [0.8, 0, z + 0.4], [0.8, 0, z + 0.56], [-0.85, 0, z + 0.56], [0, -1, 0], C.chalk)]; } },
  banner: { says: 'a banner hung flat on the wall from its bar, in the crew\'s colour, a pale band across it', size: [1, 0.05], tall: 4, wall: true, crew: true,
    build: (R, crew) => { const h = crew ?? C.canvas[Math.floor(R() * C.canvas.length)]; return [...box(-0.5, -0.03, 0.5, 0.03, 3.9, 3.96, C.iron), quad([-0.42, 0, 2.5], [0.42, 0, 2.5], [0.42, 0, 3.9], [-0.42, 0, 3.9], [0, -1, 0], h), quad([-0.42, -0.004, 3.1], [0.42, -0.004, 3.1], [0.42, -0.004, 3.4], [-0.42, -0.004, 3.4], [0, -1, 0], C.chalk), { corners: [[-0.42, 0, 2.5], [0, 0, 2.2], [0.42, 0, 2.5]], out: [0, -1, 0], hex: h }]; } },
  // ── A PLANT, A WAREHOUSE, A UTILITY (the facility) ──
  racking: { says: 'pallet racking: uprights, three beams, boxes and a pallet on its shelves', size: [2.8, 1], tall: 3.2,
    build(R) {
      const out = [];
      for (const a of [-1.35, 0, 1.35]) for (const b of [-0.42, 0.42]) out.push(...post(a, b, 0, 3.1, K.rackBlue, 0.04));
      for (const z of [0.15, 1.2, 2.2]) {
        out.push(...box(-1.38, -0.45, 1.38, -0.4, z, z + 0.1, K.rackOrange), ...box(-1.38, 0.4, 1.38, 0.45, z, z + 0.1, K.rackOrange), ...box(-1.35, -0.4, 1.35, 0.4, z + 0.08, z + 0.11, C.slat).slice(4));
        for (let x = -1.25; x < 1.1;) { const w = 0.45 + R() * 0.5, h = 0.3 + R() * 0.5; if (R() < 0.8) out.push(...box(x, -0.34, Math.min(x + w, 1.28), 0.3, z + 0.11, z + 0.11 + h, C.card[Math.floor(R() * C.card.length)])); x += w + 0.08; }
      }
      return out;
    } },
  tank: { says: 'a process tank on its legs, banded, a pipe off it to the wall', size: [1.7, 1.6], tall: 3, build: () => [...[[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].flatMap(([a, b]) => post(a, b, 0, 0.5, K.frame, 0.05)), ...drum(0, 0, 0.72, 0.45, 2.5, K.tankSteel, C.steelDark), ...drum(0, 0, 0.74, 1.1, 1.18, C.steelDark).slice(0, 8), ...drum(0, 0, 0.74, 1.9, 1.98, C.steelDark).slice(0, 8), ...drum(0, 0, 0.3, 2.5, 2.75, C.steelDark, K.frame), ...box(-0.06, 0.7, 0.06, 0.8, 1.5, 1.62, K.valve), ...box(-0.05, 0.6, 0.05, 0.8, 1.5, 1.6, C.steel).slice(0, 4), ...drum(0.5, -0.6, 0.12, 1.3, 1.34, K.valve)] },
  reel: { says: 'a cable reel stood on its flange', size: [1.2, 1.2], tall: 0.85, build: () => [...drum(0, 0, 0.56, 0, 0.07, C.wood, C.slat), ...drum(0, 0, 0.3, 0.07, 0.75, K.black, K.black), ...drum(0, 0, 0.56, 0.75, 0.82, C.wood, C.slat), ...drum(0, 0, 0.08, 0.82, 0.86, C.iron)] },
  cones: { says: 'traffic cones, one on its side', size: [1.5, 0.6], tall: 0.75, build: (R) => { const out = []; for (const a of [-0.5, 0, 0.5]) { const b = (R() - 0.5) * 0.2; out.push(...box(a - 0.17, b - 0.17, a + 0.17, b + 0.17, 0, 0.04, K.black)); for (let k = 0; k < 4; k++) { const t0 = (k * Math.PI) / 2 + Math.PI / 4, t1 = t0 + Math.PI / 2, m = t0 + Math.PI / 4, p = (t, r, z) => [a + r * Math.cos(t), b + r * Math.sin(t), z]; out.push(quad(p(t0, 0.17, 0.04), p(t1, 0.17, 0.04), p(t1, 0.1, 0.36), p(t0, 0.1, 0.36), [Math.cos(m), Math.sin(m), 0.3], K.orange), quad(p(t0, 0.1, 0.36), p(t1, 0.1, 0.36), p(t1, 0.07, 0.48), p(t0, 0.07, 0.48), [Math.cos(m), Math.sin(m), 0.3], K.white), quad(p(t0, 0.07, 0.48), p(t1, 0.07, 0.48), p(t1, 0.02, 0.7), p(t0, 0.02, 0.7), [Math.cos(m), Math.sin(m), 0.3], K.orange)); } } return out; } },
  barrier: { says: 'a concrete barrier, striped', size: [2.1, 0.6], tall: 0.9, build: () => { const out = [...box(-1, -0.28, 1, 0.28, 0, 0.3, '#9c9d9a'), ...box(-1, -0.16, 1, 0.16, 0.3, 0.85, '#a8a9a5')]; for (let k = 0; k < 6; k++) out.push(quad([-0.95 + k * 0.32, -0.165, 0.42], [-0.79 + k * 0.32, -0.165, 0.42], [-0.67 + k * 0.32, -0.165, 0.72], [-0.83 + k * 0.32, -0.165, 0.72], [0, -1, 0], k % 2 ? K.black : K.safety)); return out; } },
  forklift: { says: 'a forklift parked along the wall, its forks down', size: [2.7, 1.2], tall: 2.3, build: () => [...box(-0.2, -0.5, 1.1, 0.5, 0.25, 1, K.machineY, K.black), ...box(0.5, -0.5, 1.15, 0.5, 1, 1.25, K.black), ...box(-0.05, -0.3, 0.4, 0.3, 1, 1.2, K.frame), ...[[-0.2, -0.45], [-0.2, 0.45], [1.05, -0.45], [1.05, 0.45]].flatMap(([a, b]) => post(a, b, 1, 2.15, K.black, 0.035)), ...box(-0.25, -0.5, 1.1, 0.5, 2.15, 2.2, K.black), ...post(-0.36, -0.3, 0.1, 2.25, K.frame, 0.045), ...post(-0.36, 0.3, 0.1, 2.25, K.frame, 0.045), ...box(-0.4, -0.34, -0.32, 0.34, 0.5, 0.58, K.frame), ...box(-1.3, -0.34, -0.36, -0.22, 0.06, 0.11, C.steel), ...box(-1.3, 0.22, -0.36, 0.34, 0.06, 0.11, C.steel), ...drum(-0.02, -0.56, 0.26, 0.1, 0.2, K.black).map(tipWheel(-0.02, -0.56)), ...drum(0.85, -0.56, 0.22, 0.1, 0.2, K.black).map(tipWheel(0.85, -0.56))] },
  generator: { says: 'a generator on its skid, its grille to the room, an exhaust up', size: [1.8, 0.9], tall: 1.5, build: () => [...box(-0.85, -0.4, 0.85, 0.4, 0, 0.12, K.frame), ...box(-0.8, -0.38, 0.8, 0.38, 0.12, 1.05, K.machine, '#35583e'), ...box(-0.7, -0.385, 0.1, -0.38, 0.3, 0.9, K.black).slice(0, 1), ...box(0.25, -0.385, 0.7, -0.38, 0.55, 0.9, K.safety).slice(0, 1), ...post(0.55, 0.1, 1.05, 1.45, C.iron, 0.05), ...drum(-0.4, 0, 0.14, 1.05, 1.12, K.black)] },
  lockers: { says: 'a row of steel lockers', size: [1.7, 0.5], tall: 1.9, build: (R) => { const out = [], h = K.locker[Math.floor(R() * K.locker.length)]; for (let k = 0; k < 4; k++) { const a = -0.8 + k * 0.4; out.push(...box(a, -0.22, a + 0.39, 0.22, 0.08, 1.88, h), ...box(a + 0.08, -0.225, a + 0.31, -0.22, 1.55, 1.72, C.steelDark).slice(0, 1), ...box(a + 0.3, -0.24, a + 0.34, -0.22, 0.95, 1.05, C.iron).slice(0, 1)); } return out; } },
  // ── A BASE (military) ──
  sandbags: { says: 'sandbags laid in courses, breast high', size: [2.3, 0.7], tall: 1.05, build: (R) => { const out = []; for (let row = 0; row < 5; row++) { const off = row % 2 ? 0.22 : 0, z = row * 0.2; for (let a = -1.1 + off; a < 1.05 - (row === 4 ? 0.4 : 0); a += 0.46) out.push(...box(a, -0.26 + (R() - 0.5) * 0.04, Math.min(a + 0.44, 1.1), 0.26, z, z + 0.19, R() < 0.5 ? K.khaki : K.khakiDark)); } return out; } },
  ammo: { says: 'footlockers and steel crates stacked (skandart\'s vessels, the industrial look)', size: [2.4, 1.1], tall: 1.3, build: (R) => vessels({ chest: 3, crate: 3 }, 'industrial', 0.15, 2.4, R) },
  jerry: { says: 'jerry cans in a row', size: [1.3, 0.4], tall: 0.55, build: (R) => { const out = []; for (let k = 0; k < 4; k++) { if (R() < 0.15) continue; const a = -0.58 + k * 0.3; out.push(...box(a, -0.09, a + 0.26, 0.09, 0, 0.44, k === 3 ? '#8a2f22' : K.olive), ...box(a + 0.04, -0.03, a + 0.1, 0.03, 0.44, 0.5, K.black), ...box(a + 0.1, -0.02, a + 0.24, 0.02, 0.44, 0.49, K.olive).slice(0, 4)); } return out; } },
  radio: { says: 'a field table with a radio set on it, its mast up', size: [1.6, 0.8], tall: 3, build: () => [...box(-0.75, -0.35, 0.75, 0.35, 0.72, 0.76, K.olive), ...[[-0.7, -0.3], [0.7, -0.3], [-0.7, 0.3], [0.7, 0.3]].flatMap(([a, b]) => post(a, b, 0, 0.72, K.frame, 0.025)), ...box(-0.5, -0.1, 0.05, 0.25, 0.76, 1.1, K.olive, '#3a4128'), ...box(-0.44, -0.105, -0.2, -0.1, 0.84, 1.02, K.black).slice(0, 1), ...box(-0.14, -0.105, -0.02, -0.1, 0.9, 0.96, K.lamp).slice(0, 1), ...post(0.55, 0.2, 0.76, 2.95, K.frame, 0.012), ...box(0.2, -0.25, 0.6, 0.05, 0.76, 0.79, K.mapPaper).slice(4)] },
  floodlight: { says: 'a floodlight on its tripod', size: [1, 1], tall: 3.3, build: () => [...post(0, 0, 0.3, 3, K.frame, 0.03), quad([-0.4, -0.3, 0], [-0.36, -0.3, 0], [0.02, 0, 0.9], [-0.02, 0, 0.9], [0, -1, 0.2], K.frame), quad([0.36, -0.3, 0], [0.4, -0.3, 0], [0.02, 0, 0.9], [-0.02, 0, 0.9], [0, -1, 0.2], K.frame), quad([-0.02, 0.4, 0], [0.02, 0.4, 0], [0.02, 0, 0.9], [-0.02, 0, 0.9], [1, 0, 0.2], K.frame), ...box(-0.3, -0.12, 0.3, 0.06, 2.95, 3.25, K.black), quad([-0.27, -0.125, 2.98], [0.27, -0.125, 2.98], [0.27, -0.125, 3.22], [-0.27, -0.125, 3.22], [0, -1, 0], K.lamp)] },
  // ── AN OFFICE ──
  desk: { says: 'a desk with its screen and its chair', size: [1.6, 1.45], tall: 1.25, build: (R) => { const f = K.fabric[Math.floor(R() * K.fabric.length)]; return [...box(-0.75, 0, 0.75, 0.7, 0.72, 0.76, K.desk), ...box(-0.75, 0.02, -0.71, 0.68, 0, 0.72, K.deskDark), ...box(0.71, 0.02, 0.75, 0.68, 0, 0.72, K.deskDark), ...box(-0.71, 0.62, 0.71, 0.66, 0.2, 0.72, K.deskDark), ...box(0.2, 0.05, 0.7, 0.6, 0.08, 0.66, K.plasticDark), ...box(-0.3, 0.4, 0.3, 0.44, 0.84, 1.2, K.black), quad([-0.27, 0.398, 0.87], [0.27, 0.398, 0.87], [0.27, 0.398, 1.17], [-0.27, 0.398, 1.17], [0, -1, 0], K.screen), ...post(0, 0.44, 0.76, 0.86, K.black, 0.03), ...box(-0.22, 0.14, 0.22, 0.28, 0.76, 0.78, K.plasticDark), ...box(-0.25, -0.62, 0.25, -0.16, 0.44, 0.5, f), ...box(-0.25, -0.68, 0.25, -0.62, 0.5, 0.98, f), ...post(0, -0.4, 0.06, 0.44, K.black, 0.03), ...drum(0, -0.4, 0.26, 0, 0.06, K.black)]; } },
  cabinet: { says: 'filing cabinets, a box on one', size: [1.5, 0.65], tall: 1.6, build: (R) => { const out = []; for (let k = 0; k < 3; k++) { const a = -0.72 + k * 0.48, h = k === 1 ? 1 : 1.32; out.push(...box(a, -0.3, a + 0.46, 0.3, 0, h, K.plasticDark, K.plastic)); for (let z = 0.06; z + 0.28 < h; z += 0.31) out.push(...box(a + 0.03, -0.305, a + 0.43, -0.3, z, z + 0.28, K.plastic).slice(0, 1), ...box(a + 0.17, -0.32, a + 0.29, -0.305, z + 0.18, z + 0.21, K.frame).slice(0, 1)); } if (R() < 0.7) out.push(...box(-0.2, -0.2, 0.18, 0.18, 1, 1.26, C.card[0])); return out; } },
  cooler: { says: 'a water cooler', size: [0.5, 0.5], tall: 1.5, build: () => [...box(-0.18, -0.18, 0.18, 0.18, 0, 1, K.plastic), ...box(-0.1, -0.185, 0.1, -0.18, 0.62, 0.8, K.plasticDark).slice(0, 1), ...drum(0, 0, 0.15, 1, 1.42, K.water, K.water)] },
  copier: { says: 'a copier, paper beside it', size: [1.1, 0.75], tall: 1.2, build: () => [...box(-0.5, -0.33, 0.4, 0.33, 0, 0.95, K.plastic, K.plasticDark), ...box(-0.5, -0.33, 0.4, 0.33, 0.95, 1.08, K.plasticDark), ...box(-0.4, -0.335, 0.3, -0.33, 0.2, 0.42, K.plasticDark).slice(0, 1), ...box(0.1, -0.34, 0.36, -0.33, 0.82, 0.92, K.black).slice(0, 1), ...box(0.42, -0.2, 0.52, 0.2, 0, 0.3, K.board)] },
  sofa: { says: 'a sofa', size: [2, 0.9], tall: 0.85, build: (R) => { const f = K.fabric[Math.floor(R() * K.fabric.length)]; return [...box(-0.95, -0.4, 0.95, 0.4, 0.12, 0.44, f), ...box(-0.95, 0.2, 0.95, 0.42, 0.44, 0.84, f), ...box(-0.98, -0.42, -0.8, 0.42, 0.12, 0.62, f), ...box(0.8, -0.42, 0.98, 0.42, 0.12, 0.62, f), ...[[-0.9, -0.36], [0.9, -0.36], [-0.9, 0.36], [0.9, 0.36]].flatMap(([a, b]) => post(a, b, 0, 0.12, K.black, 0.03))]; } },
  partition: { says: 'a cubicle screen with a low cabinet at its foot', size: [1.9, 0.6], tall: 1.5, build: (R) => { const f = K.fabric[Math.floor(R() * K.fabric.length)]; return [...box(-0.92, 0.2, 0.92, 0.26, 0.05, 1.48, f), ...box(-0.94, 0.19, 0.94, 0.27, 1.44, 1.5, K.frame), ...post(-0.93, 0.23, 0, 1.5, K.frame, 0.03), ...post(0.93, 0.23, 0, 1.5, K.frame, 0.03), ...box(-0.5, -0.25, 0.3, 0.18, 0, 0.62, K.plasticDark, K.desk)]; } },
  reception: { says: 'a reception counter, its top over a panelled front', size: [2.7, 0.8], tall: 1.15, build: () => [...box(-1.3, -0.3, 1.3, 0.3, 0, 1.05, K.deskDark), ...box(-1.34, -0.36, 1.34, 0.34, 1.05, 1.12, K.desk), ...box(-1.2, -0.305, -0.1, -0.3, 0.12, 0.92, K.desk).slice(0, 1), ...box(0.1, -0.305, 1.2, -0.3, 0.12, 0.92, K.desk).slice(0, 1), ...box(-0.2, 0.05, 0.2, 0.09, 1.12, 1.42, K.black), quad([-0.17, 0.048, 1.15], [0.17, 0.048, 1.15], [0.17, 0.048, 1.39], [-0.17, 0.048, 1.39], [0, -1, 0], K.screen)] },
  // (on the wall, the interiors')
  pipes: { says: 'a run of pipes along the wall on brackets, a valve wheel on one, a drop to the floor', size: [3.3, 0.35], tall: 3.2, wall: true, build: () => [...box(-1.6, -0.22, 1.6, -0.08, 2.5, 2.64, C.steel), ...box(-1.6, -0.22, 1.6, -0.1, 2.82, 2.94, '#b8862e'), ...[-1.2, 0, 1.2].flatMap((a) => box(a - 0.03, -0.24, a + 0.03, 0, 2.44, 3, K.frame).slice(0, 4)), ...box(0.9, -0.22, 1.04, -0.08, 0.05, 2.5, C.steel).slice(0, 4), { corners: Array.from({ length: 8 }, (_, k) => [-0.5 + 0.2 * Math.cos((k * Math.PI) / 4), -0.26, 2.57 + 0.2 * Math.sin((k * Math.PI) / 4)]), out: [0, -1, 0], hex: K.valve }] },
  panel: { says: 'an electrical cabinet on the wall, its warning mark, its conduit up', size: [1, 0.3], tall: 4.5, wall: true, build: () => [...box(-0.45, -0.24, 0.45, 0, 0.7, 2, '#8f959c', C.steelDark), ...box(-0.01, -0.245, 0.01, -0.24, 0.75, 1.95, C.steelDark).slice(0, 1), { corners: [[-0.33, -0.245, 1.45], [-0.09, -0.245, 1.45], [-0.21, -0.245, 1.68]], out: [0, -1, 0], hex: K.safety }, ...box(0.2, -0.26, 0.28, -0.24, 1.2, 1.36, K.black).slice(0, 1), ...box(-0.05, -0.1, 0.05, 0, 2, 4.4, C.steelDark).slice(0, 4)] },
  hazard: { says: 'a hazard board on the wall: black on yellow, striped', size: [1.4, 0.05], tall: 2.6, wall: true, build: () => { const out = [quad([-0.65, 0, 1.5], [0.65, 0, 1.5], [0.65, 0, 2.4], [-0.65, 0, 2.4], [0, -1, 0], K.safety)]; for (let k = 0; k < 4; k++) out.push(quad([-0.6 + k * 0.32, -0.004, 1.5], [-0.44 + k * 0.32, -0.004, 1.5], [-0.3 + k * 0.32, -0.004, 1.74], [-0.46 + k * 0.32, -0.004, 1.74], [0, -1, 0], K.black)); out.push({ corners: [[-0.22, -0.004, 1.86], [0.22, -0.004, 1.86], [0, -0.004, 2.3]], out: [0, -1, 0], hex: K.black }); return out; } },
  extinguisher: { says: 'a fire extinguisher on its bracket, its sign over it', size: [0.5, 0.25], tall: 2.2, wall: true, build: () => [...drum(0, -0.12, 0.09, 0.85, 1.35, K.valve, K.black), ...drum(0, -0.12, 0.04, 1.35, 1.45, K.black), quad([-0.16, 0, 1.75], [0.16, 0, 1.75], [0.16, 0, 2.07], [-0.16, 0, 2.07], [0, -1, 0], K.valve), quad([-0.08, -0.004, 1.83], [0.08, -0.004, 1.83], [0.08, -0.004, 1.99], [-0.08, -0.004, 1.99], [0, -1, 0], K.white)] },
  duct: { says: 'a duct along the wall overhead, jointed, a grille in it', size: [3.6, 0.6], tall: 4.2, wall: true, build: () => { const out = [...box(-1.75, -0.55, 1.75, 0, 3.4, 3.95, C.steel, C.steelDark)]; for (const a of [-0.9, 0, 0.9]) out.push(...box(a - 0.03, -0.57, a + 0.03, 0, 3.38, 3.97, C.steelDark).slice(0, 5)); out.push(quad([-0.5, -0.555, 3.5], [-0.05, -0.555, 3.5], [-0.05, -0.555, 3.85], [-0.5, -0.555, 3.85], [0, -1, 0], K.black)); return out; } },
  stencil: { says: 'a unit\'s marking stencilled on the wall: its number in blocks over a bar', size: [2, 0.05], tall: 2.1, wall: true, crew: true, build: (R, crew) => { const out = [], h = K.white; let a = -0.9; for (let k = 0; k < 3; k++) { const kind = Math.floor(R() * 3); out.push(quad([a, 0, 1.25], [a + 0.12, 0, 1.25], [a + 0.12, 0, 1.95], [a, 0, 1.95], [0, -1, 0], h)); if (kind > 0) out.push(quad([a + 0.3, 0, 1.25], [a + 0.42, 0, 1.25], [a + 0.42, 0, 1.95], [a + 0.3, 0, 1.95], [0, -1, 0], h), quad([a, 0, 1.83], [a + 0.42, 0, 1.83], [a + 0.42, 0, 1.95], [a, 0, 1.95], [0, -1, 0], h)); if (kind > 1) out.push(quad([a, 0, 1.25], [a + 0.42, 0, 1.25], [a + 0.42, 0, 1.37], [a, 0, 1.37], [0, -1, 0], h)); a += 0.62; } out.push(quad([-0.95, 0, 1.02], [0.95, 0, 1.02], [0.95, 0, 1.14], [-0.95, 0, 1.14], [0, -1, 0], crew ?? K.safety)); return out; } },
  mapboard: { says: 'a map board on the wall: the ground in patches, routes and pins on it', size: [2, 0.06], tall: 2.5, wall: true, crew: true, build: (R, crew) => { const out = [...box(-0.95, -0.04, 0.95, 0, 1.1, 2.4, K.frame).slice(0, 1), quad([-0.9, -0.045, 1.15], [0.9, -0.045, 1.15], [0.9, -0.045, 2.35], [-0.9, -0.045, 2.35], [0, -1, 0], K.mapPaper)]; for (let k = 0; k < 5; k++) { const a = -0.8 + R() * 1.3, z = 1.25 + R() * 0.8, w = 0.2 + R() * 0.3; out.push(quad([a, -0.05, z], [a + w, -0.05, z + 0.05], [a + w - 0.06, -0.05, z + w * 0.8], [a - 0.04, -0.05, z + w * 0.6], [0, -1, 0], k % 2 ? '#9db58a' : '#b9c7cf')); } out.push(quad([-0.7, -0.054, 1.3], [-0.66, -0.054, 1.3], [0.6, -0.054, 2.2], [0.56, -0.054, 2.2], [0, -1, 0], crew ?? K.valve)); return out; } },
  rack: { says: 'a rack of long guns on the wall', size: [1.6, 0.2], tall: 2.2, wall: true, build: () => { const out = [...box(-0.75, -0.06, 0.75, 0, 0.9, 1, K.deskDark), ...box(-0.75, -0.06, 0.75, 0, 1.7, 1.78, K.deskDark)]; for (let k = 0; k < 5; k++) { const a = -0.6 + k * 0.3; out.push(quad([a - 0.03, -0.08, 0.7], [a + 0.03, -0.08, 0.7], [a + 0.03, -0.08, 2], [a - 0.03, -0.08, 2], [0, -1, 0], K.gun), quad([a - 0.06, -0.085, 0.7], [a + 0.06, -0.085, 0.7], [a + 0.05, -0.085, 1.1], [a - 0.05, -0.085, 1.1], [0, -1, 0], C.wood)); } return out; } },
  camo: { says: 'a camouflage net hung on the wall', size: [3, 0.1], tall: 2.9, wall: true, build: (R) => { const out = []; for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { if (R() < 0.12) continue; const a = -1.45 + i * 0.48 + (R() - 0.5) * 0.1, z = 0.9 + j * 0.48 + (R() - 0.5) * 0.1; out.push(quad([a, 0, z], [a + 0.5, 0, z + (R() - 0.5) * 0.1], [a + 0.46, 0, z + 0.5], [a + 0.03, 0, z + 0.46], [0, -1, 0], K.camo[Math.floor(R() * K.camo.length)])); } return out; } },
  whiteboard: { says: 'a whiteboard, written on', size: [2.3, 0.06], tall: 2.5, wall: true, build: (R) => { const out = [...box(-1.12, -0.04, 1.12, 0, 1, 2.3, K.frame).slice(0, 1), quad([-1.08, -0.045, 1.04], [1.08, -0.045, 1.04], [1.08, -0.045, 2.26], [-1.08, -0.045, 2.26], [0, -1, 0], K.board)]; for (let k = 0; k < 6; k++) { const a = -0.95 + R() * 1.3, z = 1.2 + k * 0.16; out.push(quad([a, -0.05, z], [a + 0.3 + R() * 0.5, -0.05, z], [a + 0.3 + R() * 0.5, -0.05, z + 0.04], [a, -0.05, z + 0.04], [0, -1, 0], K.art[k % 3])); } return out; } },
  clock: { says: 'a wall clock', size: [0.6, 0.06], tall: 2.9, wall: true, build: () => [{ corners: Array.from({ length: 8 }, (_, k) => [0.24 * Math.cos((k * Math.PI) / 4 + Math.PI / 8), -0.03, 2.5 + 0.24 * Math.sin((k * Math.PI) / 4 + Math.PI / 8)]), out: [0, -1, 0], hex: K.frame }, { corners: Array.from({ length: 8 }, (_, k) => [0.2 * Math.cos((k * Math.PI) / 4 + Math.PI / 8), -0.035, 2.5 + 0.2 * Math.sin((k * Math.PI) / 4 + Math.PI / 8)]), out: [0, -1, 0], hex: K.board }, quad([-0.012, -0.04, 2.5], [0.012, -0.04, 2.5], [0.012, -0.04, 2.66], [-0.012, -0.04, 2.66], [0, -1, 0], K.black), quad([0, -0.04, 2.49], [0.11, -0.04, 2.42], [0.12, -0.04, 2.44], [0, -0.04, 2.51], [0, -1, 0], K.black)] },
  picture: { says: 'framed pictures', size: [1.9, 0.06], tall: 2.3, wall: true, build: (R) => { const out = []; for (const a of [-0.9, 0.1]) { const w = 0.7 + R() * 0.15, z = 1.4 + R() * 0.15, h = 0.5 + R() * 0.2; out.push(quad([a, -0.03, z], [a + w, -0.03, z], [a + w, -0.03, z + h], [a, -0.03, z + h], [0, -1, 0], K.frame), quad([a + 0.05, -0.035, z + 0.05], [a + w - 0.05, -0.035, z + 0.05], [a + w - 0.05, -0.035, z + h - 0.05], [a + 0.05, -0.035, z + h - 0.05], [0, -1, 0], K.board), quad([a + 0.12, -0.04, z + 0.12], [a + w - 0.12, -0.04, z + 0.12], [a + w - 0.2, -0.04, z + h - 0.12], [a + 0.18, -0.04, z + h - 0.14], [0, -1, 0], K.art[Math.floor(R() * K.art.length)])); } return out; } },
  glazing: { says: 'an inner window, its blind half down', size: [2.5, 0.06], tall: 2.6, wall: true, build: (R) => { const out = [...box(-1.22, -0.05, 1.22, 0, 0.95, 2.45, K.frame).slice(0, 1), quad([-1.16, -0.055, 1.01], [1.16, -0.055, 1.01], [1.16, -0.055, 2.39], [-1.16, -0.055, 2.39], [0, -1, 0], K.glass), quad([-0.02, -0.06, 1.01], [0.02, -0.06, 1.01], [0.02, -0.06, 2.39], [-0.02, -0.06, 2.39], [0, -1, 0], K.frame)]; const low = 1.5 + R() * 0.5; for (let z = 2.36; z > low; z -= 0.09) out.push(quad([-1.15, -0.062, z - 0.06], [1.15, -0.062, z - 0.06], [1.15, -0.062, z], [-1.15, -0.062, z], [0, -1, 0], K.blind)); return out; } },
  exit: { says: 'a lit exit sign', size: [0.8, 0.1], tall: 3, wall: true, build: () => [...box(-0.3, -0.08, 0.3, 0, 2.6, 2.82, K.exit), quad([-0.2, -0.085, 2.67], [0.05, -0.085, 2.67], [0.05, -0.085, 2.75], [-0.2, -0.085, 2.75], [0, -1, 0], K.white), { corners: [[0.08, -0.085, 2.64], [0.22, -0.085, 2.71], [0.08, -0.085, 2.78]], out: [0, -1, 0], hex: K.white }] },
});
function shift(f, ds, dn) { return { ...f, corners: f.corners.map(([s, n, z]) => [s + ds, n + dn, z]) }; }
// (a drum laid on its side as a wheel: its axis turned from z to n, about its own middle)
function tipWheel(s0, n0) { return (f) => ({ ...f, corners: f.corners.map(([s, n, z]) => [s, n0 + (z - 0.16), 0.28 + (n - n0)]), out: [f.out[0], f.out[2], f.out[1]] }); }
export const DRESS_PIECE_IDS = Object.freeze(Object.keys(DRESS_PIECES));

// ── the sets: a screen's theme ──
// (`marks`: the stride of its wall's marks, m)
const set = (says, far, gap, wall, near, marks = [4.5, 9.5]) => Object.freeze({ says, far: Object.freeze(far), gap: Object.freeze(gap), wall: Object.freeze(wall), near: Object.freeze(near), marks: Object.freeze(marks) });
export const DRESS_SETS = Object.freeze({
  market: set('a street market: stalls under their canopies, crates, barrels and sacks between them, a hand cart, its boxes and rubbish dumped beside it', { rubble: 1, stall: 5, crates: 2, crate: 1, barrels: 2, sacks: 2, cart: 1, boxes: 2, bags: 1, litter: 2 }, [0.5, 1.6], { poster: 3, aircon: 1, neon: 1, pipe: 1 }, { crate: 2, barrel: 2, sacks: 1 }, [4, 8]),
  strip: set('a shuttered strip: steel shutters down and sprayed, a vending machine, rubbish bags and cardboard on the walk, blade signs lit, a fire escape overhead', { rubble: 3, shards: 3, drums: 1, bags: 3, boxes: 3, vending: 2, litter: 3, paperbox: 1, tyres: 1, crate: 1 }, [0.8, 2.6], { shutter: 4, neon: 2, aircon: 2, poster: 2, tag: 1, escape: 2, pipe: 1, boards: 1 }, { bollard: 2, tyres: 1 }, [2.5, 5]),
  cafe: set('a cafe terrace: tables under parasols, planters, a sandwich board, a bench', { cafe: 5, planter: 3, pot: 2, board: 2, bench: 1, paperbox: 1 }, [0.7, 2], { poster: 1, banner: 1 }, { pot: 2, planter: 1, bollard: 2 }),
  yard: set('a back street\'s load-in: pallets and stacked crates, a skip, tyres, barrels, rubbish, a fire in a drum', { drums: 4, rubble: 3, wreckage: 2, shards: 1, pallet: 3, crates: 3, skip: 1, tyres: 2, barrels: 2, crate: 1, cart: 1, bags: 2, boxes: 1, drumfire: 1, litter: 2 }, [0.8, 2.4], { poster: 2, tag: 2, piece: 2, escape: 2, pipe: 2, aircon: 1, boards: 1, shutter: 1 }, { tyres: 1, crate: 1, bollard: 2 }, [3, 6]),
  turf: set('the crew\'s own corner: its pieces and its marks on every wall, its banners out, fires in drums, tyres, barrels and crates where it sits', { drums: 3, rubble: 3, wreckage: 2, shards: 2, tyres: 3, barrels: 2, crates: 2, drumfire: 3, bags: 2, bench: 1, crate: 1, litter: 2 }, [1, 2.6], { tag: 3, piece: 3, banner: 2, shutter: 2, poster: 1, escape: 1, boards: 1 }, { tyres: 1, barrel: 1, bollard: 1 }, [2.5, 5]),
  plain: set('a quiet stretch: a bench, a paper box, a planter, a little rubbish, far apart', { rubble: 2, shards: 1, planter: 1, bench: 2, paperbox: 1, pot: 1, board: 1, bags: 1, litter: 2 }, [3, 6], { poster: 2, pipe: 1, aircon: 1 }, { bollard: 1 }),
  // ── the facility ──
  dock: set('a loading dock: pallets, a forklift, drums, barriers and cones, a roll-up door down', { pallet: 4, forklift: 2, drums: 2, barrier: 2, cones: 2, boxes: 2, bags: 1, lockers: 1 }, [0.6, 2], { shutter: 2, hazard: 2, panel: 1, extinguisher: 1, poster: 1 }, { cones: 1, bollard: 2 }, [3, 6]),
  store: set('a store of racking: boxes on its shelves, pallets and drums at its foot, a forklift, cones', { racking: 6, pallet: 3, drums: 2, forklift: 1, cones: 2, boxes: 2 }, [0.4, 1.4], { hazard: 2, extinguisher: 2, duct: 1, panel: 1, pipes: 1 }, { cones: 1 }, [4, 7]),
  plant: set('a process hall: tanks on their legs, cable reels, drums, a generator, pipes and cabinets on every wall', { tank: 4, reel: 2, drums: 3, generator: 2, barrier: 1, cones: 1, rubble: 1 }, [0.5, 1.8], { pipes: 4, panel: 2, hazard: 2, duct: 2, extinguisher: 1 }, { cones: 1 }, [2.5, 5]),
  core: set('the plant\'s heart, held: tanks and generators behind barriers, wreckage, the crew\'s marks over the cabinets', { tank: 3, generator: 2, drums: 2, barrier: 3, wreckage: 2, reel: 1, drumfire: 1 }, [0.5, 1.6], { pipes: 3, panel: 3, tag: 2, banner: 1, duct: 1, hazard: 1 }, { cones: 1 }, [2.5, 4.5]),
  // ── the base ──
  gate: set('a gate\'s approach: sandbags, barriers, a floodlight, cones', { sandbags: 4, barrier: 3, floodlight: 1, cones: 2, drums: 1, jerry: 1 }, [0.8, 2.4], { stencil: 2, hazard: 2, extinguisher: 1 }, { cones: 1 }, [4, 7]),
  depot: set('a supply depot: footlockers and steel crates stacked, drums, jerry cans, sandbags', { ammo: 5, drums: 3, jerry: 3, sandbags: 2, pallet: 2, lockers: 1 }, [0.4, 1.6], { stencil: 3, rack: 1, hazard: 1, extinguisher: 1, camo: 1 }, { cones: 1 }, [3, 6]),
  motor: set('a motor pool\'s edge: tyres, drums, a generator, barriers, jerry cans, a floodlight', { tyres: 3, drums: 3, generator: 2, barrier: 2, jerry: 2, cones: 1, floodlight: 1, reel: 1 }, [0.6, 2], { stencil: 2, panel: 1, pipes: 1, camo: 1, hazard: 1 }, { tyres: 1 }, [3, 6]),
  post: set('the command post, held: a radio table, sandbags, footlockers, a map board, the guns racked, its colours hung', { radio: 3, sandbags: 3, ammo: 2, floodlight: 1, lockers: 1, jerry: 1 }, [0.5, 1.6], { mapboard: 3, banner: 2, rack: 2, stencil: 1, camo: 2 }, { cones: 1 }, [2.5, 4.5]),
  // ── the office ──
  lobby: set('a lobby: a reception counter, sofas, plants, a water cooler, pictures', { reception: 2, sofa: 3, pot: 3, cooler: 1, planter: 1 }, [0.8, 2.2], { picture: 3, clock: 1, exit: 1, glazing: 1 }, { pot: 1 }, [3, 6]),
  floor: set('an open floor: desks and their chairs, cubicle screens, filing cabinets, a copier, plants', { desk: 6, partition: 3, cabinet: 3, copier: 1, pot: 1, boxes: 1 }, [0.4, 1.3], { glazing: 3, whiteboard: 2, poster: 2, clock: 1, exit: 1 }, { pot: 1 }, [3, 5.5]),
  breakroom: set('a break room: vending machines, a water cooler, sofas, a cabinet, the bin full', { vending: 3, cooler: 2, sofa: 2, pot: 1, bags: 1, cabinet: 1 }, [0.6, 1.8], { poster: 3, clock: 1, picture: 1, exit: 1 }, { pot: 1 }, [3, 6]),
  suite: set('the corner suite, held: a desk or two, sofas, cabinets turned out, papers and glass on the floor, the crew\'s mark on its wall', { desk: 2, sofa: 2, cabinet: 2, pot: 2, reception: 1, shards: 2, boxes: 1 }, [0.6, 1.8], { picture: 2, whiteboard: 2, glazing: 2, banner: 1, tag: 2 }, { pot: 1 }, [2.5, 5]),
});
export const DRESS_SET_IDS = Object.freeze(Object.keys(DRESS_SETS));
/**
 * THE SETTINGS: the kind of place a map is, each a row: the sets that belong to it, the TURN it takes when a map says
 * none (the way in, the held screens in turn, a walk between them, the boss's), what stands in its band to be broken
 * (brawl-things.js THINGS.box), and the stage kits it is the dress of (brawl-levels.js). A new kind of place is a row,
 * its sets rows above; an agent's own set is said in a map's `sets` (readDress).
 */
const setting = (says, o) => Object.freeze({ says, ...o, sets: Object.freeze(o.sets), turn: Object.freeze({ ...o.turn, held: Object.freeze(o.turn.held) }), boxes: Object.freeze(o.boxes), kits: Object.freeze(o.kits ?? []) });
export const DRESS_SETTINGS = Object.freeze({
  street: setting('a city street gone rough: shops shuttered, a market, a load-in, the crew\'s corner', { sets: ['strip', 'market', 'yard', 'turf', 'plain', 'cafe'], turn: { way: 'strip', held: ['market', 'strip', 'yard'], between: 'plain', boss: 'turf' }, boxes: ['barrel', 'crate', 'drum'] }),
  facility: setting('a plant, a warehouse, a utility: a dock, racking, a process hall, its heart', { sets: ['dock', 'store', 'plant', 'core'], turn: { way: 'dock', held: ['store', 'plant', 'dock'], between: 'store', boss: 'core' }, boxes: ['drum', 'crate', 'drum'], kits: ['bay-utility', 'bay-science', 'research-lab'] }),
  base: setting('a military base: its gate, a depot, a motor pool, the command post', { sets: ['gate', 'depot', 'motor', 'post'], turn: { way: 'gate', held: ['depot', 'motor'], between: 'depot', boss: 'post' }, boxes: ['drum', 'crate', 'drum'], kits: ['bay-military'] }),
  office: setting('an office building: a lobby, open floors, a break room, the corner suite', { sets: ['lobby', 'floor', 'breakroom', 'suite'], turn: { way: 'lobby', held: ['floor', 'breakroom'], between: 'floor', boss: 'suite' }, boxes: ['crate', 'drum'], kits: ['bay-everyday'] }),
});
export const DRESS_SETTING_IDS = Object.freeze(Object.keys(DRESS_SETTINGS));
/** The setting a stage kit is dressed as when its level says none (null: a kit with no setting of its own). */
export const settingOfKit = (kit) => DRESS_SETTING_IDS.find((id) => DRESS_SETTINGS[id].kits.includes(kit)) ?? null;
/** The set a screen takes when none is said, by its place, in a setting's turn. */
export function dressSets(belt, settingId = 'street') {
  const T = DRESS_SETTINGS[settingId].turn;
  let k = 0;
  return belt.screens.map((sc) => (sc.boss ? T.boss : sc.gate ? T.held[k++ % T.held.length] : k ? T.between : T.way));
}
// AN AGENT'S OWN SET, said in a map's `sets` in a name's place: { says?, far: { piece: weight }, wall?: { piece: weight },
// gap?: [lo, hi], marks?: [lo, hi], near?: { piece: weight } }: the same shape a row has, read against the pieces
const OWN_KEYS = ['says', 'far', 'wall', 'gap', 'marks', 'near'];
function readOwnSet(o, where) {
  for (const k of Object.keys(o)) if (!OWN_KEYS.includes(k)) throw new Error(`brawl: ${where}.${k} is not a set's word (${OWN_KEYS.join(', ')})`);
  const table = (v, name, wall) => {
    if (v === undefined) return {};
    if (!isObj(v) || (name === 'far' && !Object.keys(v).length)) throw new Error(`brawl: ${where}.${name} is { piece: weight }`);
    for (const [id, w] of Object.entries(v)) {
      if (!DRESS_PIECES[id]) throw new Error(`brawl: ${where}.${name}.${id} is no piece (${DRESS_PIECE_IDS.join(', ')})`);
      if (!!DRESS_PIECES[id].wall !== wall) throw new Error(`brawl: ${where}.${name}.${id} is ${DRESS_PIECES[id].wall ? 'a wall\'s mark: it goes in `wall`' : 'a thing on the floor: it goes in `far` or `near`'}`);
      if (!(typeof w === 'number' && w > 0 && w <= 20)) throw new Error(`brawl: ${where}.${name}.${id} is its weight, over 0 to 20`);
    }
    return { ...v };
  };
  const span = (v, name, d) => { if (v === undefined) return d; if (!(Array.isArray(v) && v.length === 2 && v.every(Number.isFinite) && v[0] >= 0.2 && v[1] >= v[0] && v[1] <= 30)) throw new Error(`brawl: ${where}.${name} is [least, most] m, 0.2 to 30`); return [...v]; };
  if (o.far === undefined) throw new Error(`brawl: ${where} is a set's name (${DRESS_SET_IDS.join(', ')}), null, or a set of its own { far: { piece: weight }, wall?, gap?, marks?, near? }`);
  const near = table(o.near, 'near', false);
  for (const id of Object.keys(near)) if (DRESS_PIECES[id].tall > NEAR_TALL) throw new Error(`brawl: ${where}.near.${id} stands ${DRESS_PIECES[id].tall} m: the near side is between the camera and the fight, nothing on it over ${NEAR_TALL} m`);
  return { says: typeof o.says === 'string' ? o.says : 'a set of its own', far: table(o.far, 'far', false), wall: table(o.wall, 'wall', true), near, gap: span(o.gap, 'gap', [0.6, 2]), marks: span(o.marks, 'marks', [3, 6]) };
}
/** A set by what a map says of it: a row's name, or its own. */
const setOf = (v) => (typeof v === 'string' ? DRESS_SETS[v] : v);
const setName = (v, i) => (typeof v === 'string' ? v : `own-${i + 1}`);
// how tall a thing on the near side may stand (m): a body's waist
const NEAR_TALL = 1.1;

// how far a wall's mark stands off the fronts' line (m): past a shopfront's shutters, sills and plinth
const PROUD = 0.16;
const KEYS = ['seed', 'sets', 'setting', 'colour', 'far', 'near', 'wall', 'fronts', 'follows'];
const strip = (v, where) => { if (!(Array.isArray(v) && v.length === 2 && v.every(Number.isFinite) && Math.abs(v[1] - v[0]) >= 0.6)) throw new Error(`brawl: ${where} is a strip across the belt [n0, n1] m, at least 0.6 m deep`); return [Math.min(...v), Math.max(...v)]; };
/** A dress, settled against its belt. `far` is the strip between the band's far edge and the fronts ([n0, n1]), `wall`
 * the fronts' line (the far strip's far edge unless said), `near` the strip between the camera and the band (optional:
 * none, no near dress). */
export function readDress(dress, belt, where = 'dress') {
  if (!isObj(dress)) throw new Error(`brawl: ${where} is { far: [n0, n1], near?, wall?, sets?, colour?, seed? }`);
  for (const k of Object.keys(dress)) if (!KEYS.includes(k)) throw new Error(`brawl: ${where}.${k} is not a dress's word (${KEYS.join(', ')})`);
  const far = strip(dress.far, `${where}.far`), near = dress.near !== undefined ? strip(dress.near, `${where}.near`) : null;
  if (far[0] < belt.depth[1] - 1e-6) throw new Error(`brawl: ${where}.far starts past the band's far edge (${belt.depth[1]} m): the dress stands outside the band`);
  if (near && near[1] > belt.depth[0] + 1e-6) throw new Error(`brawl: ${where}.near ends before the band's near edge (${belt.depth[0]} m): the dress stands outside the band`);
  if (dress.wall !== undefined && !(Number.isFinite(dress.wall) && dress.wall >= far[0])) throw new Error(`brawl: ${where}.wall is the fronts' line across the belt (m), at or past the far strip's start`);
  if (dress.seed !== undefined && !Number.isInteger(dress.seed)) throw new Error(`brawl: ${where}.seed is a whole number`);
  if (dress.colour !== undefined && !HEX.test(dress.colour)) throw new Error(`brawl: ${where}.colour is the crew's colour, #rrggbb`);
  // (`fronts`: the buildings' own lines along the belt, [{ from, to, wall }] in its frame: a wall's mark stands on a
  // front wide enough for it, at that front's line, a set-back building's behind its forecourt; a gap between two is
  // an ALLEY, dressed as one. Unsaid, one front the belt's length at `wall`)
  if (dress.fronts !== undefined && !(Array.isArray(dress.fronts) && dress.fronts.every((f) => isObj(f) && [f.from, f.to, f.wall].every(Number.isFinite) && f.to > f.from))) throw new Error(`brawl: ${where}.fronts is the buildings along the belt [{ from, to, wall }] (m along it, the front's line across it)`);
  const fronts = dress.fronts ? dress.fronts.map((f) => ({ from: r3(f.from), to: r3(f.to), wall: r3(f.wall) })).sort((a, b) => a.from - b.from) : null;
  if (dress.setting !== undefined && !DRESS_SETTINGS[dress.setting]) throw new Error(`brawl: ${where}.setting is the kind of place it is: ${DRESS_SETTING_IDS.join(', ')}`);
  const settingId = dress.setting ?? 'street', raw = dress.sets ?? dressSets(belt, settingId);
  if (!Array.isArray(raw) || raw.length !== belt.screens.length) throw new Error(`brawl: ${where}.sets is a set a screen (${belt.screens.length}): a name (${DRESS_SET_IDS.join(', ')}), null for a bare one, or a set of its own { far: { piece: weight }, wall?, gap?, marks?, near? }`);
  // (`follows`: on a belt whose band drifts, the dress's ground moves with the band (a blockout, a place sheared by it,
  // brawl-warp.js): its strips and its fronts' lines are the band's own, wherever it has drifted. Unsaid, the ground
  // stands still and the band drifts over it: what would be left standing in the band is left out)
  if (dress.follows !== undefined && typeof dress.follows !== 'boolean') throw new Error(`brawl: ${where}.follows is true (its ground moves with a drifting band) or false`);
  const sets = raw.map((v, i) => { if (v === null) return null; if (typeof v === 'string') { if (!DRESS_SETS[v]) throw new Error(`brawl: ${where}.sets[${i}]: no set '${v}' (${DRESS_SET_IDS.join(', ')})`); return v; } if (!isObj(v)) throw new Error(`brawl: ${where}.sets[${i}] is a set's name, null, or a set of its own`); return readOwnSet(v, `${where}.sets[${i}]`); });
  return { seed: dress.seed ?? 1, ...(dress.setting ? { setting: dress.setting } : {}), sets, ...(dress.colour ? { colour: dress.colour.toLowerCase() } : {}), far, ...(near ? { near } : {}), wall: dress.wall ?? far[1], ...(fronts ? { fronts } : {}), ...(dress.follows === true ? { follows: true } : {}) };
}

// what an alley holds (each narrow enough for one)
const ALLEY = Object.freeze({ bags: 4, tyres: 2, barrel: 2, crate: 2, boxes: 2, drumfire: 1, litter: 2, rubble: 3, wreckage: 2 });
const pick = (weights, R) => { const E = Object.entries(weights), sum = E.reduce((a, [, w]) => a + w, 0); let t = R() * sum; for (const [k, w] of E) { t -= w; if (t <= 0) return k; } return E[E.length - 1][0]; };
/** The dress laid: → [{ piece, set, s, n, side: 'far' | 'wall' | 'alley' | 'near', turn }] in the belt's frame, in order. */
export function dressPlan(dress, belt) {
  const D = readDress(dress, belt), out = [];
  belt.screens.forEach((sc, i) => {
    if (!D.sets[i]) return;
    const S = setOf(D.sets[i]), id = setName(D.sets[i], i), R = streamOf(D.seed, 'brawl-dress', `${i}:${id}`), deep = D.far[1] - D.far[0];
    // the far side: against the fronts, a piece and a gap at a time (a piece too deep for the strip is passed over)
    for (let s = sc.from + 0.6 + R() * 1.2; s < sc.to - 0.6;) {
      const piece = pick(S.far, R), P = DRESS_PIECES[piece];
      if (P.size[1] > deep - 0.1) { s += 0.4; continue; }
      if (s + P.size[0] > sc.to - 0.3) break;
      // (its back to the fronts, a hand off them; now and then stood out toward the band, never into it)
      const slack = deep - P.size[1] - 0.1, n = D.far[1] - 0.08 - P.size[1] / 2 - (R() < 0.3 ? R() * Math.min(slack, 0.9) : 0);
      // (where the band has DRIFTED toward the fronts, what would stand in it is left out: the fronts do not move)
      if (D.follows || n - P.size[1] / 2 >= belt.depth[1] + beltDrift(belt, s + P.size[0] / 2) + 0.15 - 1e-9) out.push({ piece, set: id, s: r3(s + P.size[0] / 2), n: r3(n), side: 'far', turn: 1, ...(sc.boss ? { boss: true } : {}) });
      s += P.size[0] + S.gap[0] + R() * (S.gap[1] - S.gap[0]);
    }
    // its wall: the set's marks at their stride, proud of the fronts' own relief
    if (Object.keys(S.wall).length) for (let s = sc.from + 1 + R() * 2; s < sc.to - 1; s += S.marks[0] + R() * (S.marks[1] - S.marks[0])) {
      const piece = pick(S.wall, R), half = DRESS_PIECES[piece].size[0] / 2;
      // (on the building it falls on, where that front is wide enough for it; over an alley's mouth, none)
      const F = D.fronts ? D.fronts.find((f) => s - half >= f.from + 0.15 && s + half <= f.to - 0.15) : { wall: D.wall };
      if (F) out.push({ piece, set: id, s: r3(s), n: r3(F.wall - PROUD), side: 'wall', turn: 1, ...(sc.boss ? { boss: true } : {}) });
    }
    // its alleys (the gaps between its fronts): what is left in one, a little way in
    if (D.fronts) for (let k = 0; k + 1 < D.fronts.length; k++) {
      const a = D.fronts[k].to, b = D.fronts[k + 1].from, mid = (a + b) / 2;
      if (b - a < 1.2 || mid < sc.from || mid >= sc.to) continue;
      const Ra = streamOf(D.seed, 'brawl-dress-alley', `${k}`), back = Math.max(D.fronts[k].wall, D.fronts[k + 1].wall);
      for (let j = 0, n = back + 0.6 + Ra(); j < 3; j++, n += 1 + Ra() * 1.2) {
        const piece = pick(ALLEY, Ra), P = DRESS_PIECES[piece];
        if (P.size[0] > b - a - 0.2) continue;
        out.push({ piece, set: id, s: r3(a + P.size[0] / 2 + 0.1 + Ra() * Math.max(0, b - a - P.size[0] - 0.2)), n: r3(n), side: 'alley', turn: 1, ...(sc.boss ? { boss: true } : {}) });
      }
    }
    // the near side: sparse and low, well clear of the band (between the camera and the fight)
    if (D.near && Object.keys(S.near).length) for (let s = sc.from + 2 + R() * 5; s < sc.to - 1; s += 6 + R() * 7) {
      const piece = pick(S.near, R), P = DRESS_PIECES[piece], room = D.near[1] - D.near[0] - P.size[1];
      if (room < 0.4) continue;
      out.push({ piece, set: id, s: r3(s), n: r3(D.near[1] - 0.4 - P.size[1] / 2 - R() * Math.min(room - 0.4, 1.2)), side: 'near', turn: -1, ...(sc.boss ? { boss: true } : {}) });
    }
  });
  return out;
}

/** The dress's faces in the world: each piece built in its own frame (seeded by its place), turned to face the band
 * (a near piece faces away from the camera's side), set on the belt's floor. Unshaded: `hex` is the face's own colour. */
export function dressFaces(dress, belt) {
  const D = readDress(dress, belt), t = (belt.heading * Math.PI) / 180, c = Math.cos(t), si = Math.sin(t), out = [];
  dressPlan(D, belt).forEach((p, k) => {
    const P = DRESS_PIECES[p.piece], R = streamOf(D.seed, 'brawl-dress-piece', `${k}:${p.piece}`);
    // (on a belt that rises, a piece stands on the floor under its own middle)
    const lift = beltFloor(belt, p.s);
    for (const f of P.build(R, P.crew && (p.boss || p.piece === 'tag' || p.piece === 'banner' || R() < 0.34) ? D.colour ?? null : null)) {
      const o = [f.out[0], f.out[1] * p.turn, f.out[2]];
      // (on ground that follows a drifting band: a thing on the floor moved across whole, a mark on the wall sheared
      // with its wall, corner by corner)
      const across = (ds) => (D.follows ? beltDrift(belt, p.side === 'wall' ? p.s + ds : p.s) : 0);
      out.push({ corners: f.corners.map(([s, n, z]) => beltPoint(belt, p.s + s, p.n + n * p.turn + across(s), z + lift)), out: [r3(o[0] * c - o[1] * si), r3(o[0] * si + o[1] * c), r3(o[2])], hex: f.hex });
    }
  });
  return out;
}

/** The dress as a World page's faces: wound so each looks along its `out`, its fill its colour under `light` (the
 * level's own; the page's default light when it has none). */
export function dressSceneFaces(dress, belt, light = undefined) {
  return dressFaces(dress, belt).map((f) => {
    let c = f.corners;
    const a = c[0], b = c[1], d = c[2], n = [(b[1] - a[1]) * (d[2] - a[2]) - (b[2] - a[2]) * (d[1] - a[1]), (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]), (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0])];
    if (n[0] * f.out[0] + n[1] * f.out[1] + n[2] * f.out[2] < 0) c = c.slice().reverse();
    const l = Math.hypot(...f.out) || 1, o = f.out.map((v) => r3(v / l)), fill = shadeHex(f.hex, o, light);
    return { corners: c, normal: o, outNormal: o, group: 'brawl:dress', fill, cornerFills: c.map(() => fill) };
  });
}

// ── THE STREET'S BREAKABLES (brawl-things.js THINGS.box) as skandart's vessels: what a box is drawn as while it stands
// and what it leaves where it broke (its form's pieces off the debris shelf). Triangles in the thing's own frame (its
// foot at the origin, z up), a colour a corner, baked under a light from above so it reads unlit. ──
const BOX_VESSEL = Object.freeze({ barrel: [{ barrel: 1 }, 'old', { plank: 5, splinter: 6 }], crate: [{ crate: 1 }, 'old', { plank: 6, splinter: 8 }], drum: [{ barrel: 1 }, 'industrial', { 'deck-sheet': 2, splinter: 3 }] });
const tris = (faces) => {
  const pos = [], col = [];
  for (const f of faces) {
    const l = Math.hypot(...f.out) || 1, k = 0.55 + 0.45 * Math.max(0, (f.out[0] * -0.35 + f.out[1] * -0.55 + f.out[2] * 0.76) / l), rgb = [1, 3, 5].map((i) => Math.round(parseInt(f.hex.slice(i, i + 2), 16) * k));
    for (let i = 1; i + 1 < f.corners.length; i++) for (const c of [f.corners[0], f.corners[i], f.corners[i + 1]]) { pos.push(...c.map(r3)); col.push(...rgb); }
  }
  return { pos, col };
};
/** The models of the boxes a street lays: { [what]: { whole: { pos, col }, wreck: { pos, col } } } (a box with no
 * vessel, a phone booth, has none: the page draws its block). Seeded by its name. */
export function boxModels(whats) {
  const out = {};
  for (const what of [...new Set(whats)].sort()) {
    const B = BOX_VESSEL[what]; if (!B) continue;
    const R = streamOf(1, 'brawl-box', what), whole = vessels(B[0], B[1], 0, 1.2, R);
    // (stood on its own middle: the group's bay centred it along, its back at 0 across)
    const ys = whole.flatMap((f) => f.corners.map((c) => c[1])), mid = (Math.min(...ys) + Math.max(...ys)) / 2;
    out[what] = { whole: tris(whole.map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => [x, y - mid, z]) }))), wreck: tris(debris(B[2], 1.1, 1.1, R)) };
  }
  return out;
}

// ── COVER FROM THE DRESS: a place's cover is of the place. A cover row (brawl-things.js THINGS.cover) named for a
// dress piece is that piece stood in the band: the same thing that stands beside the fight, where it stops a round. ──
/** the dress piece a cover is drawn as (its own name, or the one said here); null: none (the page draws its block) */
const COVER_PIECE = Object.freeze({ crates: 'crate' });
export const coverPiece = (what) => { const p = COVER_PIECE[what] ?? what; return DRESS_PIECES[p] && !DRESS_PIECES[p].wall ? p : null; };
const COVER_WRECK = Object.freeze({ 'wood-impact': { plank: 5, splinter: 8 }, 'metal-impact': { 'deck-sheet': 2, splinter: 4 }, 'stone-impact': { 'concrete-chunk': 6, spall: 6 }, 'dirt-impact': { spall: 5, paper: 3 } });
/** The models of the cover a map lays: { [what]: { whole, wreck } }, each its dress piece fitted to its row's box (w
 * along, d across, h up, its foot at the origin), and what it leaves broken (the debris shelf, by its matter). Seeded
 * by its name. A cover with no piece (a low wall, a mount's wreck) has none. */
export function coverModels(whats) {
  const out = {};
  for (const what of [...new Set(whats)].sort()) {
    const piece = coverPiece(what), D = THINGS.cover[what];
    if (!piece || !D) continue;
    const R = streamOf(1, 'brawl-cover', what), F = DRESS_PIECES[piece].build(R), C3 = F.flatMap((f) => f.corners);
    const lo = [0, 1, 2].map((i) => Math.min(...C3.map((c) => c[i]))), hi = [0, 1, 2].map((i) => Math.max(...C3.map((c) => c[i])));
    const k = [D.w / Math.max(1e-6, hi[0] - lo[0]), D.d / Math.max(1e-6, hi[1] - lo[1]), D.h / Math.max(1e-6, hi[2])], mid = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2];
    out[what] = { whole: tris(F.map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => [(x - mid[0]) * k[0], (y - mid[1]) * k[1], z * k[2]]) }))), wreck: tris(debris(COVER_WRECK[D.sound] ?? COVER_WRECK['wood-impact'], Math.max(1, D.w), Math.max(1, D.d), R)) };
  }
  return out;
}
/** the cover a set has: its floor pieces that stop a round, the commonest first */
const coverOfSet = (S) => (S ? Object.entries(S.far).filter(([p]) => THINGS.cover[p] && coverPiece(p)).sort((a, b) => b[1] - a[1]).map(([p]) => p) : []);
/** The cover a SETTING's places have, over all its sets, the commonest first. */
export function settingCover(settingId) {
  const w = new Map();
  for (const id of DRESS_SETTINGS[settingId]?.sets ?? []) for (const [p, n] of Object.entries(DRESS_SETS[id].far)) if (THINGS.cover[p] && coverPiece(p)) w.set(p, (w.get(p) ?? 0) + n);
  return [...w].sort((a, b) => b[1] - a[1]).map(([p]) => p);
}
/**
 * THE COVER EACH SCREEN OF A DRESSED MAP HAS: a list a screen, what its set stands on its floor that stops a round (a
 * gate's sandbags and barriers, a dock's pallets and drums, an open floor's desks and cabinets); a set with none (a
 * bare screen, a set of things too slight) takes its setting's. `dress` a map's dress as read (its setting, its sets),
 * or null for a map with none: no list (the play's own cover).
 */
export function dressCover(dress, belt) {
  if (!dress) return null;
  const setting = dress.setting ?? 'street', sets = dress.sets ?? dressSets(belt, setting), all = settingCover(setting);
  return belt.screens.map((_, i) => { const own = coverOfSet(setOf(sets[i])); return own.length ? own : all; });
}

/**
 * THE LAWS OF A SIDE-SCROLLING MAP (docs/side-scroll-map-principles.md), measured on a dress laid on its belt: each
 * `{ law, ok, what }`. They advise: a map that loses one is still made, and says so.
 *   outside-the-band    nothing of the dress stands in the band: the fight's floor is the fight's
 *   a-place-a-screen    no two screens running wear the same set: a held screen is remembered as a place
 *   the-boss-owns-it    the boss's screen carries its holder's marks (a crew's piece on it), where the map has a boss
 *   two-depths          every dressed screen has things on the floor AND marks on the wall: a backdrop is layers
 *   no-bare-run         no stretch of the far side longer than BARE m with nothing on the floor or the wall
 *   variety             a screen draws at least three different pieces: a row of one thing is a pattern, not a place
 *   low-near-side       nothing between the camera and the fight stands over a body's waist
 */
export const DRESS_LAWS = Object.freeze({ bare: 9, variety: 3 });
export function dressLaws(dress, belt) {
  const D = readDress(dress, belt), P = dressPlan(D, belt), laws = [], dressed = belt.screens.map((_, i) => !!D.sets[i]);
  const half = (p) => DRESS_PIECES[p.piece].size[1] / 2;
  const slid = (p) => (D.follows ? 0 : beltDrift(belt, p.s));
  const inBand = P.filter((p) => (p.side === 'far' && p.n - half(p) < belt.depth[1] + slid(p) - 1e-6) || (p.side === 'near' && p.n + half(p) > belt.depth[0] + slid(p) + 1e-6));
  laws.push({ law: 'outside-the-band', ok: !inBand.length, what: inBand.length ? `${inBand.length} of the dress stand in the band (${inBand.slice(0, 3).map((p) => `${p.piece} at ${p.s} m`).join(', ')})` : `all ${P.length} stand outside the band` });
  const names = D.sets.map((v, i) => (v ? setName(v, i) : null)), same = names.map((n, i) => (i && n && n === names[i - 1] ? i : -1)).filter((i) => i >= 0);
  laws.push({ law: 'a-place-a-screen', ok: !same.length, what: same.length ? `screens ${same.map((i) => `${i} and ${i + 1}`).join(', ')} wear the same set (${names[same[0]]}): a screen is a place of its own` : `${names.filter(Boolean).length} dressed screens, no two running alike` });
  const bossAt = belt.screens.findIndex((sc) => sc.boss);
  if (bossAt >= 0 && dressed[bossAt]) { const S = setOf(D.sets[bossAt]), owned = [...Object.keys(S.far), ...Object.keys(S.wall)].some((id) => DRESS_PIECES[id].crew); laws.push({ law: 'the-boss-owns-it', ok: owned, what: owned ? `the boss's screen (${names[bossAt]}) carries its holder's marks` : `the boss's screen (${names[bossAt]}) carries nothing of its holder's: a tag, a banner, a stencil, a map board` }); }
  const flat = belt.screens.map((sc, i) => (dressed[i] ? { i, floor: P.filter((p) => p.side === 'far' && p.s >= sc.from && p.s < sc.to), wall: P.filter((p) => p.side === 'wall' && p.s >= sc.from && p.s < sc.to) } : null)).filter(Boolean);
  const one = flat.filter((f) => !f.floor.length || !f.wall.length);
  laws.push({ law: 'two-depths', ok: !one.length, what: one.length ? `screen ${one.map((f) => f.i + 1).join(', ')} has ${one[0].floor.length ? 'nothing on its wall' : 'nothing on its floor'}: a backdrop reads in layers` : 'every dressed screen has things on its floor and marks on its wall' });
  let worst = 0, at = 0;
  for (const sc of belt.screens.filter((_, i) => dressed[i])) { const xs = [sc.from, ...P.filter((p) => (p.side === 'far' || p.side === 'wall') && p.s >= sc.from && p.s < sc.to).map((p) => p.s).sort((a, b) => a - b), sc.to]; for (let k = 1; k < xs.length; k++) if (xs[k] - xs[k - 1] > worst) { worst = xs[k] - xs[k - 1]; at = xs[k - 1]; } }
  laws.push({ law: 'no-bare-run', ok: worst <= DRESS_LAWS.bare, what: `the longest bare stretch of the far side is ${r3(worst)} m (from ${r3(at)} m; the most ${DRESS_LAWS.bare})` });
  const thin = flat.filter((f) => new Set([...f.floor, ...f.wall].map((p) => p.piece)).size < DRESS_LAWS.variety);
  laws.push({ law: 'variety', ok: !thin.length, what: thin.length ? `screen ${thin.map((f) => f.i + 1).join(', ')} draws fewer than ${DRESS_LAWS.variety} different pieces` : `every dressed screen draws ${DRESS_LAWS.variety} pieces or more` });
  const tall = P.filter((p) => p.side === 'near' && DRESS_PIECES[p.piece].tall > NEAR_TALL);
  laws.push({ law: 'low-near-side', ok: !tall.length, what: tall.length ? `${tall.length} on the near side stand over ${NEAR_TALL} m` : 'nothing between the camera and the fight stands over a body\'s waist' });
  return laws;
}

export function dressCount(dress, belt) {
  const plan = dressPlan(dress, belt), bySet = {};
  for (const p of plan) bySet[p.set] = (bySet[p.set] ?? 0) + 1;
  return { pieces: plan.length, faces: dressFaces(dress, belt).length, bySet };
}
