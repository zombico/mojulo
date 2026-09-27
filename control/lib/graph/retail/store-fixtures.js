// FIXTURE archetypes — each maps to ONE parametric builder in the LOCAL unit frame
// (x = lateral, y = depth into the store, z = up; the customer face is −y).
//
// Builder contract (every file under fixtures/ is one archetype written against it):
//   build({ x0, x1, y0, y1, z, ceilingZ, along, face, light, tint, merch, rng }) → faces[]
//   - (x0..y1) is the fixture's local FOOTPRINT the interpreter already resolved from the row;
//   - `along` is the run axis ('x' | 'y'); `face` the customer side ('-y' | '+x' | '-x');
//   - `merch()` returns the next seeded palette pick; `rng()` is the fixture's own seeded die;
//   - pure: no state, no Math.random / Date — same args ⇒ byte-identical faces.
// Declaration row: { depth, width?, height, shape: 'run'|'point', wallBacked, merch, tall,
//   overhead, seat, clearance, sizes? }. `sizes` names a point fixture's footprints largest first
//   (`p.variant` tells the builder which); a card may pin one, the degrade pass steps down them. `depth` is the footprint across the run; a point fixture
//   declares its [width, depth] square instead. `tall` blocks the cash-wrap sightline.

import {
  assetFaces, buildBarCounter, buildBackBar, buildBarStool, buildCafeTable, buildCafeChair,
  buildBanquette, buildPendantLight, buildWallArt, buildHousePlant, buildToilet, buildVanity,
} from '../polygonizer/floorplan-building-assets.js';
import { LISTED_FIXTURES } from './fixtures/index.js';
import { box } from './store-box.js';

export { box };

