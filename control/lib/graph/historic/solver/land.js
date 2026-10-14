/**
 * historic/solver/land — the ground left to people: the free ground in the town packed with house lots, and outside
 * it the fields, the trees and (in a region) the work done in the land. TREES is keyed by `hinterland.tree`,
 * ACTIVITY_WHERE by an activity's `where`; the form's schema reads its words from both.
 */
import { CELL, C, stream, pick, packLots, frontageLots, lotSlot } from '../layout-kit.js';
import { landOf } from '../cultures/index.js';
import { FARM_CULTURES, WORKS_CULTURES } from '../land-kits.js';
import { availableAt, placeOf } from '../ledger/index.js';
import { palm } from '../patterns.js';
import { olive } from '../assets/lindos.js';
import { tree as qinTree } from '../assets/qin.js';
import { centre, grow, envelopeMid } from './context.js';

const lift = (bs, z) => bs.map((b) => ({ ...b, z0: b.z0 + z, z1: b.z1 + z, ...(b.pts ? { pts: b.pts.map(([px, py, pz]) => [px, py, pz + z]) } : {}) }));
const crowned = (crown) => (x, y, z, rng, P) => lift(qinTree(x, y, rng, { poplar: P.poplar ?? '#5f7a3c', bark: P.bark ?? '#6b5a44', ...P }, { crown, h: 7 + rng() * 3 }), z);

/** The trees of the land, by `hinterland.tree`: `plant(x, y, z, rng, palette)` → masses; `none` plants nothing. */
export const TREES = Object.freeze({
  palm: { read: 'date palms', plant: (x, y, z, rng) => lift([palm(x, y, rng)], z) },
  olive: { read: 'olive trees', plant: (x, y, z, rng, P) => olive(x, y, z, rng, { olive: P.olive ?? '#6f7a4c', ...P }) },
  poplar: { read: 'poplars', plant: crowned('poplar') },
  round: { read: 'round-crowned trees', plant: crowned('round') },
  none: { read: 'no trees', plant: null },
});

/** Where an activity's yard goes, by its `where`: `score(X, x, y, yard)` (higher is better). */
export const ACTIVITY_WHERE = Object.freeze({
  fields: { read: 'among the fields', score: (X, x, y) => -Math.abs(Math.hypot(x - X.townCentre[0], y - X.townCentre[1]) - Math.max(X.tw, X.td) * 0.75) },
  upstream: { read: 'by the water, upstream of the town', score: (X, x, y, yard) => byWater(X, x, y, yard, true) },
  downstream: { read: 'by the water, downstream', score: (X, x, y, yard) => byWater(X, x, y, yard, false) },
  outside: { read: 'outside the town, clear of it', score: (X, x, y) => -Math.hypot(x - X.townCentre[0], y - X.townCentre[1]) },
});
function byWater(X, x, y, [yw, yd], upstream) {
  // by the water, upstream (west or north of the town) or downstream
  const { water, townCentre, tw, td } = X, dTown = Math.hypot(x - townCentre[0], y - townCentre[1]);
  const nearW = [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => water.isWater(x + dx * (yw / 2 + 10), y + dy * (yd / 2 + 10))) ? 0 : 400;   // the water just past the yard's edge, its width across, its depth along
  const up = { w: x < townCentre[0], e: x > townCentre[0], n: y < townCentre[1], s: y > townCentre[1] }[water.upstream];   // the upstream side of the town
  return -(nearW + (up === upstream ? 0 : 300) + Math.abs(dTown - Math.max(tw, td) * 0.6) * 0.3);
}

/**
 * How a town's free ground is cut into house lots, by `density.plots`: `lots(X)` → [{ c0, r0, w, d, facing? }] in cells.
 */
export const PLOTS = Object.freeze({
  pack: { read: 'lots packed into the free ground, each house facing its most open side', lots: (X) => packLots(X.g, X.F.density.lot, X.seed) },
  frontage: {
    read: 'narrow plots cut back from the streets, the main streets first, the houses in rows on the street line, yards behind',
    lots: (X) => frontageLots(X.g, X.F.density.front ?? [5, 9], X.F.density.deep ?? [12, 30], X.seed, { main: (c, r) => X.surf[r * X.cols + c] === 1 }),
  },
});

