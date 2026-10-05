/**
 * historic/historic-region — a historic city in its land: the walled town (./historic-city.js) at the
 * middle of a larger frame, and around it the places that fed it and made its things, zoned by what
 * each needs:
 *   - roads leave by the gates;
 *   - the town's canal runs on past the walls both ways;
 *   - upstream on it, where the water is clean and the clay is good, the brick and pottery quarter:
 *     clay pits sunk at the bank, mixing pits, brick fields and hacks, brick kilns, potters' yards and
 *     their kilns, a wheelwright;
 *   - downstream, below the town, the harbour (the Sumerian kar): stone and bitumen landed at
 *     quays, the merchants' storehouses, the bitumen boilers, the coppersmiths with their charcoal
 *     clamps, all kept out of the town for the fire and the smoke;
 *   - palm gardens along the canal near the walls;
 *   - strip fields on channels north and south, with the estates' farmsteads among them (house,
 *     storehouse, threshing floor, byre);
 *   - the reed marsh where the canal runs out;
 *   - sheepfolds on the steppe at the edge of the watered land.
 * People and beasts are left out, as in the farmstead and the works.
 *
 * The town is planned bare outside its ring (`countryside: false`) and shifted into place; the region's
 * pieces are slots built by the works kit (town + farm + works). Plans in metres. Pure and deterministic.
 */
import { planHistoricCity, canalBankN, toScene, groundsToScene, emitHistoric, METRES_PER_UNIT, SCENE_LIGHT } from './historic-city.js';
import { WORKS_CULTURES } from './workshops.js';
import { canalGround, tileGround, standingCrop } from './farmstead.js';
import { palm } from './patterns.js';
import { placeAsset, skinFor } from './assets/kit.js';
import { assembleBoxCityScene } from '../scene/scene-css3d.js';
import { scaleHex } from '../polygonizer/vexar.js';

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
const stream = (seed, tag) => mulberry32(hash(`${seed}|region|${tag}`));

/** Each culture's region: the works culture (town, farm and works kits, the palette) and the crops of a season. */
export const REGION_CULTURES = {
  sumer: {
    ...WORKS_CULTURES.sumer,
    label: 'a Sumerian city and its land',
    town: { w: 384, d: 288 },                   // the town's own frame (a multiple of the 4 m ground columns)
    downstream: 'e',                            // the canal runs east toward the marsh
    // the strips of a season, by share
    crops: { harvest: [['ripe', 0.38], ['stubble', 0.32], ['fallow', 0.3]], sowing: [['furrows', 0.4], ['sown', 0.3], ['fallow', 0.3]] },
  },
};

/** Move a planned mass or ground by (dx, dy): its rect and whatever points it carries. */
function shifted(b, dx, dy) {
  const o = { ...b, x: b.x + dx, y: b.y + dy };
  if (b.top) o.top = { ...b.top, x: b.top.x + dx, y: b.top.y + dy };
  if (b.a) o.a = [b.a[0] + dx, b.a[1] + dy, b.a[2]];
  if (b.b) o.b = [b.b[0] + dx, b.b[1] + dy, b.b[2]];
  if (b.pts) o.pts = b.pts.map(([x, y, z]) => [x + dx, y + dy, z]);
  if (b.poly) o.poly = b.poly.map(([x, y]) => [x + dx, y + dy]);
  return o;
}