const bake = (frag, light) => assetFaces(frag, { light });
const mid = (p) => [(p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2];
const runLen = (p) => (p.along === 'y' ? p.y1 - p.y0 : p.x1 - p.x0);

// ── the interpreter's own builders ────────────────────────────────────────────
function counter(p) {
  const [x, y] = mid(p);
  const faces = bake(buildBarCounter({ x, y, z: p.z, w: runLen(p), d: p.along === 'y' ? p.x1 - p.x0 : p.y1 - p.y0, h: p.bar ? 3.7 : 3.4, along: p.along, rail: !!p.bar, body: p.tint || '#5a4a38' }), p.light);
  if (!p.bar) {                                         // a till on the staff side
    const tx = p.along === 'y' ? x : p.x0 + 0.3 * (p.x1 - p.x0), ty = p.along === 'y' ? p.y0 + 0.3 * (p.y1 - p.y0) : y;
    box(faces, tx - 0.5, tx + 0.5, ty - 0.35, ty + 0.35, p.z + 3.4, p.z + 3.75, '#2a2d33', p.light);
  }
  return faces;
}
function backBar(p) {
  const [x, y] = mid(p);
  return bake(buildBackBar({ x, y, z: p.z, w: p.x1 - p.x0, d: p.y1 - p.y0, h: 6.5 }), p.light);
}
function stool(p) { const [x, y] = mid(p); return bake(buildBarStool({ x, y, z: p.z, h: 2.5 }), p.light); }
function rackRun(p) {                                   // freestanding double-sided garment rail
  const out = [], L = p.light, tall = 4.9, metal = '#3a3d42';
  const along = p.along === 'y';
  const [a0, a1] = along ? [p.y0, p.y1] : [p.x0, p.x1];
  const [c] = along ? [(p.x0 + p.x1) / 2] : [(p.y0 + p.y1) / 2];
  const B = (s0, s1, t0, t1, z0, z1, hex) => (along ? box(out, t0, t1, s0, s1, z0, z1, hex, L) : box(out, s0, s1, t0, t1, z0, z1, hex, L));
  for (const s of [a0 + 0.1, a1 - 0.1]) {
    B(s - 0.06, s + 0.06, c - 0.06, c + 0.06, p.z, p.z + tall, metal);      // upright
    B(s - 0.08, s + 0.08, c - 0.7, c + 0.7, p.z, p.z + 0.1, metal);          // foot
  }
  B(a0, a1, c - 0.05, c + 0.05, p.z + tall - 0.1, p.z + tall, metal);        // top rail
  for (let s = a0 + 0.4; s < a1 - 0.3; s += 0.32) {                           // hanging garments
    const drop = 2.1 + p.rng() * 0.9;
    B(s - 0.05, s + 0.05, c - 0.75, c + 0.75, p.z + tall - 0.15 - drop, p.z + tall - 0.2, p.merch());
  }
  return out;
}
function gondola(p) {                                   // double-sided shelving island
  const out = [], L = p.light, H = 5.2, body = p.tint || '#d6d2ca';
  const along = p.along === 'y';
  const [a0, a1] = along ? [p.y0, p.y1] : [p.x0, p.x1];
  const [t0, t1] = along ? [p.x0, p.x1] : [p.y0, p.y1];
  const c = (t0 + t1) / 2;
  const B = (s0, s1, u0, u1, z0, z1, hex) => (along ? box(out, u0, u1, s0, s1, z0, z1, hex, L) : box(out, s0, s1, u0, u1, z0, z1, hex, L));
  B(a0, a1, t0 + 0.05, t1 - 0.05, p.z, p.z + 0.35, '#5a5d63');              // kick base
  B(a0, a1, c - 0.08, c + 0.08, p.z, p.z + H, body);                         // spine
  B(a0, a0 + 0.1, t0, t1, p.z, p.z + H, body); B(a1 - 0.1, a1, t0, t1, p.z, p.z + H, body);
  for (const sz of [0.35, 1.55, 2.75, 3.95]) {
    B(a0 + 0.1, a1 - 0.1, t0, t1, p.z + sz, p.z + sz + 0.07, body);         // shelf both sides
    for (const [u0, u1] of [[t0 + 0.1, c - 0.15], [c + 0.15, t1 - 0.1]]) {
      for (let s = a0 + 0.2; s < a1 - 0.3;) {
        const w = 0.35 + p.rng() * 0.55, h = 0.45 + p.rng() * 0.6;
        const e = Math.min(s + w, a1 - 0.15);
        B(s, e, u0, u1, p.z + sz + 0.07, p.z + sz + 0.07 + h, p.merch());
        s = e + 0.06;
      }
    }
  }
  return out;
}
function podium(p) {
  const out = [], [x, y] = mid(p), hw = (p.x1 - p.x0) / 2, hd = (p.y1 - p.y0) / 2;
  box(out, x - hw, x + hw, y - hd, y + hd, p.z, p.z + 2.3, p.tint || '#cdd2d7', p.light);
  box(out, x - hw * 0.55, x + hw * 0.55, y - hd * 0.5, y + hd * 0.5, p.z + 2.3, p.z + 2.3 + 0.5 + p.rng() * 0.6, p.merch(), p.light);
  return out;
}
function tableSet(p) {
  const [x, y] = mid(p);
  if (p.variant === 'two') {                              // a 2-top: small table, chairs across it
    const faces = bake(buildCafeTable({ x, y, z: p.z, w: 2.0, d: 2.0, h: 2.45 }), p.light);
    for (const [dy, back] of [[-1.35, '-y'], [1.35, '+y']]) faces.push(...bake(buildCafeChair({ x, y: y + dy, z: p.z, back }), p.light));
    return faces;
  }
  const faces = bake(buildCafeTable({ x, y, z: p.z, w: 2.4, d: 2.4, h: 2.45 }), p.light);
  for (const [dx, dy, back] of [[0, -1.6, '-y'], [0, 1.6, '+y'], [-1.6, 0, '-x'], [1.6, 0, '+x']]) faces.push(...bake(buildCafeChair({ x: x + dx, y: y + dy, z: p.z, back }), p.light));
  return faces;
}
function banquette(p) {
  const [x, y] = mid(p);
  const wallSide = p.face === '-y' ? '+y' : p.face === '+x' ? '-x' : p.face === '-x' ? '+x' : '-y';
  return bake(buildBanquette({ x, y, z: p.z, w: runLen(p), d: p.along === 'y' ? p.x1 - p.x0 : p.y1 - p.y0, along: p.along, wallSide, cushion: p.tint || '#7d4a40' }), p.light);
}
function pendantRow(p) {
  const out = [], [, y] = mid(p), n = Math.max(1, Math.round(runLen(p) / (p.pitch || 4)));
  for (let i = 0; i < n; i += 1) {
    const x = p.x0 + (i + 0.5) * (p.x1 - p.x0) / n;
    out.push(...bake(buildPendantLight({ x, y, ceilingZ: p.ceilingZ, drop: 3.2 }), p.light));
  }
  return out;
}
function wallArt(p) { const [x, y] = mid(p); return bake(buildWallArt({ x, y, z: p.z + 6, w: runLen(p), h: 2.2, along: p.along, face: p.face, art: p.merch() }), p.light); }
function mirror(p) { const [x, y] = mid(p); return bake(buildWallArt({ x, y, z: p.z + 4.2, w: 1.8, h: 5.4, along: p.along, face: p.face, frame: '#c9ccce', art: '#b9d3dc' }), p.light); }
function plant(p) { const [x, y] = mid(p); return bake(buildHousePlant({ x, y, z: p.z, h: 5.2, spread: 2.2 }), p.light); }
function toilet(p) { const [x, y] = mid(p); return bake(buildToilet({ x, y, z: p.z, wall: '+y' }), p.light); }
function vanity(p) { const [x, y] = mid(p); return bake(buildVanity({ x, y, z: p.z, w: runLen(p), d: p.along === 'y' ? p.x1 - p.x0 : p.y1 - p.y0, along: p.along }), p.light); }
function fittingBench(p) {
  const out = [];
  box(out, p.x0, p.x1, p.y0, p.y1, p.z, p.z + 1.5, '#8a6a44', p.light);
  box(out, p.x0 + 0.2, p.x0 + 0.3, p.y1 - 0.05, p.y1, p.z + 5.2, p.z + 5.5, '#c9ccce', p.light);   // coat hook
  return out;
}
function stockShelf(p) {                                // one-sided wall shelving in back-of-house
  const out = [], L = p.light, along = p.along === 'y';
  const [a0, a1] = along ? [p.y0, p.y1] : [p.x0, p.x1];
  const [t0, t1] = along ? [p.x0, p.x1] : [p.y0, p.y1];
  const B = (s0, s1, u0, u1, z0, z1, hex) => (along ? box(out, u0, u1, s0, s1, z0, z1, hex, L) : box(out, s0, s1, u0, u1, z0, z1, hex, L));
  for (const s of [a0, a1 - 0.12]) B(s, s + 0.12, t0, t1, p.z, p.z + 7, '#6e7278');
  for (const sz of [0.4, 2.1, 3.8, 5.5]) {
    B(a0, a1, t0, t1, p.z + sz, p.z + sz + 0.08, '#8f9399');
    for (let s = a0 + 0.2; s < a1 - 0.6; s += 1.1 + p.rng() * 0.3) B(s, s + 0.9, t0 + 0.15, t1 - 0.1, p.z + sz + 0.08, p.z + sz + 0.9, '#b59a72');  // cartons
  }
  return out;
}

// ── the registry ──────────────────────────────────────────────────────────────
const CORE_FIXTURES = {
  counter:      { build: counter,      decl: { shape: 'run',   depth: 2.4, height: 3.4, wallBacked: false, merch: false, tall: false, clearance: 3 } },
  backBar:      { build: backBar,      decl: { shape: 'run',   depth: 1.3, height: 6.5, wallBacked: true,  merch: true,  tall: true,  clearance: 2.5 } },
  stool:        { build: stool,        decl: { shape: 'point', size: [1.3, 1.3], height: 2.5, seat: true, clearance: 0 } },
  rackRun:      { build: rackRun,      decl: { shape: 'run',   depth: 1.6, height: 4.9, wallBacked: false, merch: true,  tall: false, clearance: 3 } },
  gondola:      { build: gondola,      decl: { shape: 'run',   depth: 2.6, height: 5.2, wallBacked: false, merch: true,  tall: true,  clearance: 3.5 } },
  podium:       { build: podium,       decl: { shape: 'point', size: [2.0, 1.7], height: 3.2, merch: true, feature: true, clearance: 2 } },
  tableSet:     { build: tableSet,     decl: { shape: 'point', size: [4.6, 4.6], sizes: { four: [4.6, 4.6], two: [2.4, 4.0] }, height: 2.9, seat: true, clearance: 1.5 } },
  banquette:    { build: banquette,    decl: { shape: 'run',   depth: 1.9, height: 3.3, wallBacked: true,  seat: true, clearance: 2 } },
  pendantRow:   { build: pendantRow,   decl: { shape: 'run',   depth: 1.5, height: 0, overhead: true } },
  wallArt:      { build: wallArt,      decl: { shape: 'run',   depth: 0.2, height: 0, wallBacked: true, wallHung: true } },
  plant:        { build: plant,        decl: { shape: 'point', size: [2.2, 2.2], height: 5.2, clearance: 0.5 } },
  // cell furniture (placed by the cell's archetype row, not by the card)
  fittingBench: { build: fittingBench, decl: { shape: 'run',   depth: 1.2, height: 1.5, wallBacked: true, cellOnly: true } },
  mirror:       { build: mirror,       decl: { shape: 'run',   depth: 0.2, height: 0, wallBacked: true, wallHung: true, cellOnly: true } },
  stockShelf:   { build: stockShelf,   decl: { shape: 'run',   depth: 1.6, height: 7, wallBacked: true, cellOnly: true } },
  toilet:       { build: toilet,       decl: { shape: 'point', size: [1.6, 2.2], height: 2.5, cellOnly: true } },
  vanity:       { build: vanity,       decl: { shape: 'run',   depth: 1.8, height: 2.7, wallBacked: true, cellOnly: true } },
};

// the one-file archetypes (fixtures/) merge in; a name above can never be overridden
export const FIXTURE_ARCHETYPES = { ...LISTED_FIXTURES, ...CORE_FIXTURES };
