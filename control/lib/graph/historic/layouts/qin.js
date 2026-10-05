/**
 * historic/layouts/qin — the 'wei-wards' layout: Xianyang on the north bank of the Wei, c. 212 BCE. The
 * plan, in order:
 *
 *   the palace enclosure at the top of the town: a rammed-earth wall, a pair of que for its south gate,
 *     Palace No. 1 on its two-tier terrace on the axis, a lesser hall on a single terrace either side
 *   → the axis carried south as an avenue from the que to the river, an east–west avenue across it
 *   → walled wards (li) either side of the avenue, each with its gate on the east–west avenue and lanes
 *     inside, packed with courtyard houses (the row under the palace the elite's, with higher walls)
 *   → one ward a walled market (a Han analogue)
 *   → the riverside road, the bank, the Wei, a timber bridge on the axis, and across the river Epang's
 *     front hall begun: a building site
 *   → loess fields round the town, poplars along the avenues, trees by the water.
 *
 * No outer city wall: the record has none (../record/qin.js). The town is flat loess; plans in metres,
 * x east, y south.
 */
import { tree, house } from '../assets/qin.js';
import { CELL, C, LAYER, laneZ, stream, pick, claimGrid, runs, alleyLattice, packLots, lotSlot, placeSlots, skinLoose } from '../layout-kit.js';

const TC = 20;                       // ground cell, metres
const HOUSE_MIN = house.envelope.w[0];   // the smallest lot a house is built on
const TERRAIN_LAYER = 10 * LAYER;    // alternate 20 m ground rows sit this far apart (see layouts/giza.js)

