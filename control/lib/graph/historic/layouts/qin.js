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
 * No outer city wall: the record has none (../record/qin.js). The ground is in two steps: the palace on the
 * lip of the Xianyang tableland, a loess bluff cut by gullies, the wards on the river plain below, the axis
 * climbing the bluff as a rammed-earth causeway. The Wei is braided round sandbars. Its line is a
 * reconstruction (the river has since moved north over the old town). Beyond the frame, for the World page
 * only (`horizon`), the plain and the tableland run on to the hills. Plans in metres, x east, y south.
 */
import { tree, house } from '../assets/qin.js';
import { scaleHex } from '../../polygonizer/vexar.js';
import { terrainMesh } from '../terrain.js';
import { CELL, C, LAYER, laneZ, stream, pick, claimGrid, runs, alleyLattice, packLots, lotSlot, placeSlots, skinLoose } from '../layout-kit.js';

const TC = 20;                       // ground cell, metres
const HOUSE_MIN = house.envelope.w[0];   // the smallest lot a house is built on

export function planWeiWards({ seed = 1, culture = 'qin', frame = { w: 600, d: 600 }, assets } = {}, K) {
  const P = K.palette, g = claimGrid(frame), { cols, rows, grid, at, set } = g, Wf = cols * CELL, Df = rows * CELL;
  const boxes = [], grounds = [], slots = [], T = stream(seed, 'trees');
  const fill = (r, v, test = () => true) => { for (let rr = Math.floor(r.y / CELL); rr < Math.ceil((r.y + r.d) / CELL); rr++) for (let c = Math.floor(r.x / CELL); c < Math.ceil((r.x + r.w) / CELL); c++) if (test(at(c, rr))) set(c, rr, v); };
  const slot = (s) => { slots.push({ z: 0, ...s }); return s; };
  // lift a built part (its z, a panel's corners) onto higher ground
  const raise = (bs, dz) => (dz ? bs.map((b) => ({ ...b, z0: b.z0 + dz, z1: b.z1 + dz, ...(b.pts ? { pts: b.pts.map(([x, y, z]) => [x, y, z + dz]) } : {}) })) : bs);
  for (let i = 0; i < grid.length; i++) grid[i] = C.OUTSIDE;

  // ── 1. the river: the Wei across the south of the frame, a bank either side ──
  const R = K.river, rv = { y0: 450, y1: 450 + R.width }, waterZ = -R.sink, bank = 4;
  fill({ x: 0, y: rv.y0 - bank, w: Wf, d: rv.y1 - rv.y0 + 2 * bank }, C.WATER);

  // ── 2. the palace enclosure, its que, its halls ──
  const pal = { x: 171, y: 18, w: K.palace.w - 2, d: K.palace.d + 2 }, pw = K.palace.wall, ax = pal.x + pal.w / 2, H = K.tableland.h;
  fill(pal, C.PRECINCT);
  const queR = { x: ax - 22, y: pal.y + pal.d - pw.base / 2 - 6, w: 44, d: 12 };
  slot({ asset: 'qn-wall', rect: { x: pal.x, y: pal.y, w: pal.w, d: pw.base }, facing: 'n', h: pw.h, z: H });
  slot({ asset: 'qn-wall', rect: { x: pal.x, y: pal.y + pw.base, w: pw.base, d: pal.d - 2 * pw.base }, facing: 'w', h: pw.h, z: H });
  slot({ asset: 'qn-wall', rect: { x: pal.x + pal.w - pw.base, y: pal.y + pw.base, w: pw.base, d: pal.d - 2 * pw.base }, facing: 'e', h: pw.h, z: H });
  for (const [x0, x1] of [[pal.x, queR.x], [queR.x + queR.w, pal.x + pal.w]]) slot({ asset: 'qn-wall', rect: { x: x0, y: pal.y + pal.d - pw.base, w: x1 - x0, d: pw.base }, facing: 's', h: pw.h, z: H });
  slot({ asset: 'qn-que', rect: queR, facing: 's', z: H });
  const hall1 = slot({ asset: 'qn-hall', rect: { x: ax - 30, y: 50, w: 60, d: 46 }, facing: 's', z: H }).rect;
  for (const x of [pal.x + 25, pal.x + pal.w - 25 - 44]) slot({ asset: 'qn-hall', rect: { x, y: 72, w: 44, d: 34 }, facing: 's', tiers: 1, z: H });
  // the brick walk from the que to the stair, and the beaten-earth court round it
  grounds.push({ kind: 'court', x: pal.x + pw.base, y: pal.y + pw.base, w: pal.w - 2 * pw.base, d: pal.d - 2 * pw.base, z: H + 0.03, fill: P.court, surface: 'mud' });
  grounds.push({ kind: 'walk', x: ax - 6, y: hall1.y + hall1.d, w: 12, d: queR.y - hall1.y - hall1.d, z: H + 0.05, fill: P.paving, surface: 'brick' });

  // ── 3. the ground's height (../terrain.js meshes it): the tableland, its edge a sheer loess bluff, ragged except
  //    under the palace, two gullies cut back into it; the plain; the Wei's banks and its bed, braided round
  //    sandbars that break the surface. Then the streets: the axial avenue (climbing the bluff as a causeway),
  //    the east–west avenue, the riverside road ──
  const A = K.avenue, rowN = { y0: 192, y1: 276 }, ew = { y0: 276, y1: 294 }, rowS = { y0: 294, y1: 384 }, road = { y0: 384, y1: 396 };
  const TB = K.tableland, BX = 10, Bq = stream(seed, 'bluff'), top = [];
  for (let i = 0; i * BX <= Wf; i++) { const x = i * BX; top.push(x >= pal.x - 12 && x <= pal.x + pal.w + 12 ? TB.edge : TB.edge - 6 + Bq() * 7); }
  const gullies = [{ x: 40, w: 20, head: 100 }, { x: 520, w: 20, head: 120 }].filter((q) => q.x + q.w < Wf), mouth = rowN.y0 - 1;
  const lerpAt = (arr, x) => { const i = Math.min(arr.length - 2, Math.max(0, Math.floor(x / BX))), t = x / BX - i; return arr[i] + (arr[i + 1] - arr[i]) * t; };
  const gullyAt = (x) => gullies.find((q) => x > q.x && x < q.x + q.w);
  // the bars: long lenses in midstream, clear of the bridge, their crests a little above the water
  const Bv = stream(seed, 'bars'), bars = [];
  for (let k = 0; k < 40 && bars.length < R.bars; k++) {
    const len = 30 + Bv() * 80, wid = 6 + Bv() * 12, cx = Bv() * Wf, cy = rv.y0 + 8 + wid / 2 + Bv() * (rv.y1 - rv.y0 - 16 - wid);
    if (Math.abs(cx - ax) < len / 2 + 14 || bars.some((b) => Math.abs(b.cx - cx) < (b.len + len) / 2 + 6 && Math.abs(b.cy - cy) < (b.wid + wid) / 2 + 6)) continue;
    bars.push({ cx, cy, len, wid });
  }
  // the bed: deepest mid-channel, sloping up the banks to the plain. A bar stands out of it with a low lip, so the
  // terrain mesher traces its outline on the true contour (a gentle shoulder would be stepped to the grid)
  const bedAt = (x, y) => {
    const t = (y - rv.y0) / (rv.y1 - rv.y0);
    let z = waterZ - 0.5 - 1.5 * Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
    for (const b of bars) { const e = ((x - b.cx) / (b.len / 2)) ** 2 + ((y - b.cy) / (b.wid / 2)) ** 2; if (e < 1) z = Math.max(z, waterZ + 0.12 + 0.25 * Math.sqrt(1 - e)); }
    return z;
  };
  const hAt = (x, y) => {
    if (y > rv.y0 - bank && y < rv.y0) return (waterZ - 0.5) * (y - rv.y0 + bank) / bank;          // the north bank
    if (y > rv.y1 && y < rv.y1 + bank) return (waterZ - 0.5) * (rv.y1 + bank - y) / bank;          // the south bank
    if (y >= rv.y0 && y <= rv.y1) return bedAt(x, y);
    const q = gullyAt(x);
    if (q && y > q.head) return y >= mouth ? 0 : H * (mouth - y) / (mouth - q.head);              // a gully floor
    return y <= lerpAt(top, x) ? H : 0;                                                          // the tableland or the plain
  };
  const ramp = { x: ax - A / 2, y0: TB.edge, y1: ew.y0 }, rampZ = (y) => H * Math.min(1, Math.max(0, (ramp.y1 - y) / (ramp.y1 - ramp.y0)));
  // what stands on a point: the causeway, or the ground
  const zAt = (x, y) => (x >= ramp.x && x <= ramp.x + A && y > ramp.y0 && y < ramp.y1 ? rampZ(y) : hAt(x, y));
  const street = (x, y, w, d) => fill({ x, y, w, d }, C.LANE, (v) => v === C.OUTSIDE);
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
  const plant = (x, y, o) => { if (trees >= K.trees.max) return; boxes.push(...raise(tree(x, y, T, P, o), zAt(x, y))); trees++; };
  for (let y = rowN.y0 + 4; y < road.y0 - 2; y += 9) for (const x of [ax - A / 2 + 1.5, ax + A / 2 - 1.5]) if (y < ew.y0 - 2 || y > ew.y1 + 2) plant(x, y, { crown: 'poplar' });
  for (let x = 6; x < Wf - 6; x += 11) for (const y of [ew.y0 + 1.5, ew.y1 - 1.5]) if (Math.abs(x - ax) > A / 2 + 2) plant(x, y, { crown: 'poplar' });
  for (let x = 4; x < Wf - 4; x += 7 + T() * 8) if (Math.abs(x - ax) > 12) plant(x, road.y1 + 4 + T() * (rv.y0 - bank - road.y1 - 8), { crown: 'round', h: 7 + T() * 3 });
  for (const [x, y] of [[pal.x + 20, 130], [pal.x + 60, 140], [pal.x + pal.w - 20, 130], [pal.x + pal.w - 60, 140], [pal.x + 90, 40], [pal.x + pal.w - 90, 40]]) plant(x, y, { crown: 'round', h: 8 + T() * 3 });
  // scrub down the gully floors
  for (const q of gullies) for (let y = q.head + 12; y < rowN.y0 - 6; y += 14 + T() * 10) plant(q.x + q.w / 2 + (T() - 0.5) * 4, y, { crown: 'round', h: 5 + T() * 3 });

  // ── 7. views ──
  const elite = wards.find((w) => w.elite && w.x + w.w < ax && w.x + w.w > ax - A / 2 - gap - WW - 1) || wards[0];
  const mk = marketWard, mcx = mk.x + mk.w / 2, mcy = mk.y + mk.d / 2;
  const views = {
    // on Palace No. 1's upper terrace, before the hall, looking down the axis over the que to the river
    palace: { eye: [ax, hall1.y + hall1.d - 16.5, H + 7 + 1.7], at: [ax, 330, 0] },
    // at the foot of the que, on the palace road
    gate: { eye: [ax, rowN.y0 + 4, zAt(ax, rowN.y0 + 4) + 1.7], at: [ax, queR.y, H + 9] },
    // on the avenue, looking north up the axis to the que and the palace roofs behind
    avenue: { eye: [ax, ew.y0 - 4, zAt(ax, ew.y0 - 4) + 1.7], at: [ax, 120, H + 12] },
    // inside an elite ward, on its street from the gate
    ward: { eye: [elite.x + elite.w / 2, elite.y + elite.d - 8, 1.7], at: [elite.x + elite.w / 2, elite.y + 6, 4] },
    // in the market, by the drum tower
    market: { eye: [mcx - 9, mcy + 11, 1.7], at: [mcx, mcy, 7] },
    // on the bridge, looking back north at the town
    bridge: { eye: [ax, (rv.y0 + rv.y1) / 2 + 20, 1.4 + 1.7], at: [ax, 200, H + 4] },
    // from low over the wards, west along the bluff to the first gully, the palace on its lip behind
    bluff: { eye: [ax - 30, 300, 26], at: [gullies[0] ? gullies[0].x + 30 : 80, 178, 4] },
    // on the south bank by Epang's terrace, the gangs at work
    works: { eye: [works.x - 6, works.y - 4, 1.7], at: [works.x + 90, works.y + 30, 3] },
  };

  // ── 8. ground: the terrain (the tableland, the bluff and gullies, the plain, the banks, the bars) and the Wei over
  //    it, under its river look on the World page; the causeway; the lanes; the fields ──
  const isRiver = (y) => y > rv.y0 - bank && y < rv.y1 + bank;
  const Wt = K.water || {};
  const T0 = terrainMesh({
    hAt, frame: { w: Wf, d: Df }, eyes: Object.values(views).map((v) => v.eye), cell: 20, eyeRadius: 40,
    surfaceAt: (x, y, z) => (isRiver(y) ? { fill: z > waterZ ? P.sand : P.wetSand } : gullyAt(x) && z > 0.05 && z < H - 0.05 ? { fill: P.lane, surface: 'mud' } : { fill: P.ground, surface: 'mud' }),
    riserTint: (h) => (h >= 4 ? P.cliff : P.wetSand),
    // the Wei is silty: clear only over the bars' shoulders, near opaque over the channel
    water: { z: waterZ, fill: P.water, ...(Wt.look ? { liquid: { ...Wt.look, unit: 1 / 3.66 }, sheetFill: P.water, alphaAt: (x, y) => Math.max(0.55, Math.min(0.95, 0.55 + 0.3 * (waterZ - bedAt(x, y)))), fine: (x, y) => bars.some((b) => Math.abs(x - b.cx) < b.len / 2 + 15 && Math.abs(y - b.cy) < b.wid / 2 + 15), fineSize: 5 } : {}) },
  });
  grounds.unshift(...T0.grounds);
  boxes.push(...T0.boxes);
  // the riverbed under the water, for the World page (the CSS page draws the river opaque and leaves it out)
  const riverbed = [];
  if (Wt.look) for (let y = rv.y0 - bank; y < rv.y1 + bank; y += 5) for (let x = 0; x < Wf; x += 10) {
    const c = [[x, y], [x + 10, y], [x + 10, y + 5], [x, y + 5]].map(([a, b]) => [a, b, Math.min(hAt(a, b), waterZ - 0.05)]);
    for (const tri of [[c[0], c[1], c[2]], [c[0], c[2], c[3]]]) {
      const zs = tri.map((p) => p[2]);
      riverbed.push({ kind: 'riverbed', solid: 'panel', pts: tri, out: [0, 0, 1], x, y, w: 10, d: 5, z0: Math.min(...zs), z1: Math.max(...zs), tint: Wt.bed || P.wetSand, skin: null });
    }
  }
  // the axis climbs the bluff as a causeway of rammed earth, from the east–west avenue up to the que
  boxes.push({ kind: 'causeway', solid: 'wedge', x: ramp.x, y: ramp.y0, w: A, d: ramp.y1 - ramp.y0, z0: 0, z1: H, rise: 'y-', tint: P.lane, skin: 'hangtu' });
  runs(grid, cols, rows, (v) => v === C.LANE || v === C.OPEN, (c, r, n) => grounds.push({ kind: 'lane', x: c * CELL, y: r * CELL - (r % 2 ? 0.08 : 0), w: n * CELL + 0.15, d: CELL + (r % 2 ? 0.16 : 0), z: laneZ(0, r), fill: P.lane, surface: 'mud' }));
  // fields on the loess outside the town: north of the wards either side of the palace, and across the river
  const F = stream(seed, 'fields'), busy = [pal, ...wards, works, { x: ax - 12, y: rv.y1, w: 24, d: Df - rv.y1 }];
  const clear = (x, y) => !busy.some((o) => x < o.x + o.w + 4 && x + TC > o.x - 4 && y < o.y + o.d + 4 && y + TC > o.y - 4);
  for (let y = 0; y < Df; y += TC) for (let x = 0; x < Wf; x += TC) {
    if (isRiver(y) || isRiver(y + TC) || (y >= rowN.y0 - 14 && y < road.y1 + 4) || !clear(x, y)) continue;
    const zf = zAt(x + 1, y + 1);
    if (zf !== zAt(x + TC - 1, y + TC - 1) || zf !== zAt(x + TC - 1, y + 1) || zf !== zAt(x + 1, y + TC - 1) || gullyAt(x + TC / 2)) continue;   // a field lies on one level
    if (F() < 0.85) grounds.push({ kind: 'field', x: x + 0.7, y: y + 0.7, w: TC - 1.4, d: TC - 1.4, z: zf + 0.03, fill: pick(P.field, F) });
    if (F() < 0.12) plant(x + F() * TC, y + F() * TC, { crown: F() < 0.5 ? 'poplar' : 'round' });
  }

  skinLoose(boxes, K);
  return {
    boxes, grounds, views, frame: { w: Wf, d: Df }, slots, hAt,
    // what only the World page draws: the riverbed under the water, and the land beyond the frame out to the hills
    world: { boxes: [...riverbed, ...qinHorizon({ Wf, Df, H, edge: TB.edge, rv, bank, waterZ, P, seed })] },
    stats: {
      culture, houses, gardens, trees, wards: wards.filter((w) => !w.market).length, eliteWards: wards.filter((w) => w.elite).length,
      precinct: pal, palace: pal, hall: hall1, que: queR, market: { x: mk.x, y: mk.y, w: mk.w, d: mk.d }, works, river: rv, axis: ax,
      tableland: { h: H, edge: TB.edge }, gullies: gullies.length, bars: bars.map((b) => ({ ...b })), causeway: { ...ramp, w: A }, terrain: T0.stats,
      laneCells: grid.reduce((n, v) => n + (v === C.LANE ? 1 : 0), 0),
    },
    grid: { cols, rows, cell: CELL, data: grid, codes: C },
  };
}

