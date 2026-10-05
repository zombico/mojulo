/**
 * historic/layouts/pompeii — the 'lava-spur' layout: the western half of Pompeii on a summer morning of 79 CE.
 * The plan, in order:
 *
 *   the land: the lava spur, its top the town (z = 0), its south and west sides a bluff down to the plain
 *     (`site.spur` m: drawn, the record has no bluff height); the wall along the bluff's lip
 *   → the forum (143 × 38 m, the record), north–south: the Capitolium on its podium at the north end between
 *     two honorary arches, porticoes on three sides, statues few (not re-erected after 62)
 *   → round it, each where it stood: the Temple of Apollo in its court and the Basilica on the west side, either
 *     side of Via Marina; the Macellum, the Eumachia building and the Comitium on the east; the three municipal
 *     halls on the south; the Forum Baths to the north
 *   → the streets: Via Marina from the forum west down through Porta Marina and down the bluff as a ramp; Via
 *     dell'Abbondanza east from the forum's south-east corner, 7.4 m wide, widening to 14.6 m for the 60 m before
 *     Via Stabiana and 6.7 m past it (the record); Via della Fortuna north of the forum; Via Stabiana north–south
 *     to Porta Stabia; lesser streets between. Every street runs between kerbed pavements
 *   → the Stabian Baths at the Abbondanza–Stabiana crossing; the theatre quarter on the south bluff: the
 *     Triangular Forum with the old Doric Temple, the Large Theatre, the Odeon, the Temple of Isis, the
 *     Quadriporticus behind the stage; the Temple of Venus inside Porta Marina
 *   → the old town: house lots packed in the blocks, each fronting a street; those on the main streets with shops
 *     in their fronts; a fountain at the main crossings
 *   → vines and gardens on the plain below the bluff.
 *
 * Every building is a placeholder from ../assets/pompeii.js until it is designed; each monument's slot carries the
 * record's `state` at 79 CE. Positions follow the town plan's order, not a survey: the streets are drawn
 * orthogonal. Plans in metres; x east, y south.
 */
import { olive } from '../assets/lindos.js';
import { terrainMesh } from '../terrain.js';
import { CELL, C, stream, pick, claimGrid, runs, alleyLattice, packLots, lotSlot, placeSlots, skinLoose } from '../layout-kit.js';
import { POMPEII_RECORD } from '../record/pompeii.js';

const FRAME = { w: 690, d: 640 };
const STATE = Object.fromEntries(POMPEII_RECORD.filter((e) => e.kind === 'type').map((e) => [e.id, e.state]));
// the spur's lip: the west bluff at WEST_X, the south bluff at SOUTH_Y (the wall stands just inside them)
const WEST_X = 96, SOUTH_Y = 584;
// the forum (the record: 143 × 38 m, north–south)
const FORUM = { x: 300, y: 160, w: 38, d: 143 };
const LANE_Z = 0.08, LANE_RUN = 10;