export function planWeiWards({ seed = 1, culture = 'qin', frame = { w: 600, d: 600 }, assets } = {}, K) {
  const P = K.palette, g = claimGrid(frame), { cols, rows, grid, at, set } = g, Wf = cols * CELL, Df = rows * CELL;
  const boxes = [], grounds = [], slots = [], T = stream(seed, 'trees');
  const fill = (r, v, test = () => true) => { for (let rr = Math.floor(r.y / CELL); rr < Math.ceil((r.y + r.d) / CELL); rr++) for (let c = Math.floor(r.x / CELL); c < Math.ceil((r.x + r.w) / CELL); c++) if (test(at(c, rr))) set(c, rr, v); };
  const slot = (s) => { slots.push({ z: 0, ...s }); return s; };
  for (let i = 0; i < grid.length; i++) grid[i] = C.OUTSIDE;

  // ── 1. the river: the Wei across the south of the frame, a bank either side ──
  const R = K.river, rv = { y0: 450, y1: 450 + R.width }, waterZ = -R.sink, bank = 4;
  fill({ x: 0, y: rv.y0 - bank, w: Wf, d: rv.y1 - rv.y0 + 2 * bank }, C.WATER);

  // ── 2. the palace enclosure, its que, its halls ──
  const pal = { x: 171, y: 18, w: K.palace.w - 2, d: K.palace.d + 2 }, pw = K.palace.wall, ax = pal.x + pal.w / 2;
  fill(pal, C.PRECINCT);
  const queR = { x: ax - 22, y: pal.y + pal.d - pw.base / 2 - 6, w: 44, d: 12 };
  slot({ asset: 'qn-wall', rect: { x: pal.x, y: pal.y, w: pal.w, d: pw.base }, facing: 'n', h: pw.h });
  slot({ asset: 'qn-wall', rect: { x: pal.x, y: pal.y + pw.base, w: pw.base, d: pal.d - 2 * pw.base }, facing: 'w', h: pw.h });
  slot({ asset: 'qn-wall', rect: { x: pal.x + pal.w - pw.base, y: pal.y + pw.base, w: pw.base, d: pal.d - 2 * pw.base }, facing: 'e', h: pw.h });
  for (const [x0, x1] of [[pal.x, queR.x], [queR.x + queR.w, pal.x + pal.w]]) slot({ asset: 'qn-wall', rect: { x: x0, y: pal.y + pal.d - pw.base, w: x1 - x0, d: pw.base }, facing: 's', h: pw.h });
  slot({ asset: 'qn-que', rect: queR, facing: 's' });
  const hall1 = slot({ asset: 'qn-hall', rect: { x: ax - 30, y: 50, w: 60, d: 46 }, facing: 's' }).rect;
  for (const x of [pal.x + 25, pal.x + pal.w - 25 - 44]) slot({ asset: 'qn-hall', rect: { x, y: 72, w: 44, d: 34 }, facing: 's', tiers: 1 });
  // the brick walk from the que to the stair, and the beaten-earth court round it
  grounds.push({ kind: 'court', x: pal.x + pw.base, y: pal.y + pw.base, w: pal.w - 2 * pw.base, d: pal.d - 2 * pw.base, z: 0.03, fill: P.court, surface: 'mud' });
  grounds.push({ kind: 'walk', x: ax - 6, y: hall1.y + hall1.d, w: 12, d: queR.y - hall1.y - hall1.d, z: 0.05, fill: P.paving, surface: 'brick' });

  // ── 3. the streets: the road along the palace front, the axial avenue, the east–west avenue, the riverside road ──
  const A = K.avenue, rowN = { y0: 192, y1: 276 }, ew = { y0: 276, y1: 294 }, rowS = { y0: 294, y1: 384 }, road = { y0: 384, y1: 396 };
  const street = (x, y, w, d) => fill({ x, y, w, d }, C.LANE, (v) => v === C.OUTSIDE);
  street(pal.x - 20, pal.y + pal.d, pal.w + 40, rowN.y0 - pal.y - pal.d);
  street(ax - A / 2, rowN.y0, A, road.y1 - rowN.y0);
  street(0, ew.y0, Wf, ew.y1 - ew.y0);
  street(0, road.y0, Wf, road.y1 - road.y0);

  // ── 4. the wards: walled blocks either side of the avenue, gates on the east–west avenue ──
  const WW = K.ward.w, gap = K.ward.street, xs = [];
  for (let x = ax - A / 2 - gap - WW; x >= 0; x -= WW + gap) xs.unshift(x);
  for (let x = ax + A / 2 + gap; x + WW <= Wf; x += WW + gap) xs.push(x);
  const wards = [];
  for (const [row, elite] of [[rowN, true], [rowS, false]]) for (const x of xs) wards.push({ x, y: row.y0, w: WW, d: row.y1 - row.y0, elite, gateSide: elite ? 's' : 'n' });
  // the streets between wards, from the palace road to the riverside road
  for (const x of xs) { street(x + WW, rowN.y0, gap, rowS.y1 - rowN.y0); street(x - gap, rowN.y0, gap, rowS.y1 - rowN.y0); }
  const marketWard = wards.find((w) => !w.elite && w.x > ax + WW) || wards.at(-1);
  marketWard.market = true;
  for (const w of wards) {
    const wl = w.elite ? K.ward.wall.elite : K.ward.wall.common, b = wl.base, cx = w.x + w.w / 2, gw = 8;
    if (w.market) { slot({ asset: 'qn-market', rect: { x: w.x, y: w.y, w: w.w, d: w.d }, facing: 'n' }); fill(w, C.PRECINCT); continue; }
    const gy = w.gateSide === 's' ? w.y + w.d - b : w.y, oy = w.gateSide === 's' ? w.y : w.y + w.d - b;
    slot({ asset: 'qn-wall', rect: { x: w.x, y: oy, w: w.w, d: b }, facing: w.gateSide === 's' ? 'n' : 's', h: wl.h });
    for (const [x0, x1] of [[w.x, cx - gw / 2], [cx + gw / 2, w.x + w.w]]) slot({ asset: 'qn-wall', rect: { x: x0, y: gy, w: x1 - x0, d: b }, facing: w.gateSide, h: wl.h });
    slot({ asset: 'qn-ward-gate', rect: { x: cx - gw / 2, y: gy, w: gw, d: b }, facing: w.gateSide, h: wl.h });
    slot({ asset: 'qn-wall', rect: { x: w.x, y: w.y + b, w: b, d: w.d - 2 * b }, facing: 'w', h: wl.h });
    slot({ asset: 'qn-wall', rect: { x: w.x + w.w - b, y: w.y + b, w: b, d: w.d - 2 * b }, facing: 'e', h: wl.h });
    // inside: the cross streets (from the gate through the ward, and across it), then the alleys
    const inn = { x: w.x + b + 0.5, y: w.y + b + 0.5, w: w.w - 2 * b - 1, d: w.d - 2 * b - 1 };
    w.inner = inn;
    for (let r = Math.ceil(inn.y / CELL); r < Math.floor((inn.y + inn.d) / CELL); r++) for (let c = Math.ceil(inn.x / CELL); c < Math.floor((inn.x + inn.w) / CELL); c++) set(c, r, C.EMPTY);
    const cc = Math.round(cx / CELL - 1), cr = Math.round((inn.y + inn.d / 2) / CELL);
    // the street from the gate runs out through it to the avenue; it stops at the far wall
    const r0 = w.gateSide === 'n' ? Math.floor(w.y / CELL) : Math.ceil(inn.y / CELL), r1 = w.gateSide === 's' ? Math.ceil((w.y + w.d) / CELL) - 1 : Math.floor((inn.y + inn.d) / CELL) - 1;
    for (let r = r0; r <= r1; r++) for (const c of [cc, cc + 1]) if (at(c, r) === C.EMPTY || at(c, r) === C.OUTSIDE) set(c, r, C.LANE);
    for (let c = Math.ceil(inn.x / CELL); c < Math.floor((inn.x + inn.w) / CELL); c++) if (at(c, cr) === C.EMPTY) set(c, cr, C.LANE);
  }
  alleyLattice(g, K.lanes.block, seed, [], { jog: 0.03 });
  let houses = 0, gardens = 0;
  for (const w of wards) {
    if (w.market) continue;
    const inside = (c, r) => (c + 0.5) * CELL > w.inner.x && (c + 0.5) * CELL < w.inner.x + w.inner.w && (r + 0.5) * CELL > w.inner.y && (r + 0.5) * CELL < w.inner.y + w.inner.d;
    for (const lot of packLots(g, w.elite ? K.house.elite : K.house.size, `${seed}|${w.x}|${w.y}`, { free: (v, c, r) => v === C.EMPTY && inside(c, r) })) {
      const s = lotSlot(g, lot, K.house.gap, () => 'qn-house');
      const side = { n: [0, -1], s: [0, lot.d], w: [-1, 0], e: [lot.w, 0] }[s.facing], fronts = [...Array(s.facing === 'n' || s.facing === 's' ? lot.w : lot.d).keys()].some((k) => {
        const c = lot.c0 + (s.facing === 'n' || s.facing === 's' ? k : side[0]), r = lot.r0 + (s.facing === 'n' || s.facing === 's' ? side[1] : k), v = at(c, r);
        return v === C.LANE || v === C.OPEN;
      });
      const big = Math.min(s.rect.w, s.rect.d) >= HOUSE_MIN;   // a sliver of a lot is a yard, not a house
      if (fronts && big) { slot({ ...s, elite: w.elite }); houses++; }
      else { gardens++; for (let k = 0; k < 2; k++) boxes.push(...tree(s.rect.x + s.rect.w * (0.3 + 0.4 * T()), s.rect.y + s.rect.d * (0.3 + 0.4 * T()), T, P, { crown: 'round', h: 6 + T() * 3 })); }
    }
  }

  // ── 5. the bridge on the axis, and Epang's front hall begun across the river ──
  slot({ asset: 'qn-bridge', rect: { x: ax - 7.7, y: rv.y0 - bank - 6, w: 15.4, d: rv.y1 - rv.y0 + 2 * bank + 12 }, facing: 'n', waterZ });
  const works = slot({ asset: 'qn-terrace-works', rect: { x: ax + 30, y: rv.y1 + bank + 8, w: 200, d: Math.min(56, Df - rv.y1 - bank - 10) }, facing: 'n' }).rect;

  placeSlots(slots, assets || K.assets, K, seed, boxes, grounds, culture);

  // ── 6. trees: poplars down the avenues, round trees by the water and in the palace court ──
  let trees = 0;
  const plant = (x, y, o) => { if (trees >= K.trees.max) return; boxes.push(...tree(x, y, T, P, o)); trees++; };
  for (let y = rowN.y0 + 4; y < road.y0 - 2; y += 9) for (const x of [ax - A / 2 + 1.5, ax + A / 2 - 1.5]) if (y < ew.y0 - 2 || y > ew.y1 + 2) plant(x, y, { crown: 'poplar' });
  for (let x = 6; x < Wf - 6; x += 11) for (const y of [ew.y0 + 1.5, ew.y1 - 1.5]) if (Math.abs(x - ax) > A / 2 + 2) plant(x, y, { crown: 'poplar' });
  for (let x = 4; x < Wf - 4; x += 7 + T() * 8) if (Math.abs(x - ax) > 12) plant(x, road.y1 + 4 + T() * (rv.y0 - bank - road.y1 - 8), { crown: 'round', h: 7 + T() * 3 });
  for (const [x, y] of [[pal.x + 20, 130], [pal.x + 60, 140], [pal.x + pal.w - 20, 130], [pal.x + pal.w - 60, 140], [pal.x + 90, 40], [pal.x + pal.w - 90, 40]]) plant(x, y, { crown: 'round', h: 8 + T() * 3 });

  // ── 7. views ──
  const elite = wards.find((w) => w.elite && w.x + w.w < ax && w.x + w.w > ax - A / 2 - gap - WW - 1) || wards[0];
  const mk = marketWard, mcx = mk.x + mk.w / 2, mcy = mk.y + mk.d / 2;
  const views = {
    // on Palace No. 1's upper terrace, before the hall, looking down the axis over the que to the river
    palace: { eye: [ax, hall1.y + hall1.d - 16.5, 7 + 1.7], at: [ax, 330, 0] },
    // at the foot of the que, on the palace road
    gate: { eye: [ax, rowN.y0 + 4, 1.7], at: [ax, queR.y, 9] },
    // on the avenue, looking north up the axis to the que and the palace roofs behind
    avenue: { eye: [ax, ew.y0 - 4, 1.7], at: [ax, 120, 12] },
    // inside an elite ward, on its street from the gate
    ward: { eye: [elite.x + elite.w / 2, elite.y + elite.d - 8, 1.7], at: [elite.x + elite.w / 2, elite.y + 6, 4] },
    // in the market, by the drum tower
    market: { eye: [mcx - 9, mcy + 11, 1.7], at: [mcx, mcy, 7] },
    // on the bridge, looking back north at the town
    bridge: { eye: [ax, (rv.y0 + rv.y1) / 2 + 20, 1.4 + 1.7], at: [ax, 200, 12] },
    // on the south bank by Epang's terrace, the gangs at work
    works: { eye: [works.x - 6, works.y - 4, 1.7], at: [works.x + 90, works.y + 30, 3] },
  };

  // ── 8. ground: the loess, the river and its banks, the lanes, the fields ──
  const isRiver = (y) => y > rv.y0 - bank && y < rv.y1 + bank;
  for (let r = 0; r * TC < Df; r++) {
    const y0 = r * TC, y1 = Math.min(Df, y0 + TC), odd = r % 2;
    for (let c = 0; c * TC < Wf; c++) {
      const x0 = c * TC, x1 = Math.min(Wf, x0 + TC);
      // the river band's edge rows are trimmed to the bank
      const ya = isRiver(y0 + 0.01) ? Math.max(y0, rv.y1 + bank) : y0, yb = isRiver(y1 - 0.01) ? Math.min(y1, rv.y0 - bank) : y1;
      if (yb <= ya) continue;
      grounds.unshift({ kind: 'ground', x: x0, y: ya - (odd ? 0.06 : 0), w: x1 - x0, d: yb - ya + (odd ? 0.12 : 0), z: 0.01 + (odd ? TERRAIN_LAYER : 0), fill: P.ground, surface: 'mud' });
    }
  }
  for (let y = rv.y0; y < rv.y1; y += TC) for (let x = 0; x < Wf; x += TC) {
    const ri = Math.round(y / TC), ov = ri % 2 ? 0.25 : 0;
    grounds.push({ kind: 'water', x: x - ov, y: y - ov, w: Math.min(TC, Wf - x) + 2 * ov, d: Math.min(TC, rv.y1 - y) + 2 * ov, z: waterZ + (ri % 2 ? TERRAIN_LAYER : 0), fill: P.water });
  }
  for (let x = 0; x < Wf; x += TC) {
    const x1 = Math.min(Wf, x + TC);
    boxes.push({ kind: 'bank', solid: 'panel', pts: [[x, rv.y0 - bank, 0.02], [x1, rv.y0 - bank, 0.02], [x1, rv.y0 + 0.3, waterZ - 0.2], [x, rv.y0 + 0.3, waterZ - 0.2]], out: [0, 1, 0.6], x, y: rv.y0 - bank, w: x1 - x, d: bank + 0.3, z0: waterZ - 0.2, z1: 0.02, tint: P.bank });
    boxes.push({ kind: 'bank', solid: 'panel', pts: [[x, rv.y1 - 0.3, waterZ - 0.2], [x1, rv.y1 - 0.3, waterZ - 0.2], [x1, rv.y1 + bank, 0.02], [x, rv.y1 + bank, 0.02]], out: [0, -1, 0.6], x, y: rv.y1 - 0.3, w: x1 - x, d: bank + 0.3, z0: waterZ - 0.2, z1: 0.02, tint: P.bank });
  }
  runs(grid, cols, rows, (v) => v === C.LANE || v === C.OPEN, (c, r, n) => grounds.push({ kind: 'lane', x: c * CELL, y: r * CELL - (r % 2 ? 0.08 : 0), w: n * CELL + 0.15, d: CELL + (r % 2 ? 0.16 : 0), z: laneZ(0, r), fill: P.lane, surface: 'mud' }));
  // fields on the loess outside the town: north of the wards either side of the palace, and across the river
  const F = stream(seed, 'fields'), busy = [pal, ...wards, works, { x: ax - 12, y: rv.y1, w: 24, d: Df - rv.y1 }];
  const clear = (x, y) => !busy.some((o) => x < o.x + o.w + 4 && x + TC > o.x - 4 && y < o.y + o.d + 4 && y + TC > o.y - 4);
  for (let y = 0; y < Df; y += TC) for (let x = 0; x < Wf; x += TC) {
    if (isRiver(y) || isRiver(y + TC) || (y >= rowN.y0 - 14 && y < road.y1 + 4) || !clear(x, y)) continue;
    if (F() < 0.85) grounds.push({ kind: 'field', x: x + 0.7, y: y + 0.7, w: TC - 1.4, d: TC - 1.4, z: 0.03, fill: pick(P.field, F) });
    if (F() < 0.12) plant(x + F() * TC, y + F() * TC, { crown: F() < 0.5 ? 'poplar' : 'round' });
  }

  skinLoose(boxes, K);
  return {
    boxes, grounds, views, frame: { w: Wf, d: Df }, slots,
    stats: {
      culture, houses, gardens, trees, wards: wards.filter((w) => !w.market).length, eliteWards: wards.filter((w) => w.elite).length,
      precinct: pal, palace: pal, hall: hall1, que: queR, market: { x: mk.x, y: mk.y, w: mk.w, d: mk.d }, works, river: rv, axis: ax,
      laneCells: grid.reduce((n, v) => n + (v === C.LANE ? 1 : 0), 0),
    },
    grid: { cols, rows, cell: CELL, data: grid, codes: C },
  };
}