/**
 * Beyond the frame, for the World page only: the tableland and its bluff, the plain and the river run on a
 * few kilometres, to the Qinling in the south and the northern hills. The hills are scaled down and brought
 * in (the Qinling stands some 40 km off) so they sit low on the horizon at about their real angle. Flat
 * hazy colours, no textures. Metres, like the plan.
 */
function qinHorizon({ Wf, Df, H, edge, rv, bank, waterZ, P, seed }) {
  const out = [], X0 = -6000, X1 = Wf + 6000, Y0 = -5000, Y1 = Df + 5000, U = stream(seed, 'horizon');
  const quad = (pts, outv, tint) => {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), zs = pts.map((p) => p[2]);
    out.push({ kind: 'horizon', solid: 'panel', pts, out: outv, x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), d: Math.max(...ys) - Math.min(...ys), z0: Math.min(...zs), z1: Math.max(...zs), tint });
  };
  const flat = (x0, y0, x1, y1, z, tint) => quad([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], [0, 0, 1], tint);
  const up = scaleHex(P.plainFar, 1.02);
  flat(X0, Y0, X1, 0, H, up);                                      // the tableland north of the frame
  for (const [a, b] of [[X0, 0], [Wf, X1]]) {
    flat(a, 0, b, edge, H, up);                                    // …and either side of it
    quad([[a, edge, 0], [b, edge, 0], [b, edge, H], [a, edge, H]], [0, 1, 0], P.cliff);   // the bluff, sheer
    flat(a, edge, b, rv.y0 - bank, 0, P.plainFar);                 // the plain to the river
    quad([[a, rv.y0 - bank, 0], [b, rv.y0 - bank, 0], [b, rv.y0, waterZ], [a, rv.y0, waterZ]], [0, 1, 0.6], P.bank);
    flat(a, rv.y0, b, rv.y1, waterZ, P.water);                     // the river
    quad([[a, rv.y1, waterZ], [b, rv.y1, waterZ], [b, rv.y1 + bank, 0], [a, rv.y1 + bank, 0]], [0, -1, 0.6], P.bank);
    flat(a, rv.y1 + bank, b, Df, 0, P.plainFar);
  }
  flat(X0, Df, X1, Y1, 0, P.plainFar);                             // the plain south to the hills
  // a ridge: a row of vertical panels along y, its crest a sum of waves
  const ridge = (y, base, lo, hi, tint, outv) => {
    const ph = [U() * 6, U() * 6, U() * 6], n = 48, crest = (x) => lo + (hi - lo) * (0.5 + 0.25 * Math.sin(x / 1900 + ph[0]) + 0.17 * Math.sin(x / 710 + ph[1]) + 0.08 * Math.sin(x / 260 + ph[2]));
    for (let i = 0; i < n; i++) {
      const a = X0 - 2000 + ((X1 - X0 + 4000) * i) / n, b = X0 - 2000 + ((X1 - X0 + 4000) * (i + 1)) / n;
      quad([[a, y, base], [b, y, base], [b, y, base + crest(b)], [a, y, base + crest(a)]], outv, tint);
    }
  };
  // each ridge stands on the edge of the ground, so no gap shows under it
  ridge(Y1, 0, 220, 420, P.hazeFar, [0, -1, 0]);                   // the Qinling
  ridge(Y1 - 2000, 0, 40, 120, P.haze, [0, -1, 0]);                // its foothills
  ridge(Y0, H, 50, 140, P.hazeFar, [0, 1, 0]);                     // the northern hills
  return out;
}
