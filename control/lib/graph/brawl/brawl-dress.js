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
 *   dressCount(dress, belt)         → { pieces, faces, bySet }
 *
 * `colour` is the crew's (the faction the street is held by): its tags, its banners and one canopy in a market wear it.
 * A dress collides with nothing: it stands outside the band, by its strips. Pure and deterministic (seeded dice only).
 */
import { beltPoint } from './brawl-belt.js';
import { streamOf } from '../city/plan/dice.js';
import { shadeHex } from '../polygonizer/vexar.js';

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

// ── the primitives (a piece's own frame: s along, n across, z up; `out` in the same frame) ──
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
  crate: { says: 'a timber crate', size: [0.8, 0.8], tall: 0.8, build: (R) => crate(0, 0, 0, 0.8, R) },
  crates: { says: 'crates stacked, two under one', size: [1.8, 0.9], tall: 1.5, build: (R) => [...crate(-0.45, 0, 0, 0.8, R), ...crate(0.45, 0.02, 0, 0.8, R), ...crate(R() < 0.5 ? -0.2 : 0.25, 0, 0.8, 0.7, R)] },
  barrel: { says: 'a barrel on its end', size: [0.7, 0.7], tall: 0.95, build: () => [...drum(0, 0, 0.33, 0, 0.95, C.timberDark, C.timber), ...drum(0, 0, 0.345, 0.2, 0.26, C.iron).slice(0, 8), ...drum(0, 0, 0.345, 0.68, 0.74, C.iron).slice(0, 8)] },
  barrels: { says: 'two barrels, one beside the other', size: [1.5, 0.7], tall: 0.95, build: () => [...DRESS_PIECES.barrel.build().map((f) => shift(f, -0.38, 0)), ...DRESS_PIECES.barrel.build().map((f) => shift(f, 0.38, 0.03))] },
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
});
function shift(f, ds, dn) { return { ...f, corners: f.corners.map(([s, n, z]) => [s + ds, n + dn, z]) }; }
// (a drum laid on its side as a wheel: its axis turned from z to n, about its own middle)
function tipWheel(s0, n0) { return (f) => ({ ...f, corners: f.corners.map(([s, n, z]) => [s, n0 + (z - 0.16), 0.28 + (n - n0)]), out: [f.out[0], f.out[2], f.out[1]] }); }
export const DRESS_PIECE_IDS = Object.freeze(Object.keys(DRESS_PIECES));

