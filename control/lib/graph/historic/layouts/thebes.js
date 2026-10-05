/**
 * historic/layouts/thebes — the 'river-axis' layout: a New Kingdom Theban town on the east bank of the
 * Nile. The plan, in order:
 *
 *   the river along the west edge (a smooth bank, sloping earth banks, the water well below the town)
 *   → the temple axis, square to the river: a stone quay → an avenue of ram-headed sphinxes → obelisks
 *     and seated colossi → the pylon (in the enclosure's west wall) → the open court → the second
 *     pylon → the hypostyle hall → the sanctuary
 *   → the mudbrick enclosure round it, a stone gate in its south wall; the sacred lake south of the
 *     temple, storerooms north of it, the priests' houses at the back
 *   → the southern processional way, lined with sphinxes, from that gate through the town
 *   → the town: an unwalled spread of mudbrick houses and walled villas on streets and alleys
 *   → fields, palm groves and shadufs between the town and the river.
 *
 * Like the ring-canal layout it only emits SLOTS; the culture's kit builds them. Plans in metres.
 */
import { palm } from '../patterns.js';
import { CELL, C, LAYER, laneZ, stream, pick, claimGrid, runs, alleyLattice, packLots, lotSlot, placeSlots, skinLoose } from '../layout-kit.js';

/** The river's water's edge (x, metres in the town's frame) as a function of y, continued past the frame. */
export function riverBankX({ width, amp, period, ph }) {
  return (y) => width + amp * Math.sin((y / period) * 6.283 * 0.7 + ph);
}