/** The activities a form's culture can lay: those whose kit (../land-kits.js) has every piece. */
export function activitiesOf(culture, F, inReach = null) {
  const land = landOf(culture);
  return (F.activities || []).filter((a) => {
    const kit = (a.kit === 'farm' ? FARM_CULTURES : WORKS_CULTURES)[land];
    return !!kit && a.pieces.every((p) => kit.assets[p]) && (!inReach || (a.cites || []).every((k) => inReach.has(k)));
  });
}

/** The lots: the free ground packed with house lots, each fronting a lane; the houses by size. */
export function layLots(X) {
  const { F, g, seed, hAt, at, set, surf, cols, kit, notes, slots } = X;
  const D = F.density, H = F.houses, LT = stream(seed, 'fill');
  X.houseAssets = new Set(H.map((h) => h.asset));
  for (const lot of PLOTS[D.plots ?? 'pack'].lots(X)) {
    const s = lotSlot(g, lot, D.gap ?? 0.4, () => null), r = s.rect;
    if (lot.facing) s.facing = lot.facing;   // a plot cut from a street fronts that street
    const zs = [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.d], [r.x + r.w, r.y + r.d]].map((p) => hAt(...p));
    const opens = (v) => v === C.LANE || v === C.OPEN;
    let sides = 0;
    for (let k = 0; k < lot.w; k++) sides += opens(at(lot.c0 + k, lot.r0 - 1)) + opens(at(lot.c0 + k, lot.r0 + lot.d));
    for (let k = 0; k < lot.d; k++) sides += opens(at(lot.c0 - 1, lot.r0 + k)) + opens(at(lot.c0 + lot.w, lot.r0 + k));
    if (!sides || Math.max(...zs) - Math.min(...zs) > 0.5 || (D.fill !== undefined && LT() > D.fill)) { for (let rr = lot.r0; rr < lot.r0 + lot.d; rr++) for (let c = lot.c0; c < lot.c0 + lot.w; c++) set(c, rr, C.OPEN); continue; }
    const fc = s.facing === 'e' ? lot.c0 + lot.w : s.facing === 'w' ? lot.c0 - 1 : lot.c0 + Math.floor(lot.w / 2), fr = s.facing === 's' ? lot.r0 + lot.d : s.facing === 'n' ? lot.r0 - 1 : lot.r0 + Math.floor(lot.d / 2);
    const onMain = surf[fr * cols + fc] === 1 && at(fc, fr) === C.LANE;
    const h = H.find((q) => (q.minSide === undefined || Math.min(r.w, r.d) >= q.minSide) && (q.minArea === undefined || r.w * r.d >= q.minArea) && (!q.onMain || onMain)) ?? H[H.length - 1];
    if (!kit[h.asset]) { notes.push(`house '${h.asset}' has no asset in the kit`); continue; }
    slots.push({ ...s, asset: h.asset, z: Math.min(...zs) });
  }
}