// ── the sets: a screen's theme ──
// (`marks`: the stride of its wall's marks, m)
const set = (says, far, gap, wall, near, marks = [4.5, 9.5]) => Object.freeze({ says, far: Object.freeze(far), gap: Object.freeze(gap), wall: Object.freeze(wall), near: Object.freeze(near), marks: Object.freeze(marks) });
export const DRESS_SETS = Object.freeze({
  market: set('a street market: stalls under their canopies, crates, barrels and sacks between them, a hand cart, its boxes and rubbish dumped beside it', { stall: 5, crates: 2, crate: 1, barrels: 2, sacks: 2, cart: 1, boxes: 2, bags: 1, litter: 2 }, [0.5, 1.6], { poster: 3, aircon: 1, neon: 1, pipe: 1 }, { crate: 2, barrel: 2, sacks: 1 }, [4, 8]),
  strip: set('a shuttered strip: steel shutters down and sprayed, a vending machine, rubbish bags and cardboard on the walk, blade signs lit, a fire escape overhead', { bags: 3, boxes: 3, vending: 2, litter: 3, paperbox: 1, tyres: 1, crate: 1 }, [0.8, 2.6], { shutter: 4, neon: 2, aircon: 2, poster: 2, tag: 1, escape: 2, pipe: 1, boards: 1 }, { bollard: 2, tyres: 1 }, [2.5, 5]),
  cafe: set('a cafe terrace: tables under parasols, planters, a sandwich board, a bench', { cafe: 5, planter: 3, pot: 2, board: 2, bench: 1, paperbox: 1 }, [0.7, 2], { poster: 1, banner: 1 }, { pot: 2, planter: 1, bollard: 2 }),
  yard: set('a back street\'s load-in: pallets and stacked crates, a skip, tyres, barrels, rubbish, a fire in a drum', { pallet: 3, crates: 3, skip: 1, tyres: 2, barrels: 2, crate: 1, cart: 1, bags: 2, boxes: 1, drumfire: 1, litter: 2 }, [0.8, 2.4], { poster: 2, tag: 2, piece: 2, escape: 2, pipe: 2, aircon: 1, boards: 1, shutter: 1 }, { tyres: 1, crate: 1, bollard: 2 }, [3, 6]),
  turf: set('the crew\'s own corner: its pieces and its marks on every wall, its banners out, fires in drums, tyres, barrels and crates where it sits', { tyres: 3, barrels: 2, crates: 2, drumfire: 3, bags: 2, bench: 1, crate: 1, litter: 2 }, [1, 2.6], { tag: 3, piece: 3, banner: 2, shutter: 2, poster: 1, escape: 1, boards: 1 }, { tyres: 1, barrel: 1, bollard: 1 }, [2.5, 5]),
  plain: set('a quiet stretch: a bench, a paper box, a planter, a little rubbish, far apart', { planter: 1, bench: 2, paperbox: 1, pot: 1, board: 1, bags: 1, litter: 2 }, [3, 6], { poster: 2, pipe: 1, aircon: 1 }, { bollard: 1 }),
});
export const DRESS_SET_IDS = Object.freeze(Object.keys(DRESS_SETS));
// the set a screen takes when none is said, by its place: the way in a shuttered strip, the held screens a market, a
// strip, a yard in turn, a walk between them quiet, the boss's the crew's corner (a cafe terrace is said, never fallen to)
const TURN = ['market', 'strip', 'yard'];
export function dressSets(belt) { let k = 0; return belt.screens.map((sc) => (sc.boss ? 'turf' : sc.gate ? TURN[k++ % TURN.length] : k ? 'plain' : 'strip')); }

// how far a wall's mark stands off the fronts' line (m): past a shopfront's shutters, sills and plinth
const PROUD = 0.16;
const KEYS = ['seed', 'sets', 'colour', 'far', 'near', 'wall', 'fronts'];
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
  const sets = dress.sets ?? dressSets(belt);
  if (!Array.isArray(sets) || sets.length !== belt.screens.length || sets.some((s) => s !== null && !DRESS_SETS[s])) throw new Error(`brawl: ${where}.sets is a set a screen (${belt.screens.length}): ${DRESS_SET_IDS.join(', ')}, or null for a bare one`);
  return { seed: dress.seed ?? 1, sets: [...sets], ...(dress.colour ? { colour: dress.colour.toLowerCase() } : {}), far, ...(near ? { near } : {}), wall: dress.wall ?? far[1], ...(fronts ? { fronts } : {}) };
}

