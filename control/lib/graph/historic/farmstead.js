/**
 * historic/farmstead — a sub-scene of a historic city: the countryside that feeds it, and the tools
 * and buildings it is worked with. Where the town shows what a civilisation built, this shows what
 * it could MAKE and GROW: a canal leading water through sluices into channels on low banks, long strip
 * fields between them at the work of the season, and a farmstead off in the fields — house and yard,
 * storehouse, stable, byre, sheepfold, threshing floor, tool shed, a shaduf on the bank — with the
 * ploughs, carts, sledges and sickles of the estate set down where the work is. People and beasts
 * are left out: they are drawn by their own builders and placed over this scene.
 *
 * Same contract as the town (./historic-city.js): the layout emits SLOTS, the culture's kit builds
 * each one on its own dressing stream, and the scene goes out through the same emitters. Plans in
 * metres. Pure and deterministic.
 *
 * `season`: 'harvest' (the default — late spring: barley standing and being reaped, sheaves stooked
 * and carted, the threshing floor busy, a fallow strip broken with the ard for the next year) or
 * 'sowing' (autumn: the seeder plough in the furrow, fields furrowed and sprouting, the floor swept bare).
 * The two are kept apart because a Sumerian year kept them apart.
 */
import { SUMER } from './cultures/sumer.js';
import { SUMER_FARM_ASSETS } from './assets/sumer-farm.js';
import { palm } from './patterns.js';
import { placeAsset, skinFor } from './assets/kit.js';
import { toScene, groundsToScene, emitHistoric, METRES_PER_UNIT, SCENE_LIGHT } from './historic-city.js';
import { assembleBoxCityScene } from '../scene/scene-css3d.js';
import { scaleHex } from '../polygonizer/vexar.js';

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
const stream = (seed, tag) => mulberry32(hash(`${seed}|farmstead|${tag}`));

/** Each culture's countryside: its town culture, the farm kit beside the town kit, and the farm's colours and scale. */
export const FARM_CULTURES = {
  sumer: {
    culture: SUMER,
    label: 'a Sumerian temple estate',
    assets: { ...SUMER.assets, ...SUMER_FARM_ASSETS },
    palette: {
      ...SUMER.palette,
      wool: '#e3d8bf',
      cloth: '#d8cdb2',                         // undyed wool and linen
      wood: '#7a6146',                          // poplar, tamarisk, palm
      grain: '#d8b65e',                         // ripe barley
      straw: '#c9b27a',
      chaff: '#e2cf96',
      tilled: '#8d7454',                        // fresh-turned alluvium
      fallow: '#b39c78',
      floor: '#b8a27c',                         // the threshing floor's beaten earth
      garden: '#6f8a45',
    },
    canal: { width: 10, sink: 1.0 },            // the branch canal the estate draws from; water 1 m under its banks
    fields: { channels: 6, pitch: 34, bank: 1.2, channel: 1.4 },   // field channels across the canal's line, their spacing (m)
  },
};

/**
 * The fields at the work of a season: one entry per strip, in order west to east (the layout shuffles
 * them on its own stream). `crop` is what covers the strip; the other keys are the work going on.
 */
const SEASON_FIELDS = {
  harvest: [{ crop: 'ripe', reapers: true }, { crop: 'stubble', stooks: true, cart: true }, { crop: 'ripe' }, { crop: 'fallow', plough: 'ard' }, { crop: 'stubble', stooks: true }],
  sowing: [{ crop: 'furrows', plough: 'seeder' }, { crop: 'sown' }, { crop: 'sown' }, { crop: 'fallow' }, { crop: 'furrows' }],
};