export function planLavaSpur({ seed = 1, culture = 'pompeii', frame = FRAME, assets } = {}, K) {
  const P = K.palette, g = claimGrid(frame), { cols, rows, grid, at, set } = g, Wf = cols * CELL, Df = rows * CELL, H = K.site.spur;
  const boxes = [], grounds = [], slots = [], T = stream(seed, 'trees');
  const cellsOf = (r, fn) => { for (let rr = Math.floor(r.y / CELL); rr < Math.ceil((r.y + r.d) / CELL); rr++) for (let c = Math.floor(r.x / CELL); c < Math.ceil((r.x + r.w) / CELL); c++) fn(c, rr); };
  const fill = (r, v, test = () => true) => cellsOf(r, (c, rr) => { if (test(at(c, rr))) set(c, rr, v); });
  const slot = (s) => { slots.push({ z: 0, ...s }); return s; };
  // a monument: its slot, its ground claimed, its state at 79 from the record
  const monument = (asset, id, rect, facing, o = {}) => { fill(rect, C.PRECINCT); return slot({ asset, rect, facing, ...(id ? { record: id, state: STATE[id] } : {}), ...o }); };

  // ── 1. the land: the spur's top is the town; outside the bluff's lip, the plain ──
  const Bq = stream(seed, 'bluff'), lipW = [], lipS = [], BX = 10;
  for (let i = 0; i * BX <= Df + BX; i++) lipW.push(WEST_X + (Bq() - 0.5) * 3);
  for (let i = 0; i * BX <= Wf + BX; i++) lipS.push(SOUTH_Y + (Bq() - 0.5) * 3);
  const lerp = (arr, u) => { const i = Math.min(arr.length - 2, Math.max(0, Math.floor(u / BX))), t = u / BX - i; return arr[i] + (arr[i + 1] - arr[i]) * t; };
  const onSpur = (x, y) => x >= lerp(lipW, y) && y <= lerp(lipS, x);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) set(c, r, onSpur((c + 0.5) * CELL, (r + 0.5) * CELL) ? C.EMPTY : C.OUTSIDE);
  // the wall just inside the lip, Porta Marina on Via Marina, Porta Stabia on Via Stabiana
  const marina = { y: 263, w: 6 }, stabiana = { x: 640, w: 8 }, wallT = 3, wx = WEST_X + 1, wy = SOUTH_Y - wallT - 1;
  const gateM = { x: wx - 4, y: marina.y + marina.w / 2 - 9, w: 16, d: 18 }, gateS = { x: stabiana.x + stabiana.w / 2 - 10, y: wy - 6, w: 20, d: 14 };
  monument('pp-gate', 'porta-marina', gateM, 'w');
  monument('pp-gate', null, gateS, 's');
  for (const [y0, y1] of [[0, gateM.y], [gateM.y + gateM.d, wy]]) { slot({ asset: 'pp-wall', rect: { x: wx, y: y0, w: wallT, d: y1 - y0 }, facing: 'w' }); fill({ x: wx, y: y0, w: wallT, d: y1 - y0 }, C.WALL); }
  for (const [x0, x1] of [[wx, gateS.x], [gateS.x + gateS.w, Wf]]) { slot({ asset: 'pp-wall', rect: { x: x0, y: wy, w: x1 - x0, d: wallT }, facing: 's' }); fill({ x: x0, y: wy, w: x1 - x0, d: wallT }, C.WALL); }
  for (const r of [{ x: wx - 2, y: 110, w: 8, d: 8 }, { x: wx - 2, y: 430, w: 8, d: 8 }, { x: 300, y: wy - 2, w: 8, d: 8 }]) monument('pp-tower', 'wall-towers', r, r.x < 200 ? 'w' : 's');

  // ── 2. the forum and its buildings ──
  const F = FORUM, fx = F.x + F.w / 2;
  fill(F, C.PRECINCT);
  const cap = monument('pp-temple', 'capitolium', { x: fx - 8.5, y: F.y + 3, w: 17, d: 37 }, 's', { podium: 3 }).rect;
  for (const x of [F.x - 4, F.x + F.w - 4]) monument('pp-arch', 'forum-arches', { x, y: cap.y + cap.d - 4, w: 8, d: 3 }, 's');
  const pd = 6, sq = { x: F.x + pd, y: cap.y + cap.d + 2, w: F.w - 2 * pd, d: F.y + F.d - pd - (cap.y + cap.d + 2) };
  slot({ asset: 'pp-portico', rect: { x: F.x, y: sq.y, w: pd, d: sq.d }, facing: 'e', record: 'forum-portico-tuff', state: STATE['forum-portico-tuff'] });
  slot({ asset: 'pp-portico', rect: { x: F.x + F.w - pd, y: sq.y, w: pd, d: sq.d }, facing: 'w', record: 'forum-portico-travertine', state: STATE['forum-portico-travertine'] });
  slot({ asset: 'pp-portico', rect: { x: F.x, y: F.y + F.d - pd, w: F.w, d: pd }, facing: 'n', record: 'forum-portico-tuff', state: STATE['forum-portico-tuff'] });
  const SQ = stream(seed, 'statues');
  for (let k = 0; k < 5; k++) slot({ asset: 'pp-statue', rect: { x: sq.x + 1 + SQ() * 2, y: sq.y + 12 + k * (sq.d - 24) / 4, w: 2.2, d: 1.6 }, facing: 'e' });
  for (let k = 0; k < 3; k++) slot({ asset: 'pp-statue', rect: { x: sq.x + sq.w - 3.2 - SQ() * 2, y: sq.y + 20 + k * (sq.d - 40) / 2, w: 2.2, d: 1.6 }, facing: 'w' });
  grounds.push({ kind: 'court', x: sq.x, y: sq.y, w: sq.w, d: sq.d, z: 0.06, fill: P.paving, surface: 'flagstone' });
  // west: the Temple of Apollo in its court north of Via Marina, the Basilica south of it
  const apollo = monument('pp-court', null, { x: 232, y: 196, w: 64, d: marina.y - 196 - 1 }, 'e', { open: 'e' }).rect;
  slot({ asset: 'pp-temple', rect: { x: apollo.x + 22, y: apollo.y + 10, w: 13, d: 28 }, facing: 's', record: 'temple-apollo', state: STATE['temple-apollo'], podium: 2.6 });
  monument('pp-hall', 'basilica', { x: 240, y: marina.y + marina.w + 1, w: 56, d: 26 }, 'e', { h: 12 });
  // east: the Macellum at the north-east corner, the Eumachia building, the Comitium beyond Via dell'Abbondanza
  const abb = { y: 296, w: 7.4, wide: 14.6 };
  monument('pp-hall', 'macellum', { x: F.x + F.w + 4, y: F.y, w: 48, d: 40 }, 'w', { h: 6 });
  monument('pp-hall', 'eumachia', { x: F.x + F.w + 4, y: 236, w: 58, d: abb.y - 236 - 1 }, 'w', { h: 9 });
  monument('pp-hall', 'comitium', { x: F.x + F.w + 4, y: abb.y + abb.w + 6, w: 30, d: 30 }, 'w', { h: 7 });
  // south: the three municipal halls; north: the Forum Baths across Via della Fortuna
  for (let k = 0; k < 3; k++) monument('pp-hall', 'municipal-offices', { x: F.x + k * (F.w / 3) + 0.5, y: F.y + F.d + 2, w: F.w / 3 - 1, d: 20 }, 'n', { h: 10 });
  const fortuna = { y: 146, w: 7 };
  monument('pp-hall', 'forum-baths', { x: F.x - 4, y: 86, w: 56, d: fortuna.y - 86 - 1 }, 's', { h: 8, dome: true });

  // ── 3. the streets: named ones first (their widths from the record where it has them), then the lesser ──
  const streets = [], street = (name, r, main = false) => { streets.push({ name, ...r, main }); fill(r, C.LANE, (v) => v === C.EMPTY || v === C.WALL); };
  street('via-marina', { x: WEST_X - 10, y: marina.y, w: F.x - WEST_X + 10, d: marina.w }, true);
  street('via-della-fortuna', { x: WEST_X + 6, y: fortuna.y, w: Wf - WEST_X - 6, d: fortuna.w }, true);
  const abbW0 = F.x + F.w, abbX1 = stabiana.x - 60;
  street('via-dell-abbondanza', { x: abbW0, y: abb.y, w: abbX1 - abbW0, d: abb.w }, true);
  street('via-dell-abbondanza-wide', { x: abbX1, y: abb.y, w: 60, d: abb.wide }, true);
  street('via-dell-abbondanza-east', { x: stabiana.x + stabiana.w, y: abb.y, w: Wf - stabiana.x - stabiana.w, d: 6.7 }, true);
  street('via-stabiana', { x: stabiana.x, y: 0, w: stabiana.w, d: wy }, true);
  street('via-degli-augustali', { x: F.x + F.w, y: F.y + 44, w: stabiana.x - F.x - F.w, d: 5 });
  street('vicolo-north', { x: WEST_X + 6, y: 40, w: Wf - WEST_X - 6, d: 5 });
  street('via-dei-teatri', { x: 330, y: 382, w: stabiana.x - 330, d: 5 });
  for (const [x, y0, y1] of [[200, 0, marina.y], [205, marina.y + marina.w, wy], [400, F.y, abb.y], [470, 0, 382], [530, 0, 382], [345, abb.y + abb.w, wy]]) street(`vicolo-${x}`, { x, y: y0, w: 4.5, d: y1 - y0 });
  street('forum-north', { x: F.x - 4, y: fortuna.y + fortuna.w, w: F.w + 8, d: F.y - fortuna.y - fortuna.w });

  // ── 4. the baths and the theatre quarter ──
  monument('pp-hall', 'stabian-baths', { x: abbX1 - 2, y: 232, w: stabiana.x - abbX1, d: abb.y - 232 - 1 }, 's', { h: 8, dome: true });
  const tri = monument('pp-court', 'triangular-forum', { x: 420, y: 392, w: 92, d: 120 }, 's', { open: 's' }).rect;
  slot({ asset: 'pp-hall', rect: { x: tri.x + 28, y: tri.y + 40, w: 20, d: 32 }, facing: 's', record: 'doric-temple', state: STATE['doric-temple'], h: 5 });   // a relic: roofless
  monument('pp-theatre', 'large-theatre', { x: 520, y: 430, w: 60, d: 46 }, 's');
  monument('pp-hall', 'odeon', { x: 588, y: 438, w: 46, d: 34 }, 's', { h: 9 });
  monument('pp-temple', 'temple-isis', { x: 598, y: 394, w: 13, d: 22 }, 's', { podium: 2.5 });
  monument('pp-court', 'quadriporticus', { x: 520, y: 486, w: 114, d: wy - 486 - 2 }, 'n');
  monument('pp-temple', 'temple-venus', { x: 130, y: marina.y + marina.w + 14, w: 15, d: 29 }, 'n', { podium: 3 });

  // ── 5. the old town: lots in every block left, each fronting a street; shops on the main streets ──
  alleyLattice(g, K.lanes.block, seed, [], { jog: 0.04 });
  const mainAt = new Uint8Array(cols * rows);
  for (const s of streets) if (s.main) cellsOf(s, (c, r) => { if (c >= 0 && r >= 0 && c < cols && r < rows) mainAt[r * cols + c] = 1; });
  const fronts = (lot, f, test) => {
    const n = f === 'n' || f === 's' ? lot.w : lot.d;
    for (let k = 0; k < n; k++) {
      const c = f === 'n' || f === 's' ? lot.c0 + k : f === 'w' ? lot.c0 - 1 : lot.c0 + lot.w, r = f === 'n' ? lot.r0 - 1 : f === 's' ? lot.r0 + lot.d : f === 'e' || f === 'w' ? lot.r0 + k : 0;
      if (test(c, r)) return true;
    }
    return false;
  };
  let houses = 0, shops = 0, gardens = 0;
  for (const lot of packLots(g, K.house.size, seed)) {
    const s = lotSlot(g, lot, K.house.gap, () => 'pp-house');
    const onLane = fronts(lot, s.facing, (c, r) => { const v = at(c, r); return v === C.LANE || v === C.OPEN; });
    if (!onLane || Math.min(s.rect.w, s.rect.d) < 6) { gardens++; boxes.push(...olive(s.rect.x + s.rect.w / 2, s.rect.y + s.rect.d / 2, 0, T, P)); continue; }
    const shop = fronts(lot, s.facing, (c, r) => c >= 0 && r >= 0 && c < cols && r < rows && mainAt[r * cols + c] === 1);
    slot({ ...s, asset: shop ? 'pp-shop-house' : 'pp-house' });
    if (shop) shops++; else houses++;
  }
  // a fountain at each crossing of a main street with another street, on the main street's pavement at the corner
  const fountains = [];
  for (const a of streets.filter((s) => s.main && s.w > s.d)) for (const b of streets.filter((s) => s.d > s.w)) {
    if (b.x + b.w > a.x && b.x < a.x + a.w && a.y + a.d > b.y && a.y < b.y + b.d && b.x - 2.4 > a.x) fountains.push({ x: b.x - 2.4, y: a.y });
  }
  for (const f of fountains) slot({ asset: 'pp-fountain', rect: { x: f.x, y: f.y, w: 1.8, d: 1.8 }, facing: 's' });

  placeSlots(slots, assets || K.assets, K, seed, boxes, grounds, culture);

  // ── 6. the streets on the ground: lava paving between kerbed pavements, where a pavement has something to front ──
  // each pavement stands on the street's own outermost paved cells (a building's claim may have taken the rect's edge)
  const Sw = K.street, isLane = (c, r) => { const v = at(c, r); return v === C.LANE || v === C.OPEN; };
  const built = (c, r) => { const v = at(c, r); return v !== C.LANE && v !== C.OPEN && v !== C.OUTSIDE && v !== -1; };
  let kerbs = 0;
  for (const s of streets) {
    const alongX = s.w >= s.d, n0 = Math.floor((alongX ? s.x : s.y) / CELL), n1 = Math.ceil((alongX ? s.x + s.w : s.y + s.d) / CELL);
    const m0 = Math.floor((alongX ? s.y : s.x) / CELL), m1 = Math.ceil((alongX ? s.y + s.d : s.x + s.w) / CELL) - 1;
    const cell = (k, m) => (alongX ? [k, m] : [m, k]);
    for (const side of [0, 1]) {
      // at each step along: the outermost paved cell across, if a building fronts it
      const edgeAt = (k) => {
        for (let m = side ? m1 : m0; side ? m >= m0 : m <= m1; m += side ? -1 : 1) if (isLane(...cell(k, m))) return built(...cell(k, side ? m + 1 : m - 1)) ? m : null;
        return null;
      };
      let start = -1, edge = null;
      for (let k = n0; k <= n1; k++) {
        const e = k < n1 ? edgeAt(k) : null;
        if (start >= 0 && e !== edge) {
          const across = side ? (edge + 1) * CELL - Sw.walk : edge * CELL, a = start * CELL, len = (k - start) * CELL;
          boxes.push(alongX ? { kind: 'kerb', x: a, y: across, w: len, d: Sw.walk, z0: 0, z1: Sw.kerb, tint: P.walk } : { kind: 'kerb', x: across, y: a, w: Sw.walk, d: len, z0: 0, z1: Sw.kerb, tint: P.walk });
          kerbs++; start = -1;
        }
        if (e !== null && start < 0) { start = k; edge = e; }
      }
    }
  }

  // ── 7. views ──
  const ramp = { x0: 20, x1: wx - 4, y: marina.y, w: marina.w };
  const rampZ = (x) => -H * Math.min(1, Math.max(0, (ramp.x1 - x) / (ramp.x1 - ramp.x0)));
  const views = {
    // at the forum's south end, under the portico's edge, looking north up the square to the Capitolium
    forum: { eye: [fx, F.y + F.d - 10, 1.7], at: [fx, cap.y + 10, 9] },
    // in Via dell'Abbondanza at the wide stretch, looking west toward the forum
    street: { eye: [abbX1 + 40, abb.y + abb.wide / 2, 1.7 + Sw.kerb], at: [F.x + F.w, abb.y + abb.w / 2, 3] },
    // from over the Triangular Forum, down onto the Large Theatre and the Odeon
    theatre: { eye: [tri.x + 30, tri.y + 20, 34], at: [560, 470, 0] },
    // on the ramp below Porta Marina, looking up at the gate
    gate: { eye: [ramp.x0 + 18, ramp.y + ramp.w / 2, rampZ(ramp.x0 + 18) + 1.7], at: [gateM.x + 8, ramp.y + ramp.w / 2, 4] },
  };

  // ── 8. ground: the spur and the plain (../terrain.js), the ramp, the lanes, vines on the plain ──
  const hAt = (x, y) => (onSpur(x, y) ? 0 : -H);
  const T0 = terrainMesh({
    hAt, frame: { w: Wf, d: Df }, eyes: Object.values(views).map((v) => v.eye), cell: 20, eyeRadius: 40,
    surfaceAt: (x, y, z) => (z < -1 ? { fill: P.plain, surface: 'mud' } : { fill: P.ground, surface: 'mud' }),
    riserTint: () => P.cliff,
  });
  grounds.unshift(...T0.grounds);
  boxes.push(...T0.boxes);
  boxes.push({ kind: 'ramp', solid: 'wedge', x: ramp.x0, y: ramp.y, w: ramp.x1 - ramp.x0, d: ramp.w, z0: -H, z1: 0, rise: 'x+', tint: P.lava });
  // the paving, a hand's breadth over the ground, and the slivers between lots as beaten earth: strips that tile edge to
  // edge on one plane, never overlapping. The World's horizon panels widen its "same plane" tolerance to a few
  // centimetres, and it stacks each overlapping strip up off the last by its length (the other cultures' overlapping
  // strips are short or on open ground)
  for (const [code, fill, surface] of [[C.LANE, P.lane, 'flagstone'], [C.OPEN, P.court, 'mud']]) runs(grid, cols, rows, (v) => v === code, (c, r, n) => {
    for (let k = 0; k < n; k += LANE_RUN) grounds.push({ kind: code === C.LANE ? 'lane' : 'court', x: (c + k) * CELL, y: r * CELL, w: Math.min(LANE_RUN, n - k) * CELL, d: CELL, z: LANE_Z, fill, surface });
  });
  const V = stream(seed, 'fields'), TC = 18;
  let trees = 0;
  for (let y = 0; y < Df; y += TC) for (let x = 0; x < Wf; x += TC) {
    if ([[x, y], [x + TC, y], [x, y + TC], [x + TC, y + TC]].some(([a, b]) => onSpur(a, b) || (Math.abs(b - (ramp.y + ramp.w / 2)) < 10 && a < ramp.x1 + 4))) continue;
    if (V() < 0.8) grounds.push({ kind: 'field', x: x + 0.6, y: y + 0.6, w: TC - 1.2, d: TC - 1.2, z: -H + 0.03, fill: pick(P.field, V) });
    if (V() < 0.15 && trees < K.trees.max) { boxes.push(...olive(x + V() * TC, y + V() * TC, -H, T, P)); trees++; }
  }

  skinLoose(boxes, K);
  return {
    boxes, grounds, views, frame: { w: Wf, d: Df }, slots, hAt,
    world: { boxes: pompeiiHorizon({ Wf, Df, H, P, fx, seed }), skirt: { width: 260, cell: 20, fill: P.plain } },
    stats: {
      culture, houses, shops, gardens, trees, fountains: fountains.length, kerbs,
      precinct: F, forum: F, capitolium: cap, square: sq, streets: streets.map(({ name, x, y, w, d, main }) => ({ name, x, y, w, d, main })),
      spur: { h: H, west: WEST_X, south: SOUTH_Y }, gates: { marina: gateM, stabia: gateS }, ramp, terrain: T0.stats,
      states: Object.fromEntries(slots.filter((q) => q.record).map((q) => [q.record, q.state])),
      laneCells: grid.reduce((n, v) => n + (v === C.LANE ? 1 : 0), 0),
    },
    grid: { cols, rows, cell: CELL, data: grid, codes: C },
  };
}