// what an alley holds (each narrow enough for one)
const ALLEY = Object.freeze({ bags: 4, tyres: 2, barrel: 2, crate: 2, boxes: 2, drumfire: 1, litter: 2 });
const pick = (weights, R) => { const E = Object.entries(weights), sum = E.reduce((a, [, w]) => a + w, 0); let t = R() * sum; for (const [k, w] of E) { t -= w; if (t <= 0) return k; } return E[E.length - 1][0]; };
/** The dress laid: → [{ piece, set, s, n, side: 'far' | 'wall' | 'alley' | 'near', turn }] in the belt's frame, in order. */
export function dressPlan(dress, belt) {
  const D = readDress(dress, belt), out = [];
  belt.screens.forEach((sc, i) => {
    const id = D.sets[i]; if (!id) return;
    const S = DRESS_SETS[id], R = streamOf(D.seed, 'brawl-dress', `${i}:${id}`), deep = D.far[1] - D.far[0];
    // the far side: against the fronts, a piece and a gap at a time (a piece too deep for the strip is passed over)
    for (let s = sc.from + 0.6 + R() * 1.2; s < sc.to - 0.6;) {
      const piece = pick(S.far, R), P = DRESS_PIECES[piece];
      if (P.size[1] > deep - 0.1) { s += 0.4; continue; }
      if (s + P.size[0] > sc.to - 0.3) break;
      // (its back to the fronts, a hand off them; now and then stood out toward the band, never into it)
      const slack = deep - P.size[1] - 0.1, n = D.far[1] - 0.08 - P.size[1] / 2 - (R() < 0.3 ? R() * Math.min(slack, 0.9) : 0);
      out.push({ piece, set: id, s: r3(s + P.size[0] / 2), n: r3(n), side: 'far', turn: 1 });
      s += P.size[0] + S.gap[0] + R() * (S.gap[1] - S.gap[0]);
    }
    // its wall: the set's marks at their stride, proud of the fronts' own relief
    for (let s = sc.from + 1 + R() * 2; s < sc.to - 1; s += S.marks[0] + R() * (S.marks[1] - S.marks[0])) {
      const piece = pick(S.wall, R), half = DRESS_PIECES[piece].size[0] / 2;
      // (on the building it falls on, where that front is wide enough for it; over an alley's mouth, none)
      const F = D.fronts ? D.fronts.find((f) => s - half >= f.from + 0.15 && s + half <= f.to - 0.15) : { wall: D.wall };
      if (F) out.push({ piece, set: id, s: r3(s), n: r3(F.wall - PROUD), side: 'wall', turn: 1 });
    }
    // its alleys (the gaps between its fronts): what is left in one, a little way in
    if (D.fronts) for (let k = 0; k + 1 < D.fronts.length; k++) {
      const a = D.fronts[k].to, b = D.fronts[k + 1].from, mid = (a + b) / 2;
      if (b - a < 1.2 || mid < sc.from || mid >= sc.to) continue;
      const Ra = streamOf(D.seed, 'brawl-dress-alley', `${k}`), back = Math.max(D.fronts[k].wall, D.fronts[k + 1].wall);
      for (let j = 0, n = back + 0.6 + Ra(); j < 3; j++, n += 1 + Ra() * 1.2) {
        const piece = pick(ALLEY, Ra), P = DRESS_PIECES[piece];
        if (P.size[0] > b - a - 0.2) continue;
        out.push({ piece, set: id, s: r3(a + P.size[0] / 2 + 0.1 + Ra() * Math.max(0, b - a - P.size[0] - 0.2)), n: r3(n), side: 'alley', turn: 1 });
      }
    }
    // the near side: sparse and low, well clear of the band (between the camera and the fight)
    if (D.near) for (let s = sc.from + 2 + R() * 5; s < sc.to - 1; s += 6 + R() * 7) {
      const piece = pick(S.near, R), P = DRESS_PIECES[piece], room = D.near[1] - D.near[0] - P.size[1];
      if (room < 0.4) continue;
      out.push({ piece, set: id, s: r3(s), n: r3(D.near[1] - 0.4 - P.size[1] / 2 - R() * Math.min(room - 0.4, 1.2)), side: 'near', turn: -1 });
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
    for (const f of P.build(R, P.crew && (p.set === 'turf' || p.piece === 'tag' || p.piece === 'banner' || R() < 0.34) ? D.colour ?? null : null)) {
      const o = [f.out[0], f.out[1] * p.turn, f.out[2]];
      out.push({ corners: f.corners.map(([s, n, z]) => beltPoint(belt, p.s + s, p.n + n * p.turn, z)), out: [r3(o[0] * c - o[1] * si), r3(o[0] * si + o[1] * c), r3(o[2])], hex: f.hex });
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

export function dressCount(dress, belt) {
  const plan = dressPlan(dress, belt), bySet = {};
  for (const p of plan) bySet[p.set] = (bySet[p.set] ?? 0) + 1;
  return { pieces: plan.length, faces: dressFaces(dress, belt).length, bySet };
}
