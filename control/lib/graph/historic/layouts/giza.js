/**
 * historic/layouts/giza — the 'plateau' layout: the royal necropolis of Giza under Menkaure (c. 2515
 * BCE), the first site on the template whose ground is not flat. The plan, in order:
 *
 *   the ground: a desert plateau ~45 m over the floodplain, falling to the valley down an escarpment
 *     (`hAt`), the Sphinx's quarry cut down to the valley floor
 *   → the three pyramid complexes on the plateau, NE to SW: Khufu, Khafre, Menkaure. Each one is a
 *     pyramid on its court inside a wall → the mortuary temple on its east face → a roofed causeway down
 *     the escarpment → the valley temple on a harbour
 *   → Khufu's queens' pyramids and boat pits; the mastaba streets of the western and eastern cemeteries
 *   → the Great Sphinx in its quarry beside Khafre's causeway, its temple before it
 *   → the Wall of the Crow, and south of it the workers' town (galleries, bakeries, houses on lanes)
 *   → the floodplain: a canal, the harbour basins, fields, and ships bringing Tura limestone.
 *
 * Slots stand on the ground at their centre (`z` = `hAt`). Plans in metres; x east, y south.
 */
import { palm } from '../patterns.js';
import { causeway } from '../assets/giza.js';
import { CELL, C, LAYER, laneZ, stream, pick, claimGrid, runs, alleyLattice, packLots, lotSlot, placeSlots, skinLoose } from '../layout-kit.js';
import { scaleHex } from '../../polygonizer/vexar.js';

const TC = 20;   // terrain cell, metres
// alternate terrain rows overlap their neighbours a hair (the page's seams); 20 m rows are big enough that
// the World's de-overlap pass reads `LAYER` as the same plane, so they sit ten layers apart
const TERRAIN_LAYER = 10 * LAYER;