export function planFarmstead({ seed = 1, culture = 'sumer', season = 'harvest', frame = { w: 270, d: 196 }, assets } = {}) {
  const F = FARM_CULTURES[culture] || FARM_CULTURES.sumer, K = F.culture, P = F.palette, kit = assets || F.assets;
  const L = stream(seed, 'layout'), slots = [], boxes = [], grounds = [];
  const W = frame.w, D = frame.d;

  // ── 1. the branch canal along the north, a gentle meander; the levee track along its south bank ──
  const cw = F.canal.width, sink = F.canal.sink, waterZ = -sink, c0 = 16 + L() * 4, amp = 1.5 + L() * 1.5, ph = L() * 6.283;
  const bankN = (x) => c0 + amp * Math.sin((x / W) * 6.283 * 0.7 + ph), bankS = (x) => bankN(x) + cw;
  const southMax = Math.max(...Array.from({ length: 28 }, (_, i) => bankS((i / 27) * W)));
  const track = { y: southMax + 1, d: 5 };   // the levee track
  const fieldTop = track.y + track.d + 1.5, fieldBot = D - 8;

  // ── 2. field channels on low banks, each leaving the canal through a sluice; strip fields between ──
  const FS = F.fields, chX = Array.from({ length: FS.channels }, (_, k) => 8 + k * FS.pitch + (L() - 0.5) * 3);
  const farmX = chX[chX.length - 1] + 6;   // the farmstead takes the ground east of the last channel
  for (const x of chX) {
    const c = FS.channel, b = FS.bank, y0 = bankS(x) - 0.6;
    for (const o of [-1, 1]) boxes.push({ kind: 'channel-bank', solid: 'frustum', x: o < 0 ? x - c / 2 - b : x + c / 2, y: y0 + 2, w: b, d: fieldBot - y0 - 2, z0: 0, z1: 0.4, top: { x: o < 0 ? x - c / 2 - b * 0.5 : x + c / 2, y: y0 + 2, w: b * 0.5, d: fieldBot - y0 - 2 }, tint: scaleHex(P.ground, 0.92) });
    grounds.push({ kind: 'channel', x: x - c / 2, y: y0, w: c, d: fieldBot - y0, z: 0.3, fill: scaleHex(P.water, 1.08), layer: 3 });
    slots.push({ asset: 'sluice', rect: { x: x - 2, y: y0 + 0.2, w: 4, d: 1.8 }, facing: 'n' });
  }
  const order = [...SEASON_FIELDS[season] || SEASON_FIELDS.harvest];
  const FL = stream(seed, 'fields');
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(FL() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const fields = [];
  for (let k = 0; k < chX.length - 1 && k < order.length; k++) {
    const x0 = chX[k] + FS.channel / 2 + FS.bank + 0.4, x1 = chX[k + 1] - FS.channel / 2 - FS.bank - 0.4;
    fields.push({ ...order[k], rect: { x: x0, y: fieldTop, w: x1 - x0, d: fieldBot - fieldTop } });
  }
  const DR = stream(seed, 'work');
  const crop = { furrows: ['furrows', P.tilled], sown: ['sown', P.tilled], stubble: ['stubble', P.fallow], fallow: ['dry-earth', P.fallow] };
  for (const f of fields) {
    const r = f.rect;
    if (f.crop === 'ripe') {
      // standing barley, waist high: a lit top and sides; where the reaping has reached, the cut part is stubble
      const cut = f.reapers ? r.y + r.d * (0.3 + DR() * 0.2) : r.y;
      if (cut > r.y) grounds.push({ kind: 'field', x: r.x, y: r.y, w: r.w, d: cut - r.y, z: 0.02, fill: P.fallow, surface: 'stubble', layer: 1 });
      standingCrop({ x: r.x, y: cut, w: r.w, d: r.y + r.d - cut }, 0.95, P, boxes, grounds);
      if (f.reapers) {
        const gw = Math.min(16, r.w - 4), gx = r.x + 2 + DR() * (r.w - gw - 4);
        slots.push({ asset: 'harvest-edge', rect: { x: gx, y: cut - 6, w: gw, d: 6 }, facing: 's' });
        for (let y = r.y + 4; y < cut - 9; y += 7) for (let x = r.x + 3; x < r.x + r.w - 3; x += 7 + DR() * 2) slots.push({ asset: 'stook', rect: { x: x + DR(), y: y + DR(), w: 1.7, d: 1.7 }, facing: 'n' });
      }
      continue;
    }
    let done = r.w * 0.5;
    if (f.crop === 'fallow' && f.plough) {
      // the ard has broken the west part of the strip, pass by pass along its length
      done = r.w * (0.35 + DR() * 0.3);
      grounds.push({ kind: 'field', x: r.x, y: r.y, w: done, d: r.d, z: 0.02, fill: P.tilled, surface: 'furrows', layer: 1 });
      grounds.push({ kind: 'field', x: r.x + done, y: r.y, w: r.w - done, d: r.d, z: 0.02, fill: P.fallow, surface: 'dry-earth', layer: 1 });
    } else {
      const [surface, fill] = crop[f.crop];
      grounds.push({ kind: 'field', ...r, z: 0.02, fill, surface, layer: 1 });
    }
    if (f.plough) {
      const px = f.crop === 'fallow' ? r.x + done : r.x + r.w * (0.3 + DR() * 0.4), py = r.y + r.d * (0.3 + DR() * 0.35);
      slots.push({ asset: 'plough', rect: { x: px - 1.6, y: py, w: 3.2, d: 9 }, facing: 'n', seeder: f.plough === 'seeder' });
    }
    if (f.stooks) for (let y = r.y + 5; y < r.y + r.d - 5; y += 8) for (let x = r.x + 3; x < r.x + r.w - 3; x += 8 + DR() * 2) if (!(f.cart && x > r.x + r.w / 2 - 4 && x < r.x + r.w / 2 + 4)) slots.push({ asset: 'stook', rect: { x: x + DR(), y: y + DR(), w: 1.7, d: 1.7 }, facing: 'n' });
    if (f.cart) slots.push({ asset: 'farm-cart', rect: { x: r.x + r.w / 2 - 1.3, y: r.y + r.d * 0.45, w: 2.6, d: 7.4 }, facing: 'n' });
  }

  // ── 3. the farmstead, off in the fields to the east: the yard in the middle, the buildings round it ──
  const fx = farmX, fw = W - fx - 4, J = () => (L() - 0.5) * 2;
  const yard = { x: fx + 14, y: fieldTop + 20, w: 32, d: 30 };
  grounds.push({ kind: 'yard', ...yard, z: 0.03, fill: P.lane, surface: 'mud', layer: 2 });
  const place = (asset, rect, facing, o = {}) => { slots.push({ asset, rect, facing, ...o }); return rect; };
  // the house on the north side of the yard, its gate toward it; the tool shed beside it
  const house = place('farmhouse', { x: yard.x + 1.5 + J(), y: fieldTop + 1, w: 20, d: 17 }, 's');
  place('tool-shed', { x: house.x - 9, y: fieldTop + 13, w: 6, d: 3.6 }, 's');
  // the storehouse on the west side, its door to the yard; the wagon waits by it
  const store = place('storehouse', { x: fx + 2, y: yard.y + 2 + J(), w: 8, d: 14 }, 'e');
  place('wagon', { x: store.x + store.w + 2.5, y: store.y + store.d + 3, w: 2.1, d: 3.8 }, 'n');
  // the stable and the byre on the east side, facing in
  const stableR = place('stable', { x: yard.x + yard.w - 1, y: yard.y + 1 + J(), w: 7, d: 16 }, 'w');
  place('reed-byre', { x: stableR.x - 3, y: stableR.y + stableR.d + 4, w: 17, d: 8.5 }, 'w');
  // the threshing floor south-west of the yard, between the fields and the store; the sheepfold south-east
  const floor = place('threshing-floor', { x: fx + 2, y: yard.y + yard.d + 4, w: 21, d: 21 }, 'n');
  place('sheepfold', { x: yard.x + yard.w - 12, y: yard.y + yard.d + 14, w: 16, d: 12 }, 'n');
  // the farm track: south out of the yard toward the town, and up to the levee
  const tx = yard.x + yard.w * 0.45;
  grounds.push({ kind: 'track', x: tx, y: yard.y + yard.d, w: 5, d: D - yard.y - yard.d, z: 0.025, fill: P.lane, surface: 'mud', layer: 2 });
  grounds.push({ kind: 'track', x: tx, y: track.y, w: 5, d: yard.y - track.y, z: 0.025, fill: P.lane, surface: 'mud', layer: 2 });
  grounds.push({ kind: 'track', x: floor.x + floor.w, y: floor.y + floor.d / 2 - 2.5, w: tx - floor.x - floor.w, d: 5, z: 0.025, fill: P.lane, surface: 'mud', layer: 2 });
  // the shaduf on the canal bank north of the house, lifting into a basin by the track
  const sx = tx + 9;
  place('shaduf', { x: sx, y: bankS(sx + 1.6) + 0.4, w: 3.2, d: 5 }, 'n', { waterZ });
  // a garden of palms south of the sheepfold, beds under them
  const G = stream(seed, 'groves');
  const gy0 = yard.y + yard.d + 30, gx0 = floor.x + floor.w + 8;
  for (let y = gy0; y < D - 6; y += 8) for (let x = gx0; x < W - 6; x += 8) {
    if (x < tx + 8 && x + 6 > tx - 2) continue;
    if (G() < 0.6) grounds.push({ kind: 'garden', x: x - 2.5, y: y - 2.5, w: 5, d: 5, z: 0.03, fill: P.garden, surface: 'sown', layer: 2 });
    boxes.push(palm(x + G() * 3, y + G() * 3, G));
  }
  // palms along the levee
  for (let x = 4; x < W - 4; x += 11 + G() * 8) if (!chX.some((c) => Math.abs(c - x) < 4) && Math.abs(x - sx - 1.6) > 6) boxes.push(palm(x, track.y + track.d + 0.8, G));

  // ── 4. build every slot from the kit, each on its own dressing stream ──
  for (const [i, slot] of slots.entries()) {
    const A = kit[slot.asset];
    if (!A) throw new Error(`no asset '${slot.asset}' in the ${culture} farm kit`);
    const placed = placeAsset(A, slot, { palette: P, culture: K, rng: stream(seed, `asset|${i}`) });
    boxes.push(...placed.boxes); grounds.push(...placed.grounds.map((g) => ({ ...g, layer: g.layer ?? 4 })));
  }
  for (const b of boxes) if (b.skin === undefined) { const skin = skinFor(K, b); if (skin) b.skin = skin; }

  // ── 5. ground: the base earth either side of the canal, the canal sunk between earthen banks, the
  // levee track. Grounds are drawn in layer order (base, fields, yard and tracks, assets) ──
  const C = canalGround({ W, D, bankN, cw, waterZ, P }), base = C.base;
  grounds.push(...C.grounds); boxes.push(...C.boxes);
  grounds.push({ kind: 'track', x: 0, y: track.y, w: W, d: track.d, z: 0.02, fill: P.lane, surface: 'mud', layer: 1 });
  grounds.unshift(...base);
  grounds.sort((a, b) => (a.layer ?? 4) - (b.layer ?? 4));   // stable: within a layer, the order they were laid
  // an eye-level camera drops a face that reaches behind it: big grounds go out as ~12 m tiles (the
  // texture is pinned to world position, so the tiles meet without a seam)
  const tiled = grounds.flatMap((g) => (g.poly ? [g] : tileGround(g, 12)));

  // ── 6. views ──
  const fieldOf = (pred) => fields.find(pred);
  const reap = slots.find((q) => q.asset === 'harvest-edge'), team = slots.find((q) => q.asset === 'plough');
  const views = {
    // in the farmyard, by the wagon, looking south-east across the yard at the byre and the floor
    yard: { eye: [yard.x + 5, yard.y + 6, 1.7], at: [stableR.x, stableR.y + stableR.d + 6, 1.8] },
    // on the threshing floor's edge, looking at the heaps and the team going round
    threshing: { eye: [floor.x + floor.w + 7, floor.y + floor.d * 0.1, 2.3], at: [floor.x + floor.w * 0.4, floor.y + floor.d * 0.55, 0.8] },
  };
  if (reap) {
    // on the channel bank at the edge of the standing barley, looking along the cut
    const f = fieldOf((q) => q.reapers).rect;
    views.field = { eye: [f.x - 1, reap.rect.y - 4, 2.0], at: [reap.rect.x + reap.rect.w * 0.6, reap.rect.y + reap.rect.d, 0.7] };
  }
  if (team) views.plough = { eye: [team.rect.x - 7, team.rect.y - 9, 1.7], at: [team.rect.x + 1.6, team.rect.y + 4, 1.0] };

  return {
    boxes, grounds: tiled, views, slots, frame: { w: W, d: D },
    stats: { culture, season, fields: fields.map((f) => f.crop), slots: slots.length, farmstead: { x: fx, y: fieldTop, w: fw, d: D - fieldTop } },
  };
}

/**
 * The ground of a scene cut by a canal: the base earth either side in 4 m columns, the slivers the
 * meander leaves at the banks, the water, and earthen banks sloping down to it. `holes` (rects on the
 * 4 m column grid) are left out of the base, for a pit sunk below it or a town that lays its own;
 * `skip` ([x0, x1]) is a stretch whose water and banks someone else draws (the town's own canal).
 */
export function canalGround({ W, D, bankN, cw, waterZ, P, holes = [], skip = null }) {
  const base = [], grounds = [], boxes = [], seg = 4;
  // a column's base from y0 to y1, less the holes across it
  const span = (x, y0, y1) => {
    let y = y0;
    for (const h of holes.filter((q) => q.x < x + seg - 1e-6 && x < q.x + q.w - 1e-6 && q.y < y1 && q.y + q.d > y0).sort((a, b) => a.y - b.y)) {
      if (h.y > y) base.push({ kind: 'ground', x, y, w: seg, d: h.y - y, z: 0.01, fill: P.ground, surface: 'dry-earth', layer: 0 });
      y = Math.max(y, h.y + h.d);
    }
    if (y < y1) base.push({ kind: 'ground', x, y, w: seg, d: y1 - y, z: 0.01, fill: P.ground, surface: 'dry-earth', layer: 0 });
  };
  for (let x = 0; x < W; x += seg) {
    const xa = x - 0.2, xb = Math.min(W, x + seg) + 0.2, na = bankN(xa), nb = bankN(xb);
    span(x, 0, Math.min(na, nb));
    span(x, Math.max(na, nb) + cw, D);
    if (skip && x >= skip[0] - 1e-6 && x + seg <= skip[1] + 1e-6) continue;
    // the slivers the meander leaves between the grid and the bank
    for (const [e0, e1, lo] of [[na, nb, true], [na + cw, nb + cw, false]]) {
      const inner = lo ? Math.min(e0, e1) : Math.max(e0, e1);
      grounds.push({ kind: 'bank-edge', poly: lo ? [[xa, inner], [xb, inner], [xb, e1], [xa, e0]] : [[xa, e0], [xb, e1], [xb, inner], [xa, inner]], z: 0.01, fill: P.ground, layer: 0 });
    }
    grounds.push({ kind: 'water', poly: [[xa, na], [xb, nb], [xb, nb + cw], [xa, na + cw]], z: waterZ, fill: P.water, layer: 0 });
    // earthen banks sloping down to the water
    const run = 1.6, foot = waterZ - 0.2;
    boxes.push({ kind: 'canal-bank', solid: 'panel', pts: [[xa, na, 0], [xb, nb, 0], [xb, nb + run, foot], [xa, na + run, foot]], out: [0, 1, 0.6], x, y: Math.min(na, nb), w: seg, d: run, z0: foot, z1: 0, tint: scaleHex(P.ground, 0.8) });
    boxes.push({ kind: 'canal-bank', solid: 'panel', pts: [[xa, na + cw, 0], [xb, nb + cw, 0], [xb, nb + cw - run, foot], [xa, na + cw - run, foot]], out: [0, -1, 0.6], x, y: Math.min(na, nb) + cw - run, w: seg, d: run, z0: foot, z1: 0, tint: scaleHex(P.ground, 0.8) });
  }
  return { base, grounds, boxes };
}

/** A ground rect cut into tiles about `t` metres a side, a hair of overlap closing the joins. */
export function tileGround(g, t) {
  const nx = Math.max(1, Math.round(g.w / t)), ny = Math.max(1, Math.round(g.d / t)), out = [];
  if (nx === 1 && ny === 1) return [g];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) out.push({ ...g, x: g.x + (g.w * i) / nx, y: g.y + (g.d * j) / ny, w: g.w / nx + (i < nx - 1 ? 0.05 : 0), d: g.d / ny + (j < ny - 1 ? 0.05 : 0) });
  return out;
}