export function planRegion({ seed = 1, culture = 'sumer', season = 'harvest', frame = { w: 880, d: 660 } } = {}) {
  const R = REGION_CULTURES[culture] || REGION_CULTURES.sumer, K = R.culture, P = R.palette, kit = R.assets;
  const W = frame.w, D = frame.d, L = stream(seed, 'layout');
  const slots = [], boxes = [], grounds = [], taken = [];

  // ── 1. the town, bare outside its ring, set at the middle of the frame on the 4 m ground columns ──
  const town = planHistoricCity({ seed, culture, frame: R.town, countryside: false });
  const ox = Math.round((W - town.frame.w) / 2 / 4) * 4, oy = Math.round((D - town.frame.d) / 2);
  const T = { x: ox, y: oy, w: town.frame.w, d: town.frame.d };
  const tb = canalBankN(town.canal), bankN = (x) => oy + tb(x - ox), cw = town.canal.width, bankS = (x) => bankN(x) + cw, waterZ = -town.canal.sink;
  const { cols, rows, cell, data, codes } = town.grid;
  // a rect is clear of the town when every town cell it touches (and `m` cells round it) is open country
  const clearOfTown = (r, m = 0) => {
    if (r.x + r.w <= T.x || r.x >= T.x + T.w || r.y + r.d <= T.y || r.y >= T.y + T.d) return true;
    const c0 = Math.floor((r.x - T.x) / cell) - m, c1 = Math.floor((r.x + r.w - T.x) / cell) + m, r0 = Math.floor((r.y - T.y) / cell) - m, r1 = Math.floor((r.y + r.d - T.y) / cell) + m;
    for (let rr = r0; rr <= r1; rr++) for (let c = c0; c <= c1; c++) if (c >= 0 && rr >= 0 && c < cols && rr < rows && data[rr * cols + c] !== codes.OUTSIDE) return false;
    return true;
  };
  const clearOfCanal = (r, m) => { for (let x = r.x; x <= r.x + r.w + 1e-6; x += Math.max(1, r.w / 6)) if (r.y < bankS(x) + m && r.y + r.d > bankN(x) - m) return false; return true; };
  const overlaps = (a, b, m = 0) => a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.d + m && b.y < a.y + a.d + m;
  const free = (r, m = 2, wall = 4, bank = 3) => r.x >= 2 && r.y >= 2 && r.x + r.w <= W - 2 && r.y + r.d <= D - 2 && clearOfCanal(r, bank) && clearOfTown(r, wall) && !taken.some((t) => overlaps(r, t, m));
  const place = (asset, rect, facing, o = {}) => { slots.push({ asset, rect, facing, ...o }); taken.push(rect); return rect; };
  const tryPlace = (asset, rect, facing, o, m, bank) => (free(rect, m, 4, bank) ? place(asset, rect, facing, o) : null);
  // the run of the canal's banks under a span of x
  const northEdge = (x, w) => Math.min(...[0, 0.25, 0.5, 0.75, 1].map((f) => bankN(x + w * f)));
  const southEdge = (x, w) => Math.max(...[0, 0.25, 0.5, 0.75, 1].map((f) => bankS(x + w * f)));

  // ── 2. roads out of the gates, straight to the frame's edge (a road stops at the canal: no bridge out here) ──
  const roads = [];
  for (const g of town.slots.filter((q) => q.asset === 'city-gate')) {
    const r = shifted(g.rect, ox, oy), cx = r.x + r.w / 2, cy = r.y + r.d / 2, hw = 3;
    const seg = { n: { x: cx - hw, y: 0, w: 2 * hw, d: r.y }, s: { x: cx - hw, y: r.y + r.d, w: 2 * hw, d: D - r.y - r.d }, w: { x: 0, y: cy - hw, w: r.x, d: 2 * hw }, e: { x: r.x + r.w, y: cy - hw, w: W - r.x - r.w, d: 2 * hw } }[g.facing];
    // cut where it would cross the canal: keep the part next to the gate
    let rd = seg;
    if (!clearOfCanal(seg, 2)) {
      if (g.facing === 'n') rd = { ...seg, y: Math.max(...[seg.x, seg.x + seg.w].map(bankS)) + 3, d: r.y - Math.max(...[seg.x, seg.x + seg.w].map(bankS)) - 3 };
      else if (g.facing === 's') rd = { ...seg, d: Math.min(...[seg.x, seg.x + seg.w].map(bankN)) - 3 - seg.y };
      else continue;
    }
    if (rd.w > 4 && rd.d > 4) { roads.push(rd); taken.push(rd); }
  }

  // ── 3. upstream: the brick and pottery quarter on both banks ──
  const up = R.downstream === 'e' ? [36, T.x - 18] : [T.x + T.w + 18, W - 36];
  const Q = stream(seed, 'quarter');
  // a row of pieces along a bank, left to right from x0, `back` metres from the water
  const row = (list, x0, x1, bank, back = 3) => {
    let x = x0;
    for (const [asset, w, d, facing, o] of list) {
      if (x + w > x1) break;
      const xs = asset === 'clay-pit' ? Math.ceil(x / 4) * 4 : x;   // a sunk pit sits on the ground's 4 m columns
      const y = bank === 'n' ? northEdge(xs, w) - back - d : southEdge(xs, w) + back;
      tryPlace(asset, { x: xs, y, w, d }, facing, o || {}, 1);
      x = xs + w + 3 + Q() * 4;
    }
  };
  // north bank: clay at the water, the brick fields and kilns behind it
  row([['clay-pit', 20, 11, 'n'], ['clay-mixing', 11, 7, 'n'], ['brick-kiln', 10, 10, 's'], ['clay-pit', 16, 10, 'n'], ['clay-mixing', 11, 7, 'n'], ['brick-kiln', 10, 10, 's'], ['clay-pit', 20, 11, 'n'], ['clay-mixing', 11, 7, 'n']], up[0], up[1], 'n', 4);
  row([['brick-field', 30, 16, 'n'], ['brick-hacks', 12, 7, 'n'], ['brick-hacks', 12, 7, 'n'], ['brick-field', 30, 16, 'n'], ['brick-hacks', 12, 7, 'n'], ['brick-field', 28, 16, 'n'], ['brick-hacks', 12, 7, 'n']], up[0] + 4, up[1], 'n', 22);
  // south bank: the potters, their kilns beside them, and the wheelwright on the road
  row([['potters-yard', 16, 12, 'n'], ['pottery-kiln', 4.5, 4.5, 'n'], ['pottery-kiln', 4.5, 4.5, 'n'], ['potters-yard', 16, 12, 'n'], ['pottery-kiln', 4.5, 4.5, 'n'], ['pottery-kiln', 4.5, 4.5, 'n'], ['wheelwright', 15, 11, 'n'], ['potters-yard', 16, 12, 'n'], ['pottery-kiln', 4.5, 4.5, 'n']], up[0] + 10, up[1], 's', 4);
  const quarterRect = { x: up[0], y: northEdge(up[0], up[1] - up[0]) - 44, w: up[1] - up[0], d: southEdge(up[0], up[1] - up[0]) + 24 - northEdge(up[0], up[1] - up[0]) + 44 };

  // ── 4. downstream: the harbour, then the marsh where the canal runs out ──
  const hb = R.downstream === 'e' ? [T.x + T.w + 14, T.x + T.w + 150] : [T.x - 150, T.x - 14];
  // quays on both banks with boats at them; storehouses behind the north quays; on the south, the
  // bitumen boilers and the coppersmiths with their clamps
  const quay = (x, bank) => {
    const y = bank === 'n' ? northEdge(x, 18) - 9.2 : southEdge(x, 18) + 0.2;
    const r = tryPlace('stone-landing', { x, y, w: 18, d: 9 }, bank === 'n' ? 's' : 'n', { waterZ }, 1, -0.3);   // a quay stands at the water
    if (r) place('reed-boat', { x: x + 4, y: bank === 'n' ? northEdge(x + 4, 10) + 1.4 : southEdge(x + 4, 10) - 3.7, w: 10, d: 2.3 }, bank === 'n' ? 's' : 'n', { z: waterZ - 0.3 });
    return r;
  };
  quay(hb[0] + 4, 'n'); quay(hb[0] + 30, 'n'); quay(hb[0] + 10, 's');
  row([['storehouse', 14, 8, 's'], ['storehouse', 14, 8, 's'], ['wagon', 2.1, 3.8, 's'], ['storehouse', 14, 8, 's'], ['storehouse', 14, 8, 's']], hb[0] + 2, hb[1], 'n', 13);
  row([['bitumen-works', 9, 7, 'n'], ['copper-workshop', 15, 12.5, 'n'], ['charcoal-clamp', 5.5, 5.5, 'n'], ['charcoal-clamp', 5.5, 5.5, 'n', { opened: true }], ['copper-workshop', 15, 12.5, 'n'], ['charcoal-clamp', 5.5, 5.5, 'n']], hb[0] + 34, hb[1], 's', 4);
  row([['bitumen-works', 9, 7, 'n'], ['storehouse', 14, 8, 'n'], ['storehouse', 14, 8, 'n']], hb[0] + 4, hb[1], 's', 22);
  // the marsh: reed beds either side of the water, the cutters' grounds and reed houses at its edge
  const mx0 = R.downstream === 'e' ? hb[1] + 20 : 0, mx1 = R.downstream === 'e' ? W : hb[0] - 20;
  const marsh = { x: mx0, y: northEdge(mx0, mx1 - mx0) - 70, w: mx1 - mx0, d: southEdge(mx0, mx1 - mx0) + 70 - northEdge(mx0, mx1 - mx0) + 70 };
  grounds.push({ kind: 'marsh', ...marsh, z: 0.02, fill: P.marsh, surface: 'mud', layer: 1 });
  taken.push(marsh);
  const RB = stream(seed, 'reeds');
  for (const bank of ['n', 's']) for (let x = mx0 + 4; x < mx1 - 20; x += 22 + RB() * 14) {
    const w = 12 + RB() * 10, d = 14 + RB() * 22, y = bank === 'n' ? northEdge(x, w) - 2 - d : southEdge(x, w) + 2;
    reedBed({ x, y, w, d }, RB, P, boxes, grounds);
  }
  for (const [k, bank] of [[0, 'n'], [1, 's']]) {
    const x = mx0 + 10 + k * 40, y = bank === 'n' ? northEdge(x, 12) - 50 : southEdge(x, 12) + 43;
    place('reed-store', { x, y, w: 12, d: 7 }, 'n');
    place('reed-house', { x: x + 16, y, w: 6, d: 11 }, bank === 'n' ? 's' : 'n');
  }

  // ── 5. palm gardens along the canal by the walls, beds under the palms ──
  const G = stream(seed, 'gardens'), gardens = [];
  for (const bank of ['n', 's']) for (let x = 6; x < W - 6; x += 9) {
    if (x > marsh.x - 10 && x < marsh.x + marsh.w) continue;
    const near = Math.min(Math.abs(x - T.x), Math.abs(x - T.x - T.w), x > T.x && x < T.x + T.w ? 0 : 1e9);
    if (near > 70) continue;
    for (let k = 0; k < 3; k++) {
      const y = bank === 'n' ? northEdge(x, 8) - 6 - 9 * (k + 1) : southEdge(x, 8) + 6 + 9 * k, r = { x, y, w: 8, d: 8 };
      if (!free(r, 0.5, 3)) continue;
      taken.push(r); gardens.push(r);
      if (G() < 0.7) grounds.push({ kind: 'garden', x: x + 1.5, y: y + 1.5, w: 5, d: 5, z: 0.03, fill: P.garden, surface: 'sown', layer: 2 });
      boxes.push(palm(x + 2 + G() * 4, y + 2 + G() * 4, G));
    }
  }

  // ── 6. the estates: farmsteads out in the fields north and south ──
  const farm = (x, y) => {
    const box = { x, y, w: 58, d: 46 };
    if (!free(box, 8)) return false;
    taken.push(box);
    slots.push({ asset: 'farmhouse', rect: { x, y, w: 20, d: 17 }, facing: 's' });
    slots.push({ asset: 'storehouse', rect: { x: x + 24, y: y + 4, w: 14, d: 8 }, facing: 's' });
    slots.push({ asset: 'tool-shed', rect: { x: x + 40, y: y + 8, w: 6, d: 3.6 }, facing: 's' });
    slots.push({ asset: 'threshing-floor', rect: { x, y: y + 23, w: 21, d: 21 }, facing: 'n' });
    slots.push({ asset: 'reed-byre', rect: { x: x + 26, y: y + 18, w: 8.5, d: 17 }, facing: 'n' });
    slots.push({ asset: 'sheepfold', rect: { x: x + 39, y: y + 22, w: 16, d: 12 }, facing: 'n' });
    grounds.push({ kind: 'yard', x: x - 2, y: y - 2, w: 62, d: 50, z: 0.025, fill: P.lane, surface: 'mud', layer: 2 });
    return true;
  };
  const F = stream(seed, 'farms');
  let farms = 0;
  for (const [fx, fy] of [[0.12, 0.1], [0.62, 0.06], [0.3, 0.84], [0.8, 0.86], [0.86, 0.14], [0.08, 0.8]]) {
    if (farms >= 4) break;
    if (farm(Math.round(W * fx + (F() - 0.5) * 30), Math.round(D * fy + (F() - 0.5) * 20))) farms++;
  }
  // sheepfolds on the steppe at the frame's edge, past the last fields
  for (const [fx, top] of [[0.42, true], [0.55, false]]) tryPlace('sheepfold', { x: W * fx, y: top ? 4 : D - 16, w: 16, d: 12 }, top ? 's' : 'n', {}, 2);

  // ── 7. the strip fields: everything left in the watered land, in strips on channels across the canal ──
  const crops = R.crops[season] || R.crops.harvest, FL = stream(seed, 'fields');
  const cropOf = () => { let u = FL(); for (const [c, p] of crops) { if ((u -= p) < 0) return c; } return crops[0][0]; };
  const pitch = 34, chan = 1.4, edge = 26;
  for (let x0 = 6; x0 < W - 6; x0 += pitch) {
    // a channel down the strip's west side, and the strip beside it, cut where anything stands in the way
    for (const [y0, y1] of [[edge, null], [null, D - edge]]) {
      const top = y0 ?? null;
      const ys = top !== null ? [top, northEdge(x0, pitch) - 6] : [southEdge(x0, pitch) + 6, y1];
      let y = ys[0], crop = cropOf(), run = null;
      const flush = (yEnd) => {
        if (!run || yEnd - run < 8) { run = null; return; }
        const f = { x: x0 + chan + 0.8, y: run, w: pitch - chan - 1.6, d: yEnd - run };
        grounds.push({ kind: 'channel', x: x0, y: run, w: chan, d: yEnd - run, z: 0.05, fill: scaleHex(P.water, 1.08), layer: 1 });
        if (crop === 'ripe') standingCrop(f, 0.95, P, boxes, grounds);
        else grounds.push({ kind: 'field', ...f, z: 0.02, fill: { stubble: P.fallow, fallow: P.fallow, furrows: P.tilled, sown: P.tilled }[crop], surface: { stubble: 'stubble', fallow: 'dry-earth', furrows: 'furrows', sown: 'sown' }[crop], layer: 1 });
        crop = cropOf(); run = null;
      };
      for (; y < ys[1] - 4; y += 4) {
        const ok = free({ x: x0, y, w: pitch, d: 4 }, 0.5, 3);
        if (ok && run === null) run = y;
        if (!ok) flush(y);
        else if (y - run > 70 + FL() * 60) { flush(y); run = y + 2; y += 2; }   // a strip runs ~70–130 m, then a bund and the next
      }
      flush(y);
    }
  }

  // ── 8. tracks to the works and the farms from the roads, the levee path along the canal ──
  for (const r of roads) grounds.push({ kind: 'road', ...r, z: 0.03, fill: P.lane, surface: 'mud', layer: 2 });
  for (const bank of ['n', 's']) for (let x = 0; x < W; x += 8) {
    if (x + 8 > T.x && x < T.x + T.w) continue;
    const y = bank === 'n' ? northEdge(x, 8) - 4 : southEdge(x, 8) + 0.5, r = { x, y, w: 8.15, d: 3.5 };
    if (slots.some((q) => overlaps(q.rect, r, -0.01))) continue;   // the path goes round what stands at the bank
    grounds.push({ kind: 'track', ...r, z: 0.026, fill: P.lane, surface: 'mud', layer: 2 });
  }

  // ── 9. build the region's slots from the kit, then bring in the town ──
  for (const [i, slot] of slots.entries()) {
    const A = kit[slot.asset];
    if (!A) throw new Error(`no asset '${slot.asset}' in the ${culture} region kit`);
    const placed = placeAsset(A, slot, { palette: P, culture: K, rng: stream(seed, `asset|${i}`) });
    boxes.push(...placed.boxes); grounds.push(...placed.grounds.map((g) => ({ ...g, layer: g.layer ?? 4 })));
  }
  for (const b of boxes) if (b.skin === undefined) { const skin = skinFor(K, b); if (skin) b.skin = skin; }
  boxes.push(...town.boxes.map((b) => shifted(b, ox, oy)));

  // ── 10. the ground: the region's earth and canal round the town's frame, the town's own ground in it ──
  const C0 = canalGround({ W, D, bankN, cw, waterZ, P, holes: [T, ...slots.filter((q) => kit[q.asset].sunk).map((q) => q.rect)], skip: [T.x, T.x + T.w] });
  boxes.push(...C0.boxes);
  grounds.sort((a, b) => (a.layer ?? 4) - (b.layer ?? 4));
  const all = [...C0.base, ...C0.grounds, ...town.grounds.map((g) => shifted(g, ox, oy)), ...grounds];

  // ── 11. views ──
  const pc = shifted(town.stats.precinct, ox, oy), tcx = T.x + T.w / 2;
  const kilns = slots.filter((q) => q.asset === 'brick-kiln').map((q) => q.rect), quays = slots.filter((q) => q.asset === 'stone-landing').map((q) => q.rect);
  const k0 = kilns[0], q0 = quays[0];
  // the ripe field 100–200 m south of the walls nearest the town's axis: stand at its far edge
  const ripe = grounds.filter((g) => g.kind === 'crop' && g.y > T.y + T.d + 90 && g.y < T.y + T.d + 200).sort((a, b) => Math.abs(a.x + a.w / 2 - tcx) - Math.abs(b.x + b.w / 2 - tcx))[0];
  const fe = ripe ? [ripe.x + ripe.w / 2, ripe.y + ripe.d + 1.5] : [tcx - 30, T.y + T.d + 140];
  const views = {
    // out in the southern fields at the edge of the standing barley, looking north over it to the walls and the ziggurat
    fields: { eye: [fe[0], fe[1], 2.2], at: [pc.x + pc.w / 2, pc.y + pc.d / 2, 16] },
    ...(q0 ? { harbour: { eye: [q0.x + q0.w + 6, q0.y + 4, 2.2], at: [T.x + T.w - 20, bankN(T.x + T.w) + cw / 2, 5] } } : {}),
    // in the brick quarter by a kiln, looking down the row of kilns and clay pits along the water to the walls
    ...(k0 ? { kilns: { eye: [k0.x - 7, k0.y + k0.d + 1.2, 1.8], at: [T.x, k0.y + k0.d / 2, 4] } } : {}),
  };
  // close aerials over the two working ends of the town, low and oblique, the walls beyond
  const qz = { x: up[0], x1: up[1] }, hz = { x: hb[0], x1: hb[1] }, mid = (z) => (z.x + z.x1) / 2;
  const dir = R.downstream === 'e' ? 1 : -1;
  views['quarter-air'] = { eye: [mid(qz) - dir * 30, bankS(mid(qz)) + 95, 60], at: [mid(qz) + dir * 20, bankN(mid(qz)), 0] };
  views['harbour-air'] = { eye: [mid(hz) + dir * 40, bankS(mid(hz)) + 85, 55], at: [mid(hz) - dir * 15, bankN(mid(hz)), 0] };
  for (const [name, v] of Object.entries(town.views)) views[`town-${name}`] = { eye: [v.eye[0] + ox, v.eye[1] + oy, v.eye[2]], at: [v.at[0] + ox, v.at[1] + oy, v.at[2]] };

  return {
    boxes, grounds: all, views, slots, frame: { w: W, d: D }, town: T,
    stats: { culture, season, town: town.stats, slots: slots.length, farms, gardens: gardens.length, assets: [...new Set(slots.map((q) => q.asset))], zones: { quarter: quarterRect, harbour: { x: hb[0], w: hb[1] - hb[0] }, marsh } },
  };
}