export function planPlateau({ seed = 1, culture = 'giza', frame = { w: 1160, d: 1020 }, assets, pyramidion } = {}, K) {
  const P = K.palette, g = claimGrid(frame), { cols, rows, grid, at, set } = g, Wf = cols * CELL, Df = rows * CELL;
  const boxes = [], grounds = [], slots = [], L = stream(seed, 'layout');
  const Hp = K.plateau.height;

  // ── 1. the ground: the plateau, the escarpment down to the valley, the Sphinx's quarry ──
  // each row of the plateau is flat to `xa`, falls to the valley floor by `xb` (keyframes north to south):
  // steep under Khufu, the edge swinging south-west past the Sphinx, a long gentle ramp where Khafre's
  // causeway climbs, then the wadi mouth where the workers' town lies
  const EDGE = [[-10, 920, 980], [390, 920, 980], [470, 840, 900], [530, 715, 775], [600, 715, 775], [640, 452, 780], [720, 452, 760], [790, 380, 540], [1030, 200, 360]];
  const edgeAt = (y) => {
    const k = Math.max(0, EDGE.findIndex((e, i) => i < EDGE.length - 1 && y <= EDGE[i + 1][0]));
    const [y0, a0, b0] = EDGE[k], [y1, a1, b1] = EDGE[k + 1], t = Math.max(0, Math.min(1, (y - y0) / (y1 - y0)));
    return [a0 + (a1 - a0) * t, b0 + (b1 - b0) * t];
  };
  const quarry = { x: 690, y: 540, w: 90, d: 60 };   // cut down to the valley floor round the Sphinx
  const inRect = (r, x, y) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.d;
  // the rock round the Sphinx stands lower (a bench ~20 m up, rising back to the plateau): the quarry is
  // about as deep as the Sphinx is tall
  const toQuarry = (x, y) => Math.hypot(Math.max(quarry.x - x, 0, x - quarry.x - quarry.w), Math.max(quarry.y - y, 0, y - quarry.y - quarry.d));
  const natural = (x, y) => { const [xa, xb] = edgeAt(y); return Math.min(Hp * Math.max(0, Math.min(1, (xb - x) / (xb - xa))), 20 + 0.5 * toQuarry(x, y)); };
  const hAt = (x, y) => (inRect(quarry, x, y) ? 0 : natural(x, y));

  // ── 2. the water: a canal along the valley, a branch to Khafre's harbour, the harbour basins ──
  const CW = K.canal, waterZ = -CW.sink;
  const water = [
    { x: 1100, y: 0, w: 40, d: Df },          // the canal
    { x: 960, y: 600, w: 140, d: 40 },        // the branch west to Khafre's harbour
    { x: 900, y: 580, w: 60, d: 80 },         // Khafre's harbour, ~60 m east of the Sphinx temple (Lehner's basin)
    { x: 1060, y: 220, w: 40, d: 60 },        // Khufu's harbour
  ];
  const isWater = (x, y) => water.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.d);
  const occupied = [];   // slot rects (and the causeways' runs): no fields under them
  const slot = (s) => { slots.push(s); occupied.push(s.rect); return s; };
  const onGround = (s) => slot({ ...s, z: hAt(s.rect.x + s.rect.w / 2, s.rect.y + s.rect.d / 2) });

  // ── 3. the pyramid complexes ──
  const PY = K.pyramids, court = 10;
  const complex = (name, cx, cy, temple, valley, { roof = true, unfinished = false } = {}) => {
    const p = PY[name], S = p.base + 2 * court, rect = { x: cx - S / 2, y: cy - S / 2, w: S, d: S };
    onGround({ asset: 'gz-pyramid', rect, facing: 'e', slope: p.slope, granite: p.granite || 0, rough: !!p.rough, court, gap: temple[1], name, pyramidion });
    const mt = onGround({ asset: 'gz-mortuary-temple', rect: { x: rect.x + S, y: cy - temple[1] / 2, w: temple[0], d: temple[1] }, facing: 'e' });
    const vt = onGround({ asset: 'gz-valley-temple', rect: valley, facing: 'e', unfinished });
    // the causeway, from the temple's door down to the valley temple's back
    const a = [mt.rect.x + mt.rect.w, cy], b = [vt.rect.x, vt.rect.y + vt.rect.d * 0.3];
    const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 20)), path = [];
    for (let i = 0; i <= n; i++) { const x = a[0] + ((b[0] - a[0]) * i) / n, y = a[1] + ((b[1] - a[1]) * i) / n; path.push([x, y, hAt(x, y)]); }
    boxes.push(...causeway(path, { tint: P.tura, roof }));
    occupied.push({ x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]) - 5, w: Math.abs(b[0] - a[0]), d: Math.abs(b[1] - a[1]) + 10 });
    return { rect, temple: mt.rect, valley: vt.rect, path };
  };
    // Khufu's valley temple is known only from a basalt pavement: its block here is a stand-in
  const khufu = complex('khufu', 500, 250, [40, 52], { x: 1008, y: 228, w: 52, d: 45 });
  const khafre = complex('khafre', 290, 600, [44, 44], { x: 783, y: 604, w: 57, d: 45 }, { roof: false });
  const menk = complex('menkaure', 130, 880, [36, 36], { x: 492, y: 860, w: 48, d: 40 }, { roof: false, unfinished: true });

  // Khufu's queens' pyramids in a row on his east side, south of the causeway; his boat pits
  for (const cy of [318, 376, 434]) onGround({ asset: 'gz-queen-pyramid', rect: { x: 680, y: cy - 24, w: 54, d: 48 }, facing: 'e', pyramidion });
  for (const x of [420, 500]) onGround({ asset: 'gz-boat-pit', rect: { x, y: 378, w: 45, d: 6 }, facing: 'n', covered: true });
  for (const y of [204, 282]) onGround({ asset: 'gz-boat-pit', rect: { x: 632, y, w: 44, d: 7 }, facing: 'n' });
  // the kings' satellite (cult) pyramids: Khufu's G1d off his south-east corner, Khafre's south of his on the axis
  onGround({ asset: 'gz-queen-pyramid', rect: { x: 628, y: 300, w: 22, d: 22 }, facing: 'e', chapel: false, pyramidion });
  onGround({ asset: 'gz-queen-pyramid', rect: { x: 280, y: 722, w: 20, d: 20 }, facing: 'e', chapel: false, pyramidion });
  // Menkaure's queens, south of his pyramid
  for (const x of [75, 125]) onGround({ asset: 'gz-queen-pyramid', rect: { x, y: 952, w: 44, d: 40 }, facing: 'e', pyramidion });

  // ── 4. the cemeteries: mastabas in streets, each chapel to the east ──
  const M = stream(seed, 'mastabas'), streetsY = [];
  // the core cemeteries were laid out on a grid: rows of tombs across the field, E–W streets between them
  const field = (x0, x1, y0, y1, len, dep, gx, gy, tag) => {
    const rowsY = [];
    for (let y = y0; ;) { const l = len[0] + M() * (len[1] - len[0]); if (y + l > y1) break; rowsY.push([y, l]); y += l + gy; if (tag) streetsY.push(y - gy / 2); }
    for (let x = x0; ;) {
      const d = dep[0] + M() * (dep[1] - dep[0]);
      if (x + d > x1) break;
      for (const [y, l] of rowsY) if (M() < 0.9) onGround({ asset: 'gz-mastaba', rect: { x, y, w: d, d: l }, facing: 'e' });
      x += d + gx;
    }
  };
  field(90, 352, 70, 440, [20, 30], [10, 14], 8, 7, 'west');   // the Western Cemetery
  field(742, 830, 292, 420, [36, 52], [18, 24], 9, 8);      // the Eastern Cemetery: the great double mastabas of the king's family
  field(420, 610, 396, 462, [16, 24], [9, 12], 7, 6);       // between Khufu and Khafre

  // the work still going on: Menkaure's temples a building site, the main quarry south of Khafre, Tura
  // limestone landed on the quays
  onGround({ asset: 'gz-works', rect: { x: 196, y: 820, w: 48, d: 34 }, facing: 's' });
  onGround({ asset: 'gz-works', rect: { x: 492, y: 905, w: 48, d: 30 }, facing: 'n' });
  onGround({ asset: 'gz-quarry', rect: { x: 262, y: 748, w: 108, d: 52 }, facing: 'n' });
  onGround({ asset: 'gz-works', rect: { x: 1018, y: 194, w: 40, d: 26 }, facing: 'n', stockpile: true });
  onGround({ asset: 'gz-works', rect: { x: 850, y: 668, w: 40, d: 22 }, facing: 'n', stockpile: true });

  // ── 5. the Great Sphinx in its quarry, its temple before it ──
  onGround({ asset: 'gz-sphinx', rect: { x: 695, y: 560, w: 73, d: 20 }, facing: 'e' });
  onGround({ asset: 'gz-valley-temple', rect: { x: 783, y: 548, w: 52, d: 45 }, facing: 'e', open: true });
  // the quarry's walls: the rock face left standing round the cut, following the ground above it
  const qWall = (x0, y0, x1, y1, out) => {
    for (let i = 0; i < 6; i++) {
      const fa = i / 6, fb = (i + 1) / 6, ax = x0 + (x1 - x0) * fa, ay = y0 + (y1 - y0) * fa, bx = x0 + (x1 - x0) * fb, by = y0 + (y1 - y0) * fb;
      const ha = natural(ax, ay), hb = natural(bx, by);
      if (ha + hb < 0.5) continue;
      boxes.push({ kind: 'quarry', solid: 'panel', pts: [[ax, ay, -0.2], [bx, by, -0.2], [bx, by, hb], [ax, ay, ha]], out, x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.max(0.01, Math.abs(bx - ax)), d: Math.max(0.01, Math.abs(by - ay)), z0: 0, z1: Math.max(ha, hb), tint: P.bedrock });
    }
  };
  const q = quarry;
  qWall(q.x, q.y, q.x + q.w, q.y, [0, 1, 0]); qWall(q.x, q.y + q.d, q.x + q.w, q.y + q.d, [0, -1, 0]); qWall(q.x, q.y, q.x, q.y + q.d, [1, 0, 0]); qWall(q.x + q.w, q.y, q.x + q.w, q.y + q.d, [-1, 0, 0]);

  // ── 6. the Wall of the Crow and the workers' town south of it ──
  onGround({ asset: 'gz-wall-crow', rect: { x: 560, y: 795, w: 200, d: 10 }, facing: 's' });
  const town = { x: 540, y: 812, w: 360, d: Df - 812 - 4 };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) set(c, r, inRect({ x: town.x - 0.01, y: town.y - 0.01, w: town.w, d: town.d }, (c + 0.5) * CELL, (r + 0.5) * CELL) ? C.EMPTY : C.OUTSIDE);
  const claim = (x, y, w, d, v) => { for (let r = Math.floor(y / CELL); r < Math.ceil((y + d) / CELL); r++) for (let c = Math.floor(x / CELL); c < Math.ceil((x + w) / CELL); c++) if (at(c, r) === C.EMPTY || at(c, r) === C.LANE) set(c, r, v); };
  const laneCells = [], street = (x, y, w, d) => { for (let r = Math.floor(y / CELL); r < Math.ceil((y + d) / CELL); r++) for (let c = Math.floor(x / CELL); c < Math.ceil((x + w) / CELL); c++) if (at(c, r) === C.EMPTY) { set(c, r, C.LANE); laneCells.push([c, r]); } };
  street(town.x, 812, town.w, 15);    // North Street, along the wall
  street(town.x, 869, town.w, 30);    // Main Street
  street(town.x, 938, town.w, 9);     // the street south of the galleries
  for (const x of [588, 774]) street(x, 812, 9, town.d);
  // the galleries: blocks of eight long halls, their porches to the north
  for (const y0 of [830, 902]) for (const x0 of [600, 660, 714]) {
    claim(x0, y0, 54, 35, C.PRECINCT);
    for (let i = 0; i < 8; i++) slot({ asset: 'gz-gallery', rect: { x: x0 + i * 6.75, y: y0, w: 6, d: 35 }, facing: 'n', z: 0 });
  }
  // bakeries along the south street
  for (let x = 602; x < 760; x += 40) { claim(x, 950, 12, 9, C.PRECINCT); slot({ asset: 'gz-bakery', rect: { x, y: 950, w: 12, d: 9 }, facing: 'n', z: 0 }); }
  alleyLattice(g, K.lanes.block, seed, laneCells, { jog: 0.02 });   // a planned town: straight lanes
  for (const lot of packLots(g, K.house.size, seed)) { const s = lotSlot(g, lot, K.house.gap, () => 'gz-house'); slot({ ...s, z: 0 }); }

  // ── 7. ships on the canal and in the harbours, bringing stone ──
  const SH = stream(seed, 'ships');
  for (let y = 30; y < Df - 40; y += 70 + SH() * 60) slot({ asset: 'gz-ship', rect: { x: 1113, y, w: 6, d: 18 }, facing: SH() < 0.5 ? 'e' : 'w', z: waterZ + 0.05 });
  slot({ asset: 'gz-ship', rect: { x: 1070, y: 232, w: 18, d: 6 }, facing: 'n', z: waterZ + 0.05 });
  slot({ asset: 'gz-ship', rect: { x: 912, y: 592, w: 18, d: 6 }, facing: 'n', z: waterZ + 0.05 });
  slot({ asset: 'gz-ship', rect: { x: 990, y: 612, w: 18, d: 6 }, facing: 's', z: waterZ + 0.05 });

  placeSlots(slots, assets || K.assets, K, seed, boxes, grounds, culture);

  // ── 8. views (before the ground: the ground is cut fine round each eye) ──
  const cemStreet = streetsY.sort((a, b) => Math.abs(a - 250) - Math.abs(b - 250))[0] || 250;
  const views = {
    // on the roof of Khafre's valley temple: the Sphinx in its quarry, the causeway climbing, the two great pyramids behind
    valley: { eye: [792, 612, 15.1], at: [640, 530, 24] },
    // in Khufu's court at the foot of his pyramid's east face, looking up the face
    pyramid: { eye: [619, 138, Hp + 1.7], at: [500, 250, 110] },
    // down an E–W street of the Western Cemetery, Khufu's pyramid at its end
    cemetery: { eye: [78, cemStreet, Hp + 1.7], at: [500, cemStreet, 55] },
    // on Main Street in the workers' town, the Wall of the Crow and the pyramids beyond it
    town: { eye: [700, 884, 1.7], at: [420, 700, 40] },
    // from a boat in Khafre's harbour: the valley temple, the Sphinx temple, the causeway up to the pyramid
    harbour: { eye: [945, 650, waterZ + 2.2], at: [600, 600, 30] },
    // at the foot of Menkaure's causeway, by his unfinished valley temple and its building site: the
    // causeway climbing to his pyramid in its undressed granite, the quarry on the plateau to the north
    works: { eye: [528, 952, 1.7], at: [150, 880, 30] },
    // beside the apex of the Great Pyramid, the last courses and the capstone against the sky
    summit: { eye: [452, 222, Hp + 150], at: [500, 250, Hp + 140] },
  };

  // ── 9. ground: the terrain mesh, the water, the town's lanes, the fields ──
  const tcols = Math.ceil(Wf / TC), trows = Math.ceil(Df / TC), eyes = Object.values(views).map((v) => v.eye);
  const groundTint = (z) => scaleHex(P.valley, 1) === P.valley && z > Hp * 0.5 ? P.ground : z > 1 ? P.ground : P.valley;
  for (let r = 0; r < trows; r++) {
    const y0 = r * TC, y1 = Math.min(Df, y0 + TC);
    let run = null;
    const flush = () => { if (run) grounds.unshift({ kind: 'ground', x: run.x, y: y0 - (r % 2 ? 0.06 : 0), w: run.w, d: y1 - y0 + (r % 2 ? 0.12 : 0), z: run.z + 0.01 + (r % 2 ? TERRAIN_LAYER : 0), fill: run.z > 1 ? P.ground : P.valley, surface: run.z > 1 ? 'rubble' : 'mud' }); run = null; };
    for (let c = 0; c < tcols; c++) {
      const x0 = c * TC, x1 = Math.min(Wf, x0 + TC), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      if (isWater(mx, my)) { flush(); continue; }
      const inQ = inRect(quarry, mx, my);
      const hs = inQ ? [0, 0, 0, 0] : [natural(x0, y0), natural(x1, y0), natural(x1, y1), natural(x0, y1)];
      const flat = Math.max(...hs) - Math.min(...hs) < 0.05;
      // round an eye the ground is cut in 5 m squares: a face reaching behind the camera is dropped whole
      if (flat && eyes.some(([ex, ey]) => Math.hypot(mx - ex, my - ey) < 60)) {
        flush();
        for (let yy = y0; yy < y1; yy += 5) for (let xx = x0; xx < x1; xx += 5) grounds.unshift({ kind: 'ground', x: xx - 0.15, y: yy - 0.15, w: 5.3, d: 5.3, z: hs[0] + 0.01 + (((xx + yy) / 5) % 2 ? TERRAIN_LAYER : 0), fill: hs[0] > 1 ? P.ground : P.valley, surface: hs[0] > 1 ? 'rubble' : 'mud' });
        continue;
      }
      if (flat) {
        const z = hs[0];
        if (run && Math.abs(run.z - z) < 0.05 && Math.abs(run.x + run.w - x0) < 1e-6 && run.w < 40) run.w += x1 - x0;   // runs of at most ~40 m: a face many thousands of pixels wide starves the page's compositor, and one reaching behind an eye on the plateau is dropped else { flush(); run = { x: x0, w: x1 - x0, z }; }
        continue;
      }
      flush();
      // a sloping cell: two triangles of the escarpment
      const p = [[x0, y0, hs[0]], [x1, y0, hs[1]], [x1, y1, hs[2]], [x0, y1, hs[3]]], tint = groundTint((hs[0] + hs[2]) / 2);
      for (const tri of [[p[0], p[1], p[2]], [p[0], p[2], p[3]]]) boxes.push({ kind: 'escarpment', solid: 'panel', pts: tri, out: [0, 0, 1], x: x0, y: y0, w: x1 - x0, d: y1 - y0, z0: Math.min(...hs), z1: Math.max(...hs), tint });
    }
    flush();
  }
  // the water, in short pieces, and its stone edges where it meets the land
  for (const w of water) for (let y = w.y; y < w.y + w.d; y += TC) for (let x = w.x; x < w.x + w.w; x += TC) {
    const ri = Math.round(y / TC);
    const ov = ri % 2 ? 0.25 : 0;   // odd rows overlap their neighbours (closing the seams), a layer up
    grounds.push({ kind: 'water', x: x - ov, y: y - ov, w: Math.min(TC, w.x + w.w - x) + 2 * ov, d: Math.min(TC, w.y + w.d - y) + 2 * ov, z: waterZ + (ri % 2 ? TERRAIN_LAYER : 0), fill: P.water });
  }
  for (let y = 0; y < Df; y += TC) for (let x = 0; x < Wf; x += TC) {
    if (!isWater(x + TC / 2, y + TC / 2)) continue;
    for (const [dx, dy, edge] of [[-1, 0, [x, y, 0.5, TC]], [1, 0, [x + TC - 0.5, y, 0.5, TC]], [0, -1, [x, y, TC, 0.5]], [0, 1, [x, y + TC - 0.5, TC, 0.5]]]) {
      const nx = x + TC / 2 + dx * TC, ny = y + TC / 2 + dy * TC;
      if (nx < 0 || ny < 0 || nx > Wf || ny > Df || isWater(nx, ny)) continue;
      boxes.push({ kind: 'quay', x: edge[0], y: edge[1], w: edge[2], d: edge[3], z0: waterZ - 0.3, z1: 0.15, tint: P.limestone });
    }
  }
  // the town's lanes (and its open slivers, too small to build: walked like lanes)
  runs(grid, cols, rows, (v) => v === C.LANE || v === C.OPEN, (c, r, n) => grounds.push({ kind: 'lane', x: c * CELL, y: r * CELL - (r % 2 ? 0.08 : 0), w: n * CELL + 0.15, d: CELL + (r % 2 ? 0.16 : 0), z: laneZ(0, r), fill: P.lane, surface: 'mud' }));
  // fields on the floodplain, palms along the water
  const G = stream(seed, 'groves'), hit = (x, y, w, d) => occupied.some((o) => x < o.x + o.w + 6 && x + w > o.x - 6 && y < o.y + o.d + 6 && y + d > o.y - 6);
  let palms = 0;
  for (let y = 0; y < Df; y += TC) for (let x = 0; x < Wf; x += TC) {
    if (isWater(x + TC / 2, y + TC / 2) || inRect({ x: town.x - 10, y: town.y - 30, w: town.w + 20, d: town.d + 40 }, x + TC / 2, y + TC / 2)) continue;
    if ([[x, y], [x + TC, y], [x, y + TC], [x + TC, y + TC]].some(([px, py]) => natural(px, py) > 0.01) || hit(x, y, TC, TC)) continue;
    if (G() < 0.82) grounds.push({ kind: 'field', x: x + 0.3, y: y + 0.3, w: TC - 0.6, d: TC - 0.6, z: 0.03, fill: pick(P.field, G) });
    const nearWater = isWater(x + TC * 1.5, y + TC / 2) || isWater(x - TC / 2, y + TC / 2);
    if (palms < K.groves.max && G() < (nearWater ? 0.9 : K.groves.density * 0.25)) for (let k = 0; k < 1 + Math.floor(G() * 3); k++) { boxes.push(palm(x + G() * TC, y + G() * TC, G)); palms++; }
  }

  skinLoose(boxes, K);
  return {
    boxes, grounds, views, frame: { w: Wf, d: Df }, slots,
    stats: {
      culture, mastabas: slots.filter((s) => s.asset === 'gz-mastaba').length, galleries: slots.filter((s) => s.asset === 'gz-gallery').length,
      houses: slots.filter((s) => s.asset === 'gz-house').length, palms, precinct: khufu.rect,
      complexes: { khufu, khafre, menkaure: menk }, quarry, plateau: Hp,
      laneCells: grid.reduce((n, v) => n + (v === C.LANE ? 1 : 0), 0),
    },
    hAt,
    grid: { cols, rows, cell: CELL, data: grid, codes: C },
  };
}