/** A stand of crop (barley; reed at the marsh): a ground at its height and panels for its sides. */
export function standingCrop(r, h, P, boxes, grounds, fill = P.grain, kind = 'crop', sideK = 0.78) {
  grounds.push({ kind, ...r, z: h, fill, surface: 'barley', layer: 1 });
  const side = scaleHex(fill, sideK), x1 = r.x + r.w, y1 = r.y + r.d;
  for (const [pts, out] of [
    [[[r.x, r.y, 0], [x1, r.y, 0], [x1, r.y, h], [r.x, r.y, h]], [0, -1, 0]],
    [[[r.x, y1, 0], [x1, y1, 0], [x1, y1, h], [r.x, y1, h]], [0, 1, 0]],
    [[[r.x, r.y, 0], [r.x, y1, 0], [r.x, y1, h], [r.x, r.y, h]], [-1, 0, 0]],
    [[[x1, r.y, 0], [x1, y1, 0], [x1, y1, h], [x1, r.y, h]], [1, 0, 0]],
  ]) boxes.push({ kind, solid: 'panel', pts, out, x: Math.min(...pts.map((p) => p[0])), y: Math.min(...pts.map((p) => p[1])), w: Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0])), d: Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1])), z0: 0, z1: h, tint: side });
}

// px per scene unit, as the town: the eye-level views raster finer
const UNIT_SCALE = { aerial: 22, yard: 48, threshing: 48, field: 48, plough: 48 };