/**
 * The horizon, for the World page only: Vesuvius to the north-north-west, one broad mountain with a flat summit
 * (Strabo; the Centenary fresco — record: vesuvius-before), and the Monti Lattari to the south-east. Brought in and
 * scaled so they stand at about their real angle (Vesuvius ~8 km off, rising ~1.1 km over the plain: about 8°).
 */
function pompeiiHorizon({ Wf, Df, H, P, fx, seed }) {
  const out = [], U = stream(seed, 'horizon');
  const quad = (pts, outv, tint) => {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), zs = pts.map((p) => p[2]);
    out.push({ kind: 'horizon', solid: 'panel', pts, out: outv, x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), d: Math.max(...ys) - Math.min(...ys), z0: Math.min(...zs), z1: Math.max(...zs), tint });
  };
  const profile = (y, x0, x1, crest, base, tint, outv, n = 40) => {
    for (let i = 0; i < n; i++) { const a = x0 + ((x1 - x0) * i) / n, b = x0 + ((x1 - x0) * (i + 1)) / n; quad([[a, y, base], [b, y, base], [b, y, base + crest(b)], [a, y, base + crest(a)]], outv, tint); }
  };
  // Vesuvius at 5 km brought in: ~700 m at that distance; a broad cone, its top flattened over the middle fifth
  const vy = -5000, vc = fx - 1200, half = 4200, top = 700;
  profile(vy, vc - half, vc + half, (x) => { const t = Math.abs(x - vc) / half; return t < 0.2 ? top : top * Math.max(0, (1 - t) / 0.8) ** 1.25; }, -H - 40, P.hazeFar, [0, 1, 0]);
  // the Monti Lattari, south-east: a long ridge
  const ph = [U() * 6, U() * 6];
  profile(Df + 5000, Wf / 2 - 3000, Wf + 7000, (x) => 380 + 140 * Math.sin(x / 1300 + ph[0]) + 60 * Math.sin(x / 470 + ph[1]), -H - 40, P.hazeFar, [0, -1, 0]);
  return out;
}