export function planRiverAxis({ seed = 1, culture = 'thebes', frame = { w: 440, d: 330 }, assets } = {}, K) {
  const P = K.palette, g = claimGrid(frame), { cols, rows, grid, at, set } = g, Wf = cols * CELL, Df = rows * CELL;
  const boxes = [], grounds = [], slots = [], L = stream(seed, 'layout');

  // ── 1. the river: the bank meanders gently down the west edge; west of it is water ──
  const R = K.river, sink = R.sink, waterZ = -sink, ph = L() * 6.283;
  const river = { width: R.width, amp: 7, period: Df, ph, bank: R.bank, sink }, bankAt = riverBankX(river);   // x of the water's edge
  const topAt = (y) => bankAt(y) + R.bank;                                     // x where the sloping bank meets the plain
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = (c + 0.5) * CELL, y = (r + 0.5) * CELL;
    if (x < bankAt(y)) set(c, r, C.WATER); else if (x < topAt(y) + CELL) set(c, r, C.OPEN);   // the bank: open, unbuilt
  }

  // ── 2. the town's reach: an unwalled spread east of a band of fields along the river ──
  const fieldBand = 42, tcx = Wf * 0.6, tcy = Df * 0.5, trx = Wf * 0.46, try_ = Df * 0.5;
  const inTown = (x, y) => x > topAt(y) + fieldBand && ((x - tcx) / trx) ** 2 + ((y - tcy) / try_) ** 2 < 1;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (at(c, r) === C.EMPTY && !inTown((c + 0.5) * CELL, (r + 0.5) * CELL)) set(c, r, C.OUTSIDE);

  // ── 3. the temple axis and the enclosure ──
  const T = K.temple, [TW, TD] = K.temenos.size, wt = K.temenos.wall;
  const ay = Math.round((Df * (0.46 + L() * 0.08)) / CELL) * CELL + CELL / 2;   // the axis, y
  const tx0 = Math.round((topAt(ay) + fieldBand + 62) / CELL) * CELL, ty0 = ay - TD / 2, tx1 = tx0 + TW, ty1 = ay + TD / 2;
  const claim = (x, y, w, d, v) => { for (let r = Math.floor(y / CELL); r < Math.ceil((y + d) / CELL); r++) for (let c = Math.floor(x / CELL); c < Math.ceil((x + w) / CELL); c++) if (at(c, r) !== C.WATER) set(c, r, v); };
  claim(tx0 - wt / 2, ty0 - wt / 2, TW + wt, TD + wt, C.PRECINCT);
  // the priests' quarter at the back of the enclosure stays open to be packed with their houses
  const backX = tx0 + 150;
  claim(backX, ty0 + wt / 2 + 3, tx1 - wt / 2 - 3 - backX, TD - wt - 6, C.EMPTY);
  const priestRing = [];   // a lane round the quarter's edge, so each priest's house has a way in from the temple
  for (let r = Math.floor((ty0 + wt / 2 + 3) / CELL); r < Math.ceil((ty1 - wt / 2 - 3) / CELL); r++) for (let c = Math.floor(backX / CELL); c < Math.ceil((tx1 - wt / 2 - 3) / CELL); c++) {
    const edge = at(c - 1, r) !== C.EMPTY || at(c + 1, r) !== C.EMPTY || at(c, r - 1) !== C.EMPTY || at(c, r + 1) !== C.EMPTY;
    if (at(c, r) === C.EMPTY && edge) priestRing.push([c, r]);
  }
  for (const [c, r] of priestRing) set(c, r, C.LANE);
  const temenos = { x: tx0, y: ty0, w: TW, d: TD };

  // the enclosure walls (the pylon stands in the west wall, the stone gate in the south)
  const [pyW, pyD] = T.pylon, gateX = tx0 + TW * 0.6, gateW = 14;
  const wall = (rect, facing) => slots.push({ asset: 'eg-temenos-wall', rect, facing });
  wall({ x: tx0 - wt / 2, y: ty0 - wt / 2, w: TW + wt, d: wt }, 'n');
  wall({ x: tx1 - wt / 2, y: ty0 + wt / 2, w: wt, d: TD - wt }, 'e');
  wall({ x: tx0 - wt / 2, y: ty1 - wt / 2, w: gateX - gateW / 2 - (tx0 - wt / 2), d: wt }, 's');
  wall({ x: gateX + gateW / 2, y: ty1 - wt / 2, w: tx1 + wt / 2 - gateX - gateW / 2, d: wt }, 's');
  wall({ x: tx0 - wt / 2, y: ty0 + wt / 2, w: wt, d: ay - pyW / 2 - ty0 - wt / 2 }, 'w');
  wall({ x: tx0 - wt / 2, y: ay + pyW / 2, w: wt, d: ty1 - wt / 2 - ay - pyW / 2 }, 'w');
  slots.push({ asset: 'eg-temenos-gate', rect: { x: gateX - gateW / 2, y: ty1 - 4.5, w: gateW, d: 9 }, facing: 's' });

  // the temple, west to east along the axis; each part faces the approach (west)
  let x = tx0 - pyD / 2;
  const part = (asset, len, across, extra = {}) => { const rect = { x, y: ay - across / 2, w: len, d: across }; slots.push({ asset, rect, facing: 'w', ...extra }); x += len; return rect; };
  const pylon1 = part('eg-pylon', pyD, pyW);
  const court = part('eg-court', T.court[1], T.court[0]);
  const [p2W, p2D] = T.pylon2;
  const pylon2 = part('eg-pylon', p2D, p2W);
  const hyp = part('eg-hypostyle', T.hypostyle[1], T.hypostyle[0]);
  x += 4;
  const sanct = part('eg-sanctuary', T.sanctuary[1], T.sanctuary[0]);
  // before the pylon: the seated colossi flanking its gate, the obelisks further out
  const pf = pylon1.x;
  for (const o of [-1, 1]) {
    slots.push({ asset: 'eg-colossus', rect: { x: pf - 10, y: ay + o * 8.5 - 3, w: 9, d: 6 }, facing: 'w' });
    slots.push({ asset: 'eg-obelisk', rect: { x: pf - 19, y: ay + o * 8.5 - 2, w: 4, d: 4 }, facing: 'w' });
  }
  slots.push({ asset: 'eg-offering', rect: { x: court.x + court.w / 2 - 2.5, y: ay - 2.5, w: 5, d: 5 }, facing: 'w' });
  // a stele either side of the second pylon's gate, in the court
  for (const o of [-1, 1]) slots.push({ asset: 'stele', rect: { x: pylon2.x - 4, y: ay + o * 7 - 1.4, w: 2.2, d: 2.8 }, facing: 'w' });
  // the sacred lake south of the hypostyle, the storerooms north of the temple
  const [lw, ld] = K.lake, lake = { x: hyp.x - 6, y: ay + T.hypostyle[0] / 2 + T.clear + 4, w: lw, d: ld };
  slots.push({ asset: 'eg-sacred-lake', rect: lake, facing: 'n' });
  for (let i = 0; i < 4; i++) slots.push({ asset: 'granary', rect: { x: tx0 + 14 + i * 30, y: ty0 + wt / 2 + 6, w: 16, d: 14 }, facing: 's' });

  // ── 4. the approach: the quay on the river, the avenue of sphinxes up to the pylon ──
  const qD = 26, qW = 16, qx = bankAt(ay) - (0.6 + sink) * 1.5;
  slots.push({ asset: 'eg-quay', rect: { x: qx, y: ay - qD / 2, w: qW, d: qD }, facing: 'w', waterZ });
  const av0 = qx + qW, av1 = pf - 21, avW = K.avenue.width;
  for (const [o, facing] of [[-1, 's'], [1, 'n']]) slots.push({ asset: 'eg-sphinx-row', rect: { x: av0 + 2, y: o < 0 ? ay - avW / 2 - 6 : ay + avW / 2, w: av1 - av0 - 2, d: 6 }, facing });
  claim(av0, ay - avW / 2 - 7, pf - av0, avW + 14, C.PRECINCT);
  grounds.push({ kind: 'avenue', x: av0, y: ay - avW / 2, w: pf - av0, d: avW, z: 0.05, fill: P.paving, surface: 'flagstone' });

  // ── 5. the town's streets: the southern processional way from the enclosure gate, a road along the
  // fields, cross streets; then the alley grid between them ──
  const laneCells = [], S = { MUD: 0, STREET: 1 }, surf = new Uint8Array(cols * rows);
  const street = (c0, r0, c1, r1, width) => {
    for (let r = Math.min(r0, r1); r <= Math.max(r0, r1) + width - 1; r++) for (let c = Math.min(c0, c1); c <= Math.max(c0, c1) + width - 1; c++) {
      const v = at(c, r);
      if (v === C.EMPTY || v === C.OUTSIDE && inTown((c + 0.5) * CELL, (r + 0.5) * CELL)) { set(c, r, C.LANE); laneCells.push([c, r]); surf[r * cols + c] = S.STREET; }
    }
  };
  const gc = Math.floor(gateX / CELL), wide = Math.round(K.avenue.width / CELL);
  street(gc - Math.floor(wide / 2), Math.ceil(ty1 / CELL) + 2, gc - Math.floor(wide / 2), rows - 1, wide);          // the processional way south
  const roadC = Math.floor((topAt(ay) + fieldBand + 6) / CELL);
  street(roadC, 0, roadC, rows - 1, 2);                                                                              // the road along the fields
  for (const yy of [ty0 - 24, ty1 + 30, ty1 + 75, ty0 - 70]) { const r = Math.floor(yy / CELL); if (r > 1 && r < rows - 2) street(roadC, r, cols - 1, r, 2); }
  const ex = Math.floor((tx1 + 20) / CELL); street(ex, 0, ex, rows - 1, 2);                                          // a street behind the enclosure
  // the processional way is lined with sphinxes, in runs between the cross streets
  const avX = (gc - Math.floor(wide / 2)) * CELL;
  for (let r = Math.ceil(ty1 / CELL) + 4; r < rows - 4;) {
    let n = 0; while (r + n < rows - 2 && [-3, wide + 2].every((dc) => at(gc - Math.floor(wide / 2) + dc, r + n) === C.EMPTY || at(gc - Math.floor(wide / 2) + dc, r + n) === C.OPEN) && n < 30) n++;
    if (n >= 6) for (const [side, facing] of [[-1, 'e'], [1, 'w']]) {
      const x0 = side < 0 ? avX - 6.2 : avX + wide * CELL + 0.2, rect = { x: x0, y: r * CELL + 1, w: 6, d: n * CELL - 2 };
      slots.push({ asset: 'eg-sphinx-row', rect, facing }); claim(rect.x, rect.y, rect.w, rect.d, C.OPEN);
    }
    r += Math.max(1, n) + 1;
  }
  alleyLattice(g, K.lanes.block, seed, laneCells, { jog: 0.03 });   // New Kingdom towns run straighter than Sumer's

  // ── 6. houses and villas on the lots that are left ──
  const H = K.house;
  for (const lot of packLots(g, H.size, seed)) slots.push(lotSlot(g, lot, H.gap, (rect) => (Math.min(rect.w, rect.d) >= H.villaMin ? 'eg-villa' : 'eg-house')));

  // ── 7. the river's life: ships on the water, shadufs on the bank by the fields ──
  const ST = stream(seed, 'street');
  for (let y = 12; y < Df - 30; y += 34 + ST() * 30) {
    if (Math.abs(y - ay) < 26) continue;
    slots.push({ asset: 'eg-nile-ship', rect: { x: bankAt(y) - 34 - ST() * 22, y, w: 20, d: 11 }, facing: ST() < 0.5 ? 'n' : 's', z: waterZ + 0.05 });
  }
  for (let y = 8; y < Df - 10; y += 22 + ST() * 16) {
    if (Math.abs(y - ay) < 24) continue;
    const xs = topAt(y) - 2.2;
    slots.push({ asset: 'eg-shaduf', rect: { x: xs, y: y - 1.4, w: 6.5, d: 2.8 }, facing: 'w' });
  }

  // ── place every slot ──
  placeSlots(slots, assets || K.assets, K, seed, boxes, grounds, culture);

  // ── 8. ground: the river and its banks, the plain, streets, fields and groves ──
  const fill = P.water;
  for (let r = 0; r < rows; r++) {
    const y0 = r * CELL, y1 = y0 + CELL, w0 = bankAt(y0), w1 = bankAt(y1), t0 = topAt(y0), t1 = topAt(y1), ov = 0.25;
    // the water: a rect to the nearer edge and the sliver the meander leaves
    // in short pieces: a camera on the water stands inside the river, and a face reaching behind the eye is dropped whole
    // (overlaps that close seams go on alternate pieces only: the World's de-overlap lifts each face one
    // step above whatever it overlaps, so a chain of overlapping strips would climb into the sky)
    // — so the overlapping rows lie a few millimetres above the rest, on a plane of their own)
    const oy = r % 2 ? ov : 0, lift = r % 2 ? LAYER : 0;
    for (let xx = 0, xe = Math.min(w0, w1); xx < xe; xx += 12) grounds.push({ kind: 'water', x: xx, y: y0 - oy, w: Math.min(12, xe - xx), d: CELL + 2 * oy, z: waterZ + lift, fill });
    if (Math.abs(w0 - w1) > 1e-6) grounds.push({ kind: 'water', poly: w0 < w1 ? [[w0, y0], [w1, y1], [w0, y1]] : [[w1, y0], [w0, y0], [w1, y1]], z: waterZ, fill });
    // the sloping earth bank from the water up to the plain
    boxes.push({ kind: 'river-bank', solid: 'panel', pts: [[w0 - 0.5, y0 - 0.1, waterZ - 0.3], [w1 - 0.5, y1 + 0.1, waterZ - 0.3], [t1, y1 + 0.1, 0], [t0, y0 - 0.1, 0]], out: [-1, 0, 0.4], x: w0, y: y0, w: R.bank, d: CELL, z0: waterZ, z1: 0, tint: P.bank });
    // the plain, from the bank's top to the east edge
    const tx = Math.max(t0, t1);
    // the plain, cut round the sunken sacred lake (nothing is laid over its water)
    const cut = y1 > lake.y && y0 < lake.y + lake.d ? [[tx, lake.x], [lake.x + lake.w, Wf]] : [[tx, Wf]];
    for (const [a, b] of cut) if (b > a) grounds.unshift({ kind: 'ground', x: a, y: y0 - (r % 2 ? 0.06 : 0), w: b - a, d: CELL + (r % 2 ? 0.12 : 0), z: 0.01 + (r % 2 ? LAYER : 0), fill: P.ground, surface: 'dry-earth' });
    if (Math.abs(t0 - t1) > 1e-6) grounds.unshift({ kind: 'ground-edge', poly: t0 < t1 ? [[t0, y0], [t1, y0], [t1, y1]] : [[t1, y1], [t0, y1], [t0, y0]], z: 0.01, fill: P.ground });
  }
  // the enclosure floor round the sacred lake (the lake is sunk; nothing is laid over it)
  const fl = { x: tx0 + wt / 2, y: ty0 + wt / 2, w: TW - wt, d: TD - wt };
  for (const r of [
    { x: fl.x, y: fl.y, w: fl.w, d: lake.y - fl.y }, { x: fl.x, y: lake.y + lake.d, w: fl.w, d: fl.y + fl.d - lake.y - lake.d },
    { x: fl.x, y: lake.y, w: lake.x - fl.x, d: lake.d }, { x: lake.x + lake.w, y: lake.y, w: fl.x + fl.w - lake.x - lake.w, d: lake.d },
  ]) if (r.w > 0 && r.d > 0) grounds.push({ kind: 'precinct-floor', ...r, z: 0.018, fill: P.court, surface: 'dry-earth' });   // its own layer: under the lanes and courts laid on it
  const laneSurface = { [S.MUD]: ['mud', P.lane], [S.STREET]: ['rubble', P.street] };
  for (const sv of [S.MUD, S.STREET]) {
    const [surface, f] = laneSurface[sv];
    // open ground in the town (beside the sphinx rows, a lot too small to build) is walked like a lane;
    // the river bank's open cells are the bank's own
    runs(grid, cols, rows, (v, c, r) => (v === C.LANE || (v === C.OPEN && (c + 0.5) * CELL > topAt((r + 0.5) * CELL) + CELL * 1.5)) && surf[r * cols + c] === sv, (c, r, n) => grounds.push({ kind: 'lane', x: c * CELL, y: r * CELL - (r % 2 ? 0.08 : 0), w: n * CELL + 0.15, d: CELL + (r % 2 ? 0.16 : 0), z: laneZ(sv, r), fill: f, surface }));   // odd rows overlap their neighbours (see the water)
  }
  // fields in the river band and round the town, palm groves, palms along the streets
  const G = stream(seed, 'groves');
  let palms = 0;
  for (let r = 0; r < rows; r += 4) for (let c = 0; c < cols; c += 4) {
    if (at(c, r) !== C.OUTSIDE || [0, 1, 2, 3].some((k) => at(c + k, r) === C.OPEN || at(c, r + k) === C.OPEN || at(c + k, r + 3) === C.OPEN)) continue;
    if (G() < 0.72) grounds.push({ kind: 'field', x: c * CELL, y: r * CELL, w: 4 * CELL - 0.4, d: 4 * CELL - 0.4, z: 0.02, fill: pick(P.field, G) });
    if (palms < K.groves.max && G() < K.groves.density * 0.5) for (let k = 0; k < 1 + Math.floor(G() * 3); k++) {
      const px = c * CELL + G() * 12, py = r * CELL + G() * 12;
      if (at(Math.floor(px / CELL), Math.floor(py / CELL)) === C.OUTSIDE) { boxes.push(palm(px, py, G)); palms++; }
    }
  }

  // ── 9. views ──
  const gx = gateX;
  const views = {
    // in the avenue of sphinxes, walking up from the quay toward the pylon, the obelisks and colossi ahead
    avenue: { eye: [av0 + 8, ay + 2.4, 1.7], at: [pf, ay, 11] },
    // in the open court, near its west end, looking up the axis to the second pylon and the hypostyle
    temple: { eye: [court.x + 6, ay + 9, 1.7], at: [hyp.x + 8, ay - 2, 8] },
    // from a boat on the Nile, off the quay, the pylon beyond
    river: { eye: [bankAt(ay - 40) - 38, ay - 40, waterZ + 2.2], at: [pf, ay, 10] },
    // in the southern processional way, looking north at the enclosure's stone gate
    street: { eye: [gx + 1.2, Math.min(Df - 6, ty1 + 70), 1.7], at: [gx, ty1, 9] },
  };

  skinLoose(boxes, K);
  return {
    boxes, grounds, views, frame: { w: Wf, d: Df }, slots,
    focus: [sanct.x + sanct.w / 2, ay],   // the temple's reliefs face its sanctuary
    river,                                // the Nile's line, so a region can carry it on past the frame
    stats: {
      culture, houses: slots.filter((q) => q.asset === 'eg-house').length, villas: slots.filter((q) => q.asset === 'eg-villa').length,
      palms, precinct: temenos, axis: { y: ay, quay: qx, pylon: pf, court: court.x, pylon2: pylon2.x, hypostyle: hyp.x, sanctuary: sanct.x },
      laneCells: grid.reduce((n, v) => n + (v === C.LANE ? 1 : 0), 0),
    },
    grid: { cols, rows, cell: CELL, data: grid, codes: C },
  };
}