/** A ragged bed of standing reed: clumps of different heights with water and mud between them. */
function reedBed(r, rng, P, boxes, grounds) {
  for (let cy = r.y; cy < r.y + r.d - 1; cy += 4.6) for (let cx = r.x; cx < r.x + r.w - 1; cx += 4.6) {
    if (rng() < 0.2) continue;
    standingCrop({ x: cx + rng() * 0.8, y: cy + rng() * 0.8, w: Math.min(3.2 + rng() * 2, r.x + r.w - cx), d: Math.min(3.2 + rng() * 2, r.y + r.d - cy) }, 1.9 + rng() * 1.5, P, boxes, grounds, scaleHex(P.reedStand, 0.92 + rng() * 0.22), 'reed-stand', 0.92);
  }
}

const UNIT_SCALE = { aerial: 14, 'quarter-air': 22, 'harbour-air': 22 };

/** Plan → a CSS 3D scene: the whole land from the air, and eye-level views in it, the asked-for view first. */
export function assembleRegionScene(opts = {}) {
  const plan = planRegion(opts);
  const view = plan.views[opts.view] ? opts.view : 'aerial';
  const s = 1 / METRES_PER_UNIT, us = UNIT_SCALE[view] || 40, v = plan.views[view];
  // the small things (jars, baskets, tools, fence posts) are a pixel from the air: from the whole-land
  // view they are left out, from a low aerial or at eye level those far from the eye
  const reach = view === 'aerial' ? 0 : v && v.eye[2] > 20 ? 120 : 80;
  const small = (b) => Math.max(b.w, b.d, b.z1 - b.z0) < 1.0;
  // at eye level, what lies behind the camera is left out, and a ground that reaches behind it goes
  // out as tiles (4 m within 30 m of the eye, 12 m beyond), only those ahead kept: a face reaching
  // behind the eye drops out of the page, and a page of tens of thousands of tiles drops more
  let ahead = () => 1;
  if (v && view !== 'aerial') {
    const fx = v.at[0] - v.eye[0], fy = v.at[1] - v.eye[1], fl = Math.hypot(fx, fy) || 1;
    ahead = (x, y) => ((x - v.eye[0]) * fx + (y - v.eye[1]) * fy) / fl;
  }
  const span = (g) => { const a = [ahead(g.x, g.y), ahead(g.x + g.w, g.y), ahead(g.x, g.y + g.d), ahead(g.x + g.w, g.y + g.d)]; return [Math.min(...a), Math.max(...a)]; };
  const kept = plan.boxes.filter((b) => span(b)[1] > -4 && (!small(b) || (v && Math.hypot(b.x + b.w / 2 - v.eye[0], b.y + b.d / 2 - v.eye[1]) < reach)));
  const { boxes, faces } = toScene(kept, s, us);
  const dist2 = (g) => Math.max(g.x - v.eye[0], v.eye[0] - g.x - g.w, 0) ** 2 + Math.max(g.y - v.eye[1], v.eye[1] - g.y - g.d, 0) ** 2;
  const near = (g) => dist2(g) < 900;
  // and only the ground within `far` of the eye: past it the land is a hair under the horizon, and a
  // whole land's ground at eye-level raster runs the page out of texture memory (tiles drop at random)
  const far = view === 'aerial' ? Infinity : v.eye[2] > 20 ? 420 : 220, E = v && { x: v.eye[0] - far, y: v.eye[1] - far, x1: v.eye[0] + far, y1: v.eye[1] + far };
  const clip = (g) => { const x = Math.max(g.x, E.x), y = Math.max(g.y, E.y), x1 = Math.min(g.x + g.w, E.x1), y1 = Math.min(g.y + g.d, E.y1); return x1 > x && y1 > y ? [{ ...g, x, y, w: x1 - x, d: y1 - y }] : []; };
  const grounds = view === 'aerial' ? plan.grounds : plan.grounds.flatMap((g) => (g.poly ? (g.poly.some(([x, y]) => Math.abs(x - v.eye[0]) < far && Math.abs(y - v.eye[1]) < far) ? [g] : []) : clip(g))).flatMap((g) => {
    if (g.poly) return g.poly.some(([x, y]) => ahead(x, y) > -2) ? [g] : [];
    const [lo, hi] = span(g);
    if (hi < -2) return [];
    // whole only when well ahead and away: a long face passing close across the view breaks the
    // page's projection as surely as one reaching behind it
    if (lo > 1 && dist2(g) > 3600) return [g];
    return tileGround(g, near(g) ? 4 : 12).filter((t) => span(t)[1] > -2);
  });
  const G = groundsToScene(grounds, s, us);
  faces.unshift(...G.faces);
  const W = plan.frame.w * s, Dd = plan.frame.d * s;
  const cameras = [{ name: 'aerial', worldFraming: { cameraPosition: [W * 0.5, Dd * 1.22, Math.max(W, Dd) * 0.6], lookAt: [W * 0.5, Dd * 0.44, 0], horizontalFov: 66, pictureCenter: [560, 390] } }];
  for (const [name, v] of Object.entries(plan.views)) cameras.push({ name, worldFraming: { cameraPosition: v.eye.map((q) => q * s), lookAt: v.at.map((q) => q * s), horizontalFov: 74, pictureCenter: [560, 390] } });
  const first = cameras.findIndex((c) => c.name === view);
  if (first > 0) cameras.unshift(...cameras.splice(first, 1));
  if (view !== 'aerial') cameras.splice(1);   // a page culled to one view carries only that camera
  const scene = assembleBoxCityScene({ boxes, grounds: G.grounds, faces, cameras, title: `mojulo historic region · ${plan.stats.culture} · ${plan.stats.season}`, bg: '#d9cdb4', light: SCENE_LIGHT, unitScale: us });
  return { ...scene, stats: plan.stats };
}

export function renderRegionToHtml(opts = {}) {
  return emitHistoric(assembleRegionScene(opts));
}