/** The land: in a region, the activities; then fields and trees on the open ground outside the town. */
export function layLand(X) {
  const { F, P, seed, view, rows, cols, at, set, hAt, water, boxes, grounds } = X;
  const HL = F.hinterland || {}, GR = stream(seed, 'groves');
  X.activities = view === 'city' ? [] : layActivities(X);
  const fieldsOn = HL.fields ?? 0, treesOn = HL.trees ?? 0, maxTrees = HL.max ?? 120;
  const tree = TREES[HL.tree ?? 'palm'];
  X.trees = 0;
  const plant = (x, y, z) => {
    if (X.trees >= maxTrees || !tree.plant) return;
    boxes.push(...tree.plant(x, y, z, GR, P));
    X.trees++;
  };
  for (let r = 0; r + 4 <= rows; r += 4) for (let c = 0; c + 4 <= cols; c += 4) {
    let ok = true; for (let k = 0; k < 16 && ok; k++) if (at(c + (k % 4), r + Math.floor(k / 4)) !== C.OUTSIDE) ok = false;
    if (!ok) continue;
    const x = c * CELL, y = r * CELL, zs = [[x, y], [x + 12, y], [x, y + 12], [x + 12, y + 12]].map((p) => hAt(...p));
    if (Math.max(...zs) - Math.min(...zs) > 0.3 || Math.min(...zs) < -0.2) continue;
    const nearWater = water.kind !== 'none' && [[-12, 0], [24, 0], [0, -12], [0, 24]].some(([dx, dy]) => water.isWater(x + dx, y + dy));
    if (GR() < fieldsOn) { grounds.push({ kind: 'field', x: x + 0.2, y: y + 0.2, w: 11.6, d: 11.6, z: zs[0] + 0.02, fill: Array.isArray(P.field) ? pick(P.field, GR) : P.field ?? P.ground }); for (let k = 0; k < 16; k++) set(c + (k % 4), r + Math.floor(k / 4), C.FIELD); }
    if (GR() < treesOn * (nearWater ? 1.4 : 0.6)) for (let k = 0; k < 1 + Math.floor(GR() * 2); k++) plant(x + GR() * 12, y + GR() * 12, zs[0]);
  }
}

function layActivities(X) {
  const { F, culture, seed, frame, hAt, notes, free, claimRect } = X;
  const out = [], land = landOf(culture), AC = stream(seed, 'activities'), inReach = new Set(availableAt(placeOf(culture)).map((r) => r.key));
  for (const a of F.activities || []) if (!activitiesOf(culture, { activities: [a] }, inReach).length) notes.push(`the activity '${a.id}' is left out: ${(a.cites || []).filter((k) => !inReach.has(k)).length ? `${(a.cites || []).filter((k) => !inReach.has(k)).join(', ')} not yet in reach at the town's year` : 'its kit lacks a piece'}`);
  for (const a of activitiesOf(culture, F, inReach)) {
    const K2 = (a.kit === 'farm' ? FARM_CULTURES : WORKS_CULTURES)[land];
    const sizes = a.pieces.map((p) => envelopeMid(K2.assets[p]));
    // the yard: the pieces in two rows round a court, 4 m apart
    const half = Math.ceil(sizes.length / 2), rowsP = [sizes.slice(0, half), sizes.slice(half)];
    const yw = Math.max(...rowsP.map((rw) => rw.reduce((s, [w]) => s + w + 4, 0))) + 4, yd = Math.max(...rowsP[0].map((q) => q[1])) + Math.max(0, ...rowsP[1].map((q) => q[1])) + 14;
    const score = ACTIVITY_WHERE[a.where].score;
    let best = null;
    for (let y = 4; y + yd < frame.d - 4; y += CELL * 3) for (let x = 4; x + yw < frame.w - 4; x += CELL * 3) {
      const r = { x, y, w: yw, d: yd };
      if (!free(grow(r, 2), (v) => v === C.OUTSIDE)) continue;
      const zs = [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.d], [r.x + r.w, r.y + r.d]].map((p) => hAt(...p)); if (Math.max(...zs) - Math.min(...zs) > 1) continue;
      const sc = score(X, x + yw / 2, y + yd / 2, [yw, yd]) + AC() * 4;
      if (!best || sc > best.sc) best = { r, sc };
    }
    if (!best) { notes.push(`no ground for the activity '${a.id}'`); continue; }
    const r = best.r, z = hAt(...centre(r)), pieces = [];
    rowsP.forEach((rw, i) => {
      let x = r.x + 4;
      for (const [k, [w, d]] of rw.entries()) {
        const piece = a.pieces[i * half + k], rect = { x, y: i ? r.y + r.d - d - 2 : r.y + 2, w, d };
        pieces.push({ asset: piece, rect, facing: i ? 'n' : 's', z, activity: a.id, kitOf: a.kit });
        x += w + 4;
      }
    });
    claimRect(r, C.HOUSE);
    out.push({ id: a.id, read: a.read, kit: a.kit, rect: r, centre: centre(r), pieces });
  }
  return out;
}