/** Plan → a CSS 3D scene with an aerial camera and the eye-level views, the asked-for view first. */
export function assembleFarmsteadScene(opts = {}) {
  const plan = planFarmstead(opts);
  const view = plan.views[opts.view] ? opts.view : 'aerial';
  const s = 1 / METRES_PER_UNIT, us = UNIT_SCALE[view];
  const { boxes, faces } = toScene(plan.boxes, s, us);
  const G = groundsToScene(plan.grounds, s, us);
  faces.unshift(...G.faces);
  const W = plan.frame.w * s, Dd = plan.frame.d * s;
  const cameras = [{ name: 'aerial', worldFraming: { cameraPosition: [W * 0.55, Dd * 1.3, Math.max(W, Dd) * 0.5], lookAt: [W * 0.55, Dd * 0.45, 0], horizontalFov: 62, pictureCenter: [560, 390] } }];
  for (const [name, v] of Object.entries(plan.views)) cameras.push({ name, worldFraming: { cameraPosition: v.eye.map((q) => q * s), lookAt: v.at.map((q) => q * s), horizontalFov: 74, pictureCenter: [560, 390] } });
  const first = cameras.findIndex((c) => c.name === view);
  if (first > 0) cameras.unshift(...cameras.splice(first, 1));
  const scene = assembleBoxCityScene({ boxes, grounds: G.grounds, faces, cameras, title: `mojulo historic farmstead · ${plan.stats.culture} · ${plan.stats.season}`, bg: '#d9cdb4', light: SCENE_LIGHT, unitScale: us });
  return { ...scene, stats: plan.stats };
}

export function renderFarmsteadToHtml(opts = {}) {
  return emitHistoric(assembleFarmsteadScene(opts));
}
