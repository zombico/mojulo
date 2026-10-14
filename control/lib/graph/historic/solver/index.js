/**
 * historic/solver — a historic town SOLVED from its form (../form/), its monument (../monuments/) and what its people
 * had (../ledger/), instead of laid by hand. One solver for every culture; what differs between them is data.
 *
 * The layers, in order, each on its own seeded stream so a change to one never rerolls the ones before it:
 *   frame      the ground the scene plans on: the town ('city'), the region round it ('region'), a slice of life cut
 *              from the region ('slice', round a `focus`)
 *   site       the water and the lie of the land (./site.js), anchored on the town
 *   armature   the monument seated at its place, its precinct, its approach (an avenue from the water, a climb from the
 *              town, a forum square)
 *   enclosure  a ring wall with towers and gates, or walled wards
 *   streets    the pattern (meander, lattice, grid, contour) and the alleys that keep every block shallow
 *   placement  what stands by meaning or need (../form/schema.js WHERE)
 *   lots       the free ground packed with house lots, each fronting a lane; the houses by size
 *   land       the fields and trees outside the town; in a region, the activities (the farm, the crafts)
 *   ground     the terrain under it all (../terrain.js), the water, the lanes, the precinct's floor
 *   views      eye-level views read off the armature; a slice is cut and moved to its own origin
 *
 * It returns the PLAN every historic emitter reads ({ boxes, grounds, slots, views, frame, stats, grid, hAt,
 * repeats? }), and with it what the field guide reads: the form, the monument, the ledger's findings and the laws.
 * Plans in metres, x east, y south. Pure and deterministic.
 */
import { HISTORIC_CULTURES, landOf } from '../cultures/index.js';
import { FORMS } from '../form/towns.js';
import { readForm } from '../form/schema.js';
import { MONUMENTS } from '../monuments/index.js';
import { FARM_CULTURES, WORKS_CULTURES } from '../land-kits.js';
import { CELL, C, laneZ, stream, pick, claimGrid, runs, alleyLattice, packLots, lotSlot, skinLoose } from '../layout-kit.js';
import { placeAsset, orientBox, localSize } from '../assets/kit.js';
import { orientSolid } from '../assets/solids.js';
import { terrainMesh } from '../terrain.js';
import { palm } from '../patterns.js';
import { olive } from '../assets/lindos.js';
import { tree as qinTree } from '../assets/qin.js';
import { scaleHex } from '../../polygonizer/vexar.js';
import { sideAxes, waterOf, heightOf, turnFacing, opposite, toward } from './site.js';
import { placeOf, availableAt, buildableAt, ledgerFindings, cardSurfaces } from '../ledger/index.js';

/** The scales a historic scene is solved at: the town, the town in its region, a slice of life cut from the region. */
export const SCENES = Object.freeze(['city', 'region', 'slice']);
/** A slice of life: this much ground, metres, round its focus. */
export const SLICE = Object.freeze([170, 125]);
/** What a slice may be cut round, besides a form's activities. */
export const SLICE_FOCI = Object.freeze(['street', 'monument', 'water', 'gate', 'market']);

const r2 = (v) => Math.round(v * 100) / 100;
const SURF = { mud: 'mud', rubble: 'rubble', brick: 'brick', flagstone: 'flagstone', 'dry-earth': 'dry-earth' };
const centre = (r) => [r.x + r.w / 2, r.y + r.d / 2];
const grow = (r, m) => ({ x: r.x - m, y: r.y - m, w: r.w + 2 * m, d: r.d + 2 * m });
const meets = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.d && a.y + a.d > b.y;
const rectFor = (cx, cy, w, d, facing) => (facing === 'e' || facing === 'w' ? { x: cx - d / 2, y: cy - w / 2, w: d, d: w } : { x: cx - w / 2, y: cy - d / 2, w, d });
/** The side of `from` that `to` lies on (the dominant axis). */
const sideToward = ([fx, fy], [tx, ty]) => (Math.abs(tx - fx) > Math.abs(ty - fy) ? (tx > fx ? 'e' : 'w') : (ty > fy ? 's' : 'n'));

/** A culture's form and kit, checked: `form` (a document or `{ from, … }`) overrides the culture's own. */
export function formOf(culture, form) {
  if (!HISTORIC_CULTURES[culture]) throw new Error(`historic: unknown culture '${culture}' — one of ${Object.keys(HISTORIC_CULTURES).map((c) => `'${c}'`).join(', ')}`);
  // a culture with no form of its own is laid out by the form its card names (`form: '<culture>'`: a scaffold's `--like`)
  const own = FORMS[culture] ? culture : HISTORIC_CULTURES[culture].form;
  if (!FORMS[own]) throw new Error(`historic: ${culture} has no form, and its card names none ('form: <culture>')`);
  return form ? readForm(form.from ? form : { from: own, ...form }, FORMS) : FORMS[own];
}

/** The activities a form's culture can lay: those whose kit (../land-kits.js) has every piece. */
export function activitiesOf(culture, F, inReach = null) {
  const land = landOf(culture);
  return (F.activities || []).filter((a) => {
    const kit = (a.kit === 'farm' ? FARM_CULTURES : WORKS_CULTURES)[land];
    return !!kit && a.pieces.every((p) => kit.assets[p]) && (!inReach || (a.cites || []).every((k) => inReach.has(k)));
  });
}

/** What a slice of life may be cut round, read off the form (no solve): its street, its monument, its water, a gate,
 *  the market ward, and the activities in reach at the town's year. */
export function sliceFoci(culture, form = null) {
  const F = formOf(culture, form), inReach = new Set(availableAt(placeOf(culture)).map((r) => r.key));
  return ['street', 'monument', ...(F.water?.kind && F.water.kind !== 'none' ? ['water'] : []), ...(F.enclosure.kind === 'ring' && (F.enclosure.gates ?? 4) > 0 ? ['gate'] : []),
    ...(F.enclosure.kind === 'wards' && F.enclosure.market ? ['market'] : []), ...activitiesOf(culture, F, inReach).map((a) => a.id)];
}

/** Solve a historic scene: `{ culture, seed, scene, focus, form }` → the plan. */
export function solveHistoric({ culture = 'sumer', seed = 1, scene = 'city', focus = null, form = null } = {}) {
  if (!SCENES.includes(scene)) throw new Error(`historic: scene is one of ${SCENES.map((v) => `'${v}'`).join(', ')}`);
  const view = scene;
  const K = HISTORIC_CULTURES[culture], F = formOf(culture, form), P = K.palette;
  const kit = Object.assign({}, ...(F.borrow || []).map((b) => HISTORIC_CULTURES[b]?.assets || {}), K.assets || {});
  const borrowed = Object.fromEntries((F.borrow || []).flatMap((b) => Object.keys(HISTORIC_CULTURES[b]?.assets || {}).filter((a) => !(K.assets || {})[a]).map((a) => [a, b])));

  // ── frame ──
  const [tw, td] = F.frame.town, [fw, fd] = view === 'city' ? [tw, td] : F.frame.region;
  const frame = { w: fw, d: fd }, town = { x: (fw - tw) / 2, y: (fd - td) / 2, w: tw, d: td };
  const g = claimGrid(frame), { cols, rows, at, set, grid } = g;
  const mid = (c, r) => [(c + 0.5) * CELL, (r + 0.5) * CELL];
  const cellOf = (x, y) => [Math.floor(x / CELL), Math.floor(y / CELL)];
  const claimRect = (r, v, ok = () => true) => { for (let rr = Math.floor(r.y / CELL); rr < Math.ceil((r.y + r.d) / CELL); rr++) for (let c = Math.floor(r.x / CELL); c < Math.ceil((r.x + r.w) / CELL); c++) if (ok(at(c, rr))) set(c, rr, v); };
  const rectCells = (r) => { const out = []; for (let rr = Math.floor(r.y / CELL); rr < Math.ceil((r.y + r.d) / CELL); rr++) for (let c = Math.floor(r.x / CELL); c < Math.ceil((r.x + r.w) / CELL); c++) out.push(at(c, rr)); return out; };
  const slots = [], boxes = [], grounds = [], builds = [], notes = [];

  // ── site: the water, the monument's place, the land ──
  const water = waterOf(F.water, town, stream(seed, 'water'));
  const A = F.armature, M = MONUMENTS[A.monument];
  if (!M) throw new Error(`historic: the form names a monument '${A.monument}' the library does not have`);
  const [ax, ay] = [town.x + (A.at?.[0] ?? 0.5) * tw, town.y + (A.at?.[1] ?? 0.5) * td];
  const townCentre = [town.x + tw / 2, town.y + td / 2];
  let mFacing;
  if (A.kind === 'heart') mFacing = water.kind === 'canal' ? (water.centre(ax) > ay ? 's' : 'n') : water.side ?? 's';
  else if (A.kind === 'axis') mFacing = water.kind === 'canal' ? (water.centre(ax) > ay ? 's' : 'n') : water.side ?? opposite(F.site.high ?? 'n');
  else if (A.kind === 'summit') mFacing = sideToward([ax, ay], townCentre);
  else mFacing = (A.square?.[1] ?? 1) >= (A.square?.[0] ?? 1) ? 's' : 'e';
  const [MW, MD] = M.size;
  let square = null, mRect;
  if (A.kind === 'forum') {
    const [sw, sd] = A.square;
    square = { x: ax - sw / 2, y: ay - sd / 2, w: sw, d: sd };
    // the monument at the square's head, its back to the head's edge, facing down the square
    mRect = mFacing === 's' ? { x: ax - MW / 2, y: square.y + 3, w: MW, d: MD } : { x: square.x + 3, y: ay - MW / 2, w: MD, d: MW };
  } else mRect = rectFor(ax, ay, MW, MD, mFacing);
  const front = toward(mFacing), apron = M.apron ?? 0;
  const PR = A.precinct || {}, margin = PR.margin ?? 0;
  // the precinct: the monument with its margin, the apron before it, `back` more behind
  let precinct = square ? { ...square } : grow(mRect, margin);
  if (!square) {
    const ext = (side, m) => { if (side === 'n') { precinct.y -= m; precinct.d += m; } else if (side === 's') precinct.d += m; else if (side === 'w') { precinct.x -= m; precinct.w += m; } else precinct.w += m; };
    ext(mFacing, apron); ext(opposite(mFacing), PR.back ?? 0);
  }
  const site = heightOf(F.site, water, town, { rockRect: A.kind === 'summit' && F.site.rock ? precinct : null, rng: stream(seed, 'site') });
  const { hAt } = site;
  // a canal is dug in the low ground: it never climbs a bluff or a plateau
  if (water.kind === 'canal' && (F.site.relief ?? 0) > 0) { const dug = water.isWater; water.isWater = (x, y) => dug(x, y) && site.base(x, y) < 0.5; }
  const zOf = (x, y) => Math.max(hAt(x, y), water.kind === 'none' ? -Infinity : -Infinity);
  const [mcx, mcy] = centre(mRect), terrace = PR.terrace ?? 0, mZ = hAt(mcx, mcy) + terrace;

  // ── claims: the water, the town's reach, ground too steep to build ──
  const ext = F.enclosure.extent ?? [0.9, 0.9], L = stream(seed, 'layout');
  const wob = F.enclosure.kind === 'ring' ? [0, 1, 2].map(() => ({ a: 0.03 + L() * 0.04, f: 2 + Math.floor(L() * 3), p: L() * 6.283 })) : [];
  const band = F.hinterland?.band ?? 0;
  const relief = F.site.relief ?? 0;
  const inTown = (x, y) => {
    const dx = (x - townCentre[0]) / (tw / 2 * ext[0]), dy = (y - townCentre[1]) / (td / 2 * ext[1]), th = Math.atan2(dy, dx);
    if (Math.hypot(dx, dy) >= 1 + wob.reduce((s, q) => s + q.a * Math.sin(q.f * th + q.p), 0)) return false;
    if (water.kind === 'river' && water.axes.across(x, y) < water.edge(water.axes.along(x, y)) + (F.water.bank ?? 6) + band) return false;
    if (water.kind === 'sea' && water.axes.across(x, y) < water.edge(water.axes.along(x, y)) + 8) return false;
    const b = site.base(x, y);
    if (F.site.town === 'high' && relief > 0 && b < relief * 0.9) return false;
    if (F.site.town === 'low' && relief > 0 && b > relief * 0.1) return false;
    return true;
  };
  const steep = (x, y) => { const z = [hAt(x - 1.4, y - 1.4), hAt(x + 1.4, y - 1.4), hAt(x - 1.4, y + 1.4), hAt(x + 1.4, y + 1.4)]; return Math.max(...z) - Math.min(...z) > 0.6; };
  const steepCells = new Uint8Array(cols * rows);   // open because no one can build there, not because it is a street
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const [x, y] = mid(c, r);
    if (water.isWater(x, y)) set(c, r, C.WATER);
    else if (!inTown(x, y)) set(c, r, C.OUTSIDE);
    else if (steep(x, y)) { set(c, r, C.OPEN); steepCells[r * cols + c] = 1; }
  }

  // ── armature: the precinct, the monument, the approach ──
  claimRect(precinct, C.PRECINCT, (v) => v !== C.WATER || A.kind === 'summit');
  const laid = M.lay({ palette: P, culture: K });
  for (const s of laid.slots || []) slots.push({ ...s, rect: orientBox(s.rect, mRect, mFacing), facing: turnFacing(s.facing, mFacing), z: mZ + (s.z ?? 0), monument: A.monument });
  for (const b of laid.builds || []) builds.push({ ...b, rect: orientBox(b.rect, mRect, mFacing), facing: turnFacing(b.facing, mFacing), z: mZ, monument: A.monument });
  const monuments = [{ id: A.monument, rect: mRect, facing: mFacing, z: r2(mZ), main: true }];
  // the precinct's front edge, its gate there (or on the way's side), its walls
  const frontEdge = (r, side) => ({ n: [r.x + r.w / 2, r.y], s: [r.x + r.w / 2, r.y + r.d], w: [r.x, r.y + r.d / 2], e: [r.x + r.w, r.y + r.d / 2] })[side];
  const AP = A.approach || {};
  const waySide = AP.way && A.kind === 'axis' ? sideToward([mcx, mcy], townCentre) === mFacing || sideToward([mcx, mcy], townCentre) === opposite(mFacing) ? turnFacing('e', mFacing) : sideToward([mcx, mcy], townCentre) : null;
  const gateSide = waySide ?? mFacing, gate = frontEdge(precinct, gateSide);
  if (!square && (PR.wall || PR.thickness)) wallPrecinct();
  if (terrace > 0 && !square) boxes.push({ kind: 'terrace', ...precinct, z0: hAt(mcx, mcy), z1: hAt(mcx, mcy) + terrace, tint: P.platform ?? P.wall ?? P.ground });

  function wallPrecinct() {
    const t = PR.thickness ?? 2, h = PR.height, gw = Math.max(AP.width ?? 0, 10) + 2 * (AP.flankDepth ?? 0);
    const sides = ['n', 'e', 's', 'w'];
    for (const side of sides) {
      const along = side === 'n' || side === 's', len = along ? precinct.w : precinct.d;
      const x0 = side === 'e' ? precinct.x + precinct.w - t : precinct.x, y0 = side === 's' ? precinct.y + precinct.d - t : precinct.y;
      const open = side === mFacing && (A.kind === 'axis' || A.kind === 'summit' || !PR.gate) ? gw : side === gateSide && PR.gate ? 0 : side === gateSide ? 8 : 0;
      const gateHere = side === gateSide && PR.gate;
      const gap = gateHere ? (localSize(MONUMENTS[A.monument] ? { w: 14, d: 9 } : { w: 14, d: 9 }, 'n').W) : open;
      const pieces = gap ? [[0, len / 2 - gap / 2], [len / 2 + gap / 2, len]] : [[0, len]];
      for (const [a, b] of pieces) {
        if (b - a < 1) continue;
        const rect = along ? { x: precinct.x + a, y: y0, w: b - a, d: t } : { x: x0, y: precinct.y + a, w: t, d: b - a };
        const z = hAt(...centre(rect));
        if (PR.wall) slots.push({ asset: PR.wall, rect, facing: side, z, ...(h ? { h } : {}) });
        else boxes.push({ kind: 'precinct-wall', ...rect, z0: z, z1: z + (h ?? 4), tint: P.wall ?? P.ground });
      }
      if (gateHere) {
        const gr = along ? { x: precinct.x + len / 2 - gap / 2, y: y0 - (9 - t) / 2, w: gap, d: 9 } : { x: x0 - (9 - t) / 2, y: precinct.y + len / 2 - gap / 2, w: 9, d: gap };
        slots.push({ asset: PR.gate, rect: gr, facing: side, z: hAt(...centre(gr)), ...(h ? { h } : {}) });
      }
    }
  }

  // a straight strip of lane from a point toward a side, `width` across, until `stop` holds or `len` runs out;
  // returns its cells' rect and claims them (main surface)
  const surf = new Uint8Array(cols * rows);   // 1 = a main street, 0 = an alley
  const laneCells = [];
  const lane = (c, r, main = 0, over = [C.EMPTY, C.OPEN]) => { const v = at(c, r); if (over.includes(v)) { set(c, r, C.LANE); laneCells.push([c, r]); if (main) surf[r * cols + c] = 1; return true; } return v === C.LANE; };
  const strip = ([x0, y0], side, width, { len = Infinity, stop = () => false, over } = {}) => {
    const [dx, dy] = toward(side), half = width / 2, rect = { x: x0, y: y0, w: 0, d: 0 };
    let s = 0;
    for (; s < len; s += CELL / 2) {
      const x = x0 + dx * s, y = y0 + dy * s;
      if (x < 0 || y < 0 || x > frame.w || y > frame.d || stop(x, y)) break;
      for (let k = -half + CELL / 2; k <= half - CELL / 2 + 1e-9; k += CELL) { const [c, r] = cellOf(x + (dy ? k : 0), y + (dx ? k : 0)); lane(c, r, 1, over); }
    }
    const x1 = x0 + dx * s, y1 = y0 + dy * s;
    return dx ? { x: Math.min(x0, x1), y: y0 - half, w: Math.abs(x1 - x0), d: width } : { x: x0 - half, y: Math.min(y0, y1), w: width, d: Math.abs(y1 - y0) };
  };
  const approach = { avenue: null, way: null, quay: null };
  if (A.kind === 'axis' && AP.width) {
    // the avenue from the precinct's front out to the water (or the town's edge), lined; the quay or the bridge at its end
    const start = frontEdge(precinct, mFacing);
    const av = strip(start, mFacing, AP.width, { stop: (x, y) => water.isWater(x, y), over: [C.EMPTY, C.OPEN, C.OUTSIDE, C.PRECINCT] });
    approach.avenue = av;
    const [dx, dy] = front, len = dx ? av.w : av.d, end = [start[0] + dx * len, start[1] + dy * len];
    if (AP.flank && len > 16) for (const o of [-1, 1]) {
      const fd = AP.flankDepth ?? 6, q = AP.quay ? (AP.quaySize?.[1] ?? 16) : 0, run = len - 4 - q;
      if (run < 10) continue;
      const along = dx ? { x: Math.min(start[0], start[0] + dx * (2 + run)), y: start[1] + o * (AP.width / 2) + (o < 0 ? -fd : 0), w: run, d: fd } : { x: start[0] + o * (AP.width / 2) + (o < 0 ? -fd : 0), y: Math.min(start[1], start[1] + dy * (2 + run)), w: fd, d: run };
      slots.push({ asset: AP.flank, rect: along, facing: dx ? (o < 0 ? 's' : 'n') : (o < 0 ? 'e' : 'w'), z: hAt(...centre(along)) });
      claimRect(along, C.OPEN, (v) => v !== C.WATER && v !== C.PRECINCT);
    }
    if (AP.quay && water.kind !== 'none') {
      const [qw, qd] = AP.quaySize ?? [26, 16], qr = rectFor(end[0] - dx * (qd / 2 - 4), end[1] - dy * (qd / 2 - 4), qw, qd, mFacing);
      slots.push({ asset: AP.quay, rect: qr, facing: mFacing, z: 0, waterZ: water.z });
      approach.quay = qr;
    }
    if (F.water.bridge && water.kind === 'river') {
      // the bridge carries the axis over the river, from bank to bank
      let s = 0; while (s < 600 && water.isWater(end[0] + dx * (s + 2), end[1] + dy * (s + 2))) s += 2;
      const span = s + 16, br = rectFor(end[0] + dx * (s / 2), end[1] + dy * (s / 2), Math.max(AP.width * 0.6, 10), span, mFacing);
      slots.push({ asset: F.water.bridge, rect: br, facing: mFacing, z: 0, waterZ: water.z });
      approach.bridge = br;
    }
  }
  if (AP.way) {
    // the processional way (an axis), the climb (a summit): a straight street from the precinct's gate into the town
    // a climb runs down from the precinct until it is 40 m into the town, where its streets meet it; a processional
    // way runs on to the town's edge
    let inside = 0;
    const climbStop = (x, y) => { if (water.isWater(x, y)) return true; if (inTown(x, y)) inside += CELL / 2; return inside > 40; };
    const w = strip(gate, gateSide, AP.way, { stop: A.kind === 'summit' ? climbStop : (x, y) => water.isWater(x, y) || !inTown(x, y), over: [C.EMPTY, C.OPEN, C.OUTSIDE] });
    approach.way = { ...w, side: gateSide };
    if (AP.flank && A.kind === 'axis') {
      // the way lined with the same pieces, in runs between the cross streets laid later
      const [dx] = toward(gateSide), fd = AP.flankDepth ?? 6, run = (dx ? w.w : w.d) - 6;
      for (let s0 = 6; s0 + 20 < run; s0 += 70) for (const o of [-1, 1]) {
        const n = Math.min(54, run - s0);
        const r = dx ? { x: (dx > 0 ? w.x + s0 : w.x + w.w - s0 - n), y: o < 0 ? w.y - fd : w.y + w.d, w: n, d: fd } : { x: o < 0 ? w.x - fd : w.x + w.w, y: (toward(gateSide)[1] > 0 ? w.y + s0 : w.y + w.d - s0 - n), w: fd, d: n };
        if (rectCells(r).some((v) => v !== C.EMPTY && v !== C.OPEN && v !== C.OUTSIDE)) continue;
        slots.push({ asset: AP.flank, rect: r, facing: dx ? (o < 0 ? 's' : 'n') : (o < 0 ? 'e' : 'w'), z: hAt(...centre(r)) });
        claimRect(r, C.OPEN);
      }
    }
  }

  // ── enclosure ──
  const E = F.enclosure, WL = F.walls || {}, gates = [];
  if (E.kind === 'ring') ringWall();
  function ringWall() {
    const wt = Math.max(1, Math.round((E.thickness ?? 4) / CELL)), wallCells = [];
    const inside = (c, r) => { const v = at(c, r); return v !== C.OUTSIDE && v !== -1 && v !== C.WATER; };
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (!inside(c, r) || at(c, r) === C.PRECINCT) continue;
      let edge = false;
      for (let dr = -wt; dr <= wt && !edge; dr++) for (let dc = -wt; dc <= wt && !edge; dc++) if (Math.abs(dr) + Math.abs(dc) <= wt && (at(c + dc, r + dr) === C.OUTSIDE || at(c + dc, r + dr) === -1)) edge = true;
      if (edge) wallCells.push([c, r]);
    }
    for (const [c, r] of wallCells) set(c, r, C.WALL);
    const st = Math.max(1, Math.round((E.strip ?? 0) / CELL));
    for (const [c, r] of wallCells) for (let dr = -st - 1; dr <= st + 1; dr++) for (let dc = -st - 1; dc <= st + 1; dc++) if (at(c + dc, r + dr) === C.EMPTY) set(c + dc, r + dr, C.OPEN);
    // the gates: where rays from the town's middle toward each quarter meet the wall
    const [cx, cy] = townCentre.map((v) => v / CELL), n = E.gates ?? 4, G = stream(seed, 'gates');
    for (let k = 0; k < n; k++) {
      const th = (k / n) * 6.283 + 0.15 + (G() - 0.5) * 0.4;
      let c = cx, r = cy, last = null;
      for (let s = 0; s < cols + rows; s++) { c += Math.cos(th); r += Math.sin(th); const v = at(Math.round(c), Math.round(r)); if (v === C.WALL) last = [Math.round(c), Math.round(r)]; if (v === C.OUTSIDE || v === -1) break; }
      if (last) gates.push(last);
    }
    const gateSet = new Set();
    for (const [gc, gr] of gates) for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) { gateSet.add(`${gc + dc},${gr + dr}`); if (at(gc + dc, gr + dr) === C.WALL) set(gc + dc, gr + dr, C.OPEN); }
    const faceOut = (x, y) => sideToward(townCentre, [x, y]);
    if (WL.run) runs(grid, cols, rows, (v) => v === C.WALL, (c, r, k) => {
      const rect = { x: c * CELL, y: r * CELL, w: k * CELL, d: CELL }, facing = faceOut(rect.x + rect.w / 2, rect.y + CELL / 2), [dc, dr] = toward(facing);
      let exposed = false; for (let i = 0; i < k && !exposed; i++) { const v = at(c + i + dc, r + dr); exposed = v === C.OUTSIDE || v === -1; }
      slots.push({ asset: WL.run, rect, facing, exposed, z: hAt(...centre(rect)) });
    });
    if (WL.tower) {
      const T = stream(seed, 'towers'), every = E.towerEvery ?? 30, sz = Math.max(6, (E.thickness ?? 4) * 1.4);
      const ring = wallCells.filter(([c, r]) => at(c, r) === C.WALL).sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
      let lastT = null;
      for (const [c, r] of ring) {
        const p = [c * CELL, r * CELL];
        if (lastT && Math.hypot(p[0] - lastT[0], p[1] - lastT[1]) < every) continue;
        const s = sz * (0.9 + T() * 0.2), rect = { x: p[0] - s / 2 + CELL / 2, y: p[1] - s / 2 + CELL / 2, w: s, d: s };
        slots.push({ asset: WL.tower, rect, facing: faceOut(p[0], p[1]), z: hAt(...centre(rect)) }); lastT = p;
      }
    }
    if (WL.gate) for (const [gc, gr] of gates) {
      const along = at(gc + 3, gr) === C.WALL || at(gc - 3, gr) === C.WALL, x = gc * CELL + CELL / 2, y = gr * CELL + CELL / 2, Lg = 27, Dg = 12;
      const rect = along ? { x: x - Lg / 2, y: y - Dg / 2, w: Lg, d: Dg } : { x: x - Dg / 2, y: y - Lg / 2, w: Dg, d: Lg };
      const out = faceOut(x, y);
      slots.push({ asset: WL.gate, rect, facing: along ? (out === 'n' || out === 's' ? out : (y > townCentre[1] ? 's' : 'n')) : (out === 'e' || out === 'w' ? out : (x > townCentre[0] ? 'e' : 'w')), z: hAt(x, y) });
    }
  }

  // the wards: walled blocks with streets between them, a gate each, one the market (before the streets: they are the plan)
  if (E.kind === 'wards') wards();
  // ── placement, first: what claims its ground before the streets (the precinct's buildings, the square's edge) ──
  const placed = [];
  const free = (r, ok) => { const cs = rectCells(r); return cs.length > 0 && cs.every(ok); };
  const put = (it, rect, facing, extra = {}) => {
    if (it.monument) {
      const m = MONUMENTS[it.monument], f = facing, mr = rectFor(...centre(rect), m.size[0], m.size[1], f), z = hAt(...centre(mr));
      const lay2 = m.lay({ palette: P, culture: K });
      for (const s of lay2.slots || []) slots.push({ ...s, rect: orientBox(s.rect, mr, f), facing: turnFacing(s.facing, f), z: z + (s.z ?? 0), monument: it.monument });
      for (const b of lay2.builds || []) builds.push({ ...b, rect: orientBox(b.rect, mr, f), facing: turnFacing(b.facing, f), z, monument: it.monument });
      monuments.push({ id: it.monument, rect: mr, facing: f, z: r2(z) });
      claimRect(mr, C.HOUSE, (v) => v !== C.WATER);
      placed.push({ ...it, rect: mr });
      return;
    }
    slots.push({ asset: it.asset, rect, facing, z: extra.z ?? hAt(...centre(rect)), ...extra });
    placed.push({ ...it, rect });
  };
  const sizeOf = (it) => (it.monument ? MONUMENTS[it.monument].size : it.size ?? envelopeMid(kit[it.asset]));
  const items = (F.placement || []).filter((it) => it.monument ? MONUMENTS[it.monument] : kit[it.asset]);
  for (const it of F.placement || []) if (!(it.monument ? MONUMENTS[it.monument] : kit[it.asset])) notes.push(`placement '${it.asset ?? it.monument}' has no asset in the kit: left out`);
  // the precinct round the monument, before it, at its gate; round the square
  let frontOffset = 0;
  const inPrecinct = (v) => v === C.PRECINCT;
  for (const it of items) {
    const [w, d] = sizeOf(it), n = it.max ?? 1;
    if (it.where === 'precinct') {
      // beside the monument, behind it, at its sides: the first free spot, facing the monument
      const cands = [];
      for (let y = precinct.y + 3; y + d < precinct.y + precinct.d - 3; y += CELL) for (let x = precinct.x + 3; x + w < precinct.x + precinct.w - 3; x += CELL) cands.push({ x, y, w, d });
      cands.sort((a, b) => Math.hypot(...centre(a).map((v, i) => v - [mcx, mcy][i])) - Math.hypot(...centre(b).map((v, i) => v - [mcx, mcy][i])));
      for (let k = 0; k < n; k++) {
        const r = cands.find((q) => !meets(grow(q, 2), mRect) && !meets(q, apronRect()) && free(q, inPrecinct));
        if (!r) { notes.push(`no room in the precinct for '${it.asset ?? it.monument}'`); break; }
        put(it, r, it.monument ? sideToward(centre(r), [mcx, mcy]) : sideToward(centre(r), [mcx, mcy]), { z: hAt(...centre(r)) + terrace });
        claimRect(grow(r, 1), C.HOUSE, inPrecinct);
      }
    } else if (it.where === 'monument-front') {
      const gap = 1.5, off = (mFacing === 'n' || mFacing === 's' ? 0 : 0) + frontOffset + gap + d / 2, [fx, fy] = frontEdge(mRect, mFacing);
      const r = rectFor(fx + front[0] * off, fy + front[1] * off, w, d, mFacing);
      frontOffset += d + gap;
      put(it, r, mFacing, { z: hAt(...centre(r)) + terrace });
    } else if (it.where === 'precinct-gate') {
      const [gx2, gy2] = gate, along = gateSide === 'n' || gateSide === 's', back = toward(opposite(gateSide));
      for (const o of [-1, 1]) {
        const cx = gx2 + (along ? o * (9 + w / 2) : 0) + back[0] * (d / 2 + 2), cy = gy2 + (along ? 0 : o * (9 + w / 2)) + back[1] * (d / 2 + 2);
        put(it, rectFor(cx, cy, w, d, gateSide), gateSide, { z: hAt(cx, cy) + terrace });
      }
    } else if (it.where === 'square-edge' && square) {
      const every = it.every ?? 0;
      const long = square.d >= square.w, sideLen = long ? square.d : square.w;
      if (w >= sideLen * 0.6) {
        // a portico along each long side, just inside the square
        for (const o of [-1, 1].slice(0, n)) {
          const r = long ? { x: o < 0 ? square.x : square.x + square.w - d, y: square.y + (square.d - Math.min(w, square.d)) / 2, w: d, d: Math.min(w, square.d) } : { x: square.x + (square.w - Math.min(w, square.w)) / 2, y: o < 0 ? square.y : square.y + square.d - d, w: Math.min(w, square.w), d };
          put(it, r, long ? (o < 0 ? 'e' : 'w') : (o < 0 ? 's' : 'n'));
        }
        continue;
      }
      if (w <= 4) {
        // statues and bases in a row along a long side, inside the square
        const step = Math.max(every || 8, w + 2);
        for (let k = 0; k < n; k++) {
          const s = (k + 1) * step; if (s > sideLen - 8) break;
          const r = long ? { x: square.x + 7, y: square.y + square.d - s, w: d, d: w } : { x: square.x + s, y: square.y + square.d - 7 - d, w, d };
          put(it, r, long ? 'e' : 'n', {});
        }
        continue;
      }
      // a building outside a long side, facing the square: down each side in turn
      let k = 0;
      for (const o of [1, -1]) for (let s = 10; s + (long ? w : w) < sideLen && k < n; s += 6) {
        const r = long ? { x: o < 0 ? square.x - d - 2 : square.x + square.w + 2, y: square.y + s, w: d, d: w } : { x: square.x + s, y: o < 0 ? square.y - d - 2 : square.y + square.d + 2, w, d };
        if (!free(r, (v) => v === C.EMPTY || v === C.OPEN)) continue;
        put(it, r, long ? (o < 0 ? 'e' : 'w') : (o < 0 ? 's' : 'n')); claimRect(r, C.HOUSE); k++; s += long ? w : w;
      }
    }
  }
  function apronRect() { const [fx, fy] = frontEdge(mRect, mFacing); return rectFor(fx + front[0] * apron / 2, fy + front[1] * apron / 2, (mFacing === 'n' || mFacing === 's' ? mRect.w : mRect.d), apron, mFacing); }

  // ── streets ──
  const S = F.streets, mainW = Math.max(1, Math.round(S.main / CELL)), [bx, by] = S.block ?? [24, 24];
  const line = (horiz, pos, from, to, widthCells, main) => {
    for (let t = from; t <= to; t++) for (let k = 0; k < widthCells; k++) { const c = horiz ? t : pos + k, r = horiz ? pos + k : t; lane(c, r, main); }
  };
  const precinctGateCell = cellOf(gate[0] + toward(gateSide)[0] * (CELL * 1.5), gate[1] + toward(gateSide)[1] * (CELL * 1.5));
  const mainPaths = [];
  if (S.pattern === 'meander') {
    // from each gate (or, unwalled, the town's edge) a biased walk to the precinct's gate
    const starts = gates.length ? gates : [0, 1, 2, 3].map((k) => { const th = k * 1.571 + 0.4; return cellOf(townCentre[0] + Math.cos(th) * tw * 0.42 * ext[0], townCentre[1] + Math.sin(th) * td * 0.42 * ext[1]); });
    const LL = stream(seed, 'lanes'), canalCells = [];
    let crossed = false;
    const carve = (c, r) => { for (let k = 0; k < mainW; k++) for (let j = 0; j < mainW; j++) { const v = at(c + k, r + j); if (v === C.EMPTY || v === C.OPEN || v === C.LANE) lane(c + k, r + j, 1, [C.EMPTY, C.OPEN]); else if (v === C.WATER && !crossed) { canalCells.push([c + k, r + j]); crossed = true; } } };
    for (const from of starts) {
      let [c, r] = from; const to = precinctGateCell, path = []; crossed = false;
      for (let s = 0; s < 4000; s++) {
        carve(c, r); path.push([c, r]);
        const dc = to[0] - c, dr = to[1] - r;
        if (Math.abs(dc) + Math.abs(dr) <= 1 || at(c, r) === C.PRECINCT) break;
        const u = LL();
        if (u < 0.62) { if (Math.abs(dc) > Math.abs(dr)) c += Math.sign(dc); else r += Math.sign(dr); }
        else if (u < 0.86) { if (Math.abs(dc) > Math.abs(dr)) r += Math.sign(dr || (LL() < 0.5 ? 1 : -1)); else c += Math.sign(dc || (LL() < 0.5 ? 1 : -1)); }
        else if (LL() < 0.5) c += LL() < 0.5 ? 1 : -1; else r += LL() < 0.5 ? 1 : -1;
        if (at(c, r) === C.OUTSIDE || at(c, r) === -1) break;
      }
      mainPaths.push(path);
    }
    // a quay lane along each bank of a canal, inside the town
    if (water.kind === 'canal') for (let c = 0; c < cols; c++) for (let r = 1; r < rows - 1; r++) if (at(c, r) === C.EMPTY && (at(c, r - 1) === C.WATER || at(c, r + 1) === C.WATER)) lane(c, r, 1);
    for (let i = 0; i < (S.branches ?? 0) && laneCells.length; i++) {
      const [c, r] = laneCells[Math.floor(LL() * laneCells.length)], len = 5 + Math.floor(LL() * 13), horiz = LL() < 0.5, dir = LL() < 0.5 ? 1 : -1;
      let cc = c, rr = r;
      for (let s = 0; s < len; s++) { if (horiz) cc += dir; else rr += dir; if (LL() < 0.18) { if (horiz) rr += LL() < 0.5 ? 1 : -1; else cc += LL() < 0.5 ? 1 : -1; } const v = at(cc, rr); if (v !== C.EMPTY && v !== C.LANE) break; lane(cc, rr); }
    }
    approach.crossings = canalCells;
  } else if ((S.pattern === 'grid' && E.kind !== 'wards') || S.pattern === 'lattice') {
    // streets every block (a grid) or every `crossEvery` (a lattice's through streets), lined up on the armature
    const [gx, gy] = S.pattern === 'grid' ? [bx, by] : [S.crossEvery ?? 90, S.crossEvery ?? 90];
    const altW = Math.max(1, Math.round((S.pattern === 'grid' ? S.alley ?? 3 : S.main) / CELL));
    let k = 0;
    for (let x = ax - Math.ceil((ax) / gx) * gx; x < frame.w; x += gx, k++) { const main = S.pattern === 'lattice' || Math.round((x - ax) / gx) % 3 === 0; line(false, Math.floor(x / CELL), 0, rows - 1, main ? mainW : altW, main); }
    for (let y = ay - Math.ceil((ay) / gy) * gy; y < frame.d; y += gy) { const main = S.pattern === 'lattice' || Math.round((y - ay) / gy) % 3 === 0; line(true, Math.floor(y / CELL), 0, cols - 1, main ? mainW : altW, main); }
  } else if (S.pattern === 'contour') {
    // a street along the foot of every terrace, a stair street climbing every block
    const lv = (c, r) => { const [x, y] = mid(c, r); return site.base(x, y); };
    const [hdx, hdy] = toward(F.site.high ?? 'n');
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (at(c, r) === C.EMPTY || at(c, r) === C.OPEN) { const up = lv(c + hdx, r + hdy); if (up - lv(c, r) > 0.3) lane(c, r, 1, [C.EMPTY, C.OPEN]); }
    const horiz = hdx !== 0, stairs = [];
    for (let p = Math.floor(((horiz ? ay : ax) % bx) / CELL); p < (horiz ? rows : cols); p += Math.max(2, Math.round(bx / CELL))) {
      for (let t = 0; t < (horiz ? cols : rows); t++) {
        const [c, r] = horiz ? [t, p] : [p, t], v = at(c, r);
        if (v !== C.EMPTY && v !== C.OPEN && v !== C.LANE) continue;
        lane(c, r, 0, [C.EMPTY, C.OPEN]);
        const [c2, r2] = [c + hdx, r + hdy], rise = lv(c2, r2) - lv(c, r);
        if (S.stairs && rise > 0.3 && (at(c2, r2) === C.EMPTY || at(c2, r2) === C.LANE)) stairs.push({ c, r, rise });
      }
    }
    for (const q of stairs) {
      const [x, y] = [q.c * CELL, q.r * CELL], rect = { x, y, w: CELL, d: CELL }, f = F.site.high ?? 'n';
      slots.push({ asset: S.stairs, rect: horiz ? { x: x - (hdx < 0 ? 0 : 0), y, w: CELL, d: CELL } : rect, facing: opposite(f), z: lv(q.c, q.r), rise: q.rise });
    }
  }
  function wards() {
    const [ww, wd] = E.ward ?? [84, 86], t = E.thickness ?? 2, G = stream(seed, 'wards');
    const xs = []; for (let x = town.x; x + ww <= town.x + tw; x += ww + 6) xs.push(x);
    const ys = []; for (let y = town.y; y + wd <= town.y + td; y += wd + 6) ys.push(y);
    let market = null, best = Infinity;
    for (const x of xs) for (const y of ys) {
      const r = { x, y, w: ww, d: wd };
      if (rectCells(grow(r, 3)).some((v) => v !== C.EMPTY && v !== C.OPEN && v !== C.LANE)) continue;
      // the street round the ward
      for (let rr = Math.floor((y - 6) / CELL); rr < Math.ceil((y + wd + 6) / CELL); rr++) for (let c = Math.floor((x - 6) / CELL); c < Math.ceil((x + ww + 6) / CELL); c++) { const [px, py] = mid(c, rr); if (px < x || px > x + ww || py < y || py > y + wd) lane(c, rr, 0); }
      for (let rr = Math.floor(y / CELL); rr < Math.ceil((y + wd) / CELL); rr++) for (let c = Math.floor(x / CELL); c < Math.ceil((x + ww) / CELL); c++) if (rr === Math.floor(y / CELL) || c === Math.floor(x / CELL) || rr === Math.ceil((y + wd) / CELL) - 1 || c === Math.ceil((x + ww) / CELL) - 1) set(c, rr, C.WALL);
      const z = hAt(x + ww / 2, y + wd / 2), gs = sideToward([x + ww / 2, y + wd / 2], [ax, y + wd / 2 + (G() < 0.5 ? 1 : -1)]);
      for (const side of ['n', 'e', 's', 'w']) {
        const along = side === 'n' || side === 's', len = along ? ww : wd, gap = side === gs ? 8 : 0;
        for (const [a, b] of gap ? [[0, len / 2 - gap / 2], [len / 2 + gap / 2, len]] : [[0, len]]) {
          const rect = along ? { x: x + a, y: side === 'n' ? y : y + wd - t, w: b - a, d: t } : { x: side === 'w' ? x : x + ww - t, y: y + a, w: t, d: b - a };
          if (WL.run) slots.push({ asset: WL.run, rect, facing: side, z, h: 3.2 });
        }
        if (side === gs && WL.wardGate) {
          const gr = along ? { x: x + len / 2 - 5, y: side === 'n' ? y - 1 : y + wd - 3, w: 10, d: 4 } : { x: side === 'w' ? x - 1 : x + ww - 3, y: y + len / 2 - 5, w: 4, d: 10 };
          slots.push({ asset: WL.wardGate, rect: gr, facing: side, z, h: 3.2 });
          // the gate opens on a street running into the ward, which its alleys meet
          const [gc, gr2] = cellOf(...centre(gr)), [idc, idr] = toward(opposite(side));
          set(gc, gr2, C.LANE);
          for (let k = 1; k < Math.round((along ? wd : ww) / CELL) - 1; k++) lane(gc + idc * k, gr2 + idr * k, 0, [C.EMPTY, C.OPEN, C.WALL]);
        }
      }
      const d = Math.hypot(x + ww / 2 - townCentre[0], y + wd / 2 - townCentre[1] - td * 0.15);
      if (E.market && d < best) { best = d; market = r; }
    }
    if (market) {
      const inner = grow(market, -t - 1);
      slots.push({ asset: E.market, rect: inner, facing: 'n', z: hAt(...centre(inner)) });
      claimRect(inner, C.HOUSE);
      approach.market = market;
    }
  }
  if (S.pattern !== 'grid') alleyLattice(g, [Math.max(2, Math.round(by / CELL)), Math.max(2, Math.round(bx / CELL))], seed, laneCells, { jog: S.jog ?? 0.06 });
  else if (E.kind === 'wards') alleyLattice(g, [Math.max(2, Math.round(by / CELL / 2)), Math.max(2, Math.round(bx / CELL / 2))], seed, laneCells, { jog: 0 });

  // canal bridges: where a main street meets the canal
  if (water.kind === 'canal' && F.water.bridge && approach.crossings?.length) {
    const seen = new Set();
    for (const [c0] of approach.crossings) {
      if ([...seen].some((c) => Math.abs(c - c0) < 4)) continue;
      seen.add(c0);
      const x = c0 * CELL, w = 7, yN = water.centre(x + w / 2) - water.width / 2, yS = yN + water.width, reach = 9;
      slots.push({ asset: F.water.bridge, rect: { x, y: yN - reach, w, d: yS - yN + 2 * reach }, facing: 'n', span: { y0: reach, y1: reach + yS - yN }, waterZ: water.z, z: 0 });
    }
  }

  // ── placement, after: along the approach, at the crossings, on the water and its banks, round the town's edge
  for (const it of items) {
    const [w, d] = sizeOf(it), n = it.max ?? 1, every = it.every ?? 0, PL = stream(seed, `place|${it.asset ?? it.monument}`);
    if (it.where === 'approach') {
      const way = approach.way ?? approach.avenue;
      if (!way) continue;
      const horiz = way.w > way.d, len = horiz ? way.w : way.d, step = Math.max(every || 12, (horiz ? w : d) + 2);
      if (it.monument) {
        // beside the way, as near its foot as there is room, facing across it (its long side along the way)
        // it faces the way the approach runs, as the main monument does
        const [mw, md] = MONUMENTS[it.monument].size, ok = (v) => v === C.EMPTY || v === C.OPEN || v === C.OUTSIDE || v === C.LANE || v === C.PRECINCT;
        const f = way.side ?? mFacing, across = f === 'n' || f === 's' ? mw : md;
        let done = false;
        for (const t of [0.85, 0.7, 0.55, 0.4, 0.25]) for (const o of [1, -1]) {
          if (done) break;
          const off = 4 + (horiz ? (f === 'e' || f === 'w' ? mw : md) : across) / 2;
          const r = horiz ? rectFor(way.x + way.w * t, o > 0 ? way.y + way.d + off : way.y - off, mw, md, f) : rectFor(o > 0 ? way.x + way.w + off : way.x - off, way.y + way.d * t, mw, md, f);
          if (free(r, ok) && !meets(r, grow(mRect, 4))) { put(it, r, f); done = true; }
        }
        if (!done) notes.push(`no room beside the approach for '${it.monument}'`);
        continue;
      }
      let k = 0;
      for (let s = step; s < len && k < n; s += step) for (const o of [-1, 1]) {
        if (k >= n) break;
        const r = horiz ? { x: way.x + s, y: o < 0 ? way.y - d - 0.4 : way.y + way.d + 0.4, w, d } : { x: o < 0 ? way.x - w - 0.4 : way.x + way.w + 0.4, y: way.y + s, w, d };
        if (!free(r, (v) => v === C.EMPTY || v === C.OPEN || v === C.OUTSIDE)) continue;
        put(it, r, horiz ? (o < 0 ? 's' : 'n') : (o < 0 ? 'e' : 'w')); claimRect(r, C.OPEN); k++;
      }
    } else if (it.where === 'crossing') {
      const done = [];
      const isLane = (c, r) => at(c, r) === C.LANE;
      for (let r = 1; r < rows - 1 && done.length < n; r++) for (let c = 1; c < cols - 1 && done.length < n; c++) {
        if (!isLane(c, r) || isLane(c - 1, r) + isLane(c + 1, r) + isLane(c, r - 1) + isLane(c, r + 1) < 3) continue;
        const p = mid(c, r);
        if (done.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > (every || 50)) && PL() < 0.5) { done.push(p); put(it, rectFor(p[0], p[1], w, d, 's'), 's'); }
      }
    } else if (it.where === 'wall-strip' && E.kind === 'ring') {
      const quarter = PL() * 6.283, got = [];
      for (let r = 0; r < rows && got.length < n; r++) for (let c = 0; c < cols && got.length < n; c++) {
        const rect = { x: c * CELL, y: r * CELL, w, d };
        if (!free(rect, (v) => v === C.OPEN)) continue;
        const th = Math.atan2(r * CELL - townCentre[1], c * CELL - townCentre[0]), dth = Math.abs(((th - quarter + 9.42) % 6.283) - 3.14);
        if (dth < 0.4 && got.every((q) => Math.hypot(q[0] - rect.x, q[1] - rect.y) > 9)) { got.push([rect.x, rect.y]); put(it, rect, sideToward(townCentre, centre(rect)) === 'n' ? 's' : 'n'); claimRect(rect, C.HOUSE); }
      }
    } else if (it.where === 'water' && water.kind !== 'none') {
      let k = 0;
      for (let tries = 0; tries < 400 && k < n; tries++) {
        const x = town.x - 40 + PL() * (tw + 80), y = town.y - 40 + PL() * (td + 80), horiz = water.kind === 'canal' || water.side === 'n' || water.side === 's';
        const r = rectFor(x, y, w, d, horiz ? 'n' : 'e');
        if (![[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.d], [r.x + r.w, r.y + r.d]].every(([px, py]) => water.isWater(px, py) && px > 0 && py > 0 && px < frame.w && py < frame.d)) continue;
        if (placed.some((q) => q.rect && meets(grow(q.rect, every ? every / 3 : 3), r)) || slots.some((s) => (s.asset === F.water.bridge || s.asset === AP.quay) && meets(grow(s.rect, 4), r))) continue;
        put(it, r, horiz ? (PL() < 0.5 ? 'n' : 's') : (PL() < 0.5 ? 'e' : 'w'), { z: water.z + 0.05 }); k++;
      }
    } else if (it.where === 'bank' && water.kind !== 'none') {
      // on dry ground outside the town, its back to the land and its front to the water
      let k = 0;
      for (let tries = 0; tries < 600 && k < n; tries++) {
        const x = PL() * frame.w, y = PL() * frame.d;
        const [c, r] = cellOf(x, y);
        if (at(c, r) !== C.OUTSIDE) continue;
        // the nearest water within a few metres
        let side = null; for (const sd of ['n', 's', 'e', 'w']) { const [dx, dy] = toward(sd); if (water.isWater(x + dx * (d / 2 + 4), y + dy * (d / 2 + 4))) { side = sd; break; } }
        if (!side) continue;
        const rect = rectFor(x, y, w, d, side);
        if (!free(rect, (v) => v === C.OUTSIDE) || placed.some((q) => q.rect && meets(grow(q.rect, every ? every / 2 : 2), rect))) continue;
        put(it, rect, side); claimRect(rect, C.REED); k++;
      }
    } else if (it.where === 'town-edge') {
      let k = 0;
      const cands = [];
      for (let y = 0; y + d < frame.d; y += CELL * 2) for (let x = 0; x + w < frame.w; x += CELL * 2) {
        const r = { x, y, w, d }; if (!free(r, (v) => v === C.OUTSIDE)) continue;
        const zs = [[r.x, r.y], [r.x + w, r.y], [r.x, r.y + d], [r.x + w, r.y + d]].map((p) => hAt(...p)); if (Math.max(...zs) - Math.min(...zs) > 1.5 || Math.min(...zs) < 0.2 && water.kind === 'sea') continue;
        let near = Infinity; for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) for (let s = 1; s < 12; s++) { const [c, rr] = cellOf(x + w / 2 + dx * (w / 2 + s * CELL), y + d / 2 + dy * (d / 2 + s * CELL)); const v = at(c, rr); if (v !== C.OUTSIDE && v !== -1 && v !== C.WATER && v !== C.FIELD && v !== C.REED) { near = Math.min(near, s); break; } }
        if (near < 12) cands.push({ r, near: near + PL() * 3 });
      }
      cands.sort((a, b) => a.near - b.near);
      for (const { r } of cands) { if (k >= n) break; if (!free(r, (v) => v === C.OUTSIDE) || placed.some((q) => q.rect && meets(grow(q.rect, every ? every / 2 : 4), r))) continue; put(it, r, sideToward(centre(r), townCentre)); claimRect(r, C.HOUSE); k++; }
    }
  }

  // ── lots: the free ground packed with house lots, each fronting a lane ──
  const D = F.density, H = F.houses, LT = stream(seed, 'fill');
  const houseAssets = new Set(H.map((h) => h.asset));
  for (const lot of packLots(g, D.lot, seed)) {
    const s = lotSlot(g, lot, D.gap ?? 0.4, () => null), r = s.rect;
    const zs = [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.d], [r.x + r.w, r.y + r.d]].map((p) => hAt(...p));
    const opens = (v) => v === C.LANE || v === C.OPEN;
    let sides = 0;
    for (let k = 0; k < lot.w; k++) sides += opens(at(lot.c0 + k, lot.r0 - 1)) + opens(at(lot.c0 + k, lot.r0 + lot.d));
    for (let k = 0; k < lot.d; k++) sides += opens(at(lot.c0 - 1, lot.r0 + k)) + opens(at(lot.c0 + lot.w, lot.r0 + k));
    if (!sides || Math.max(...zs) - Math.min(...zs) > 0.5 || (D.fill !== undefined && LT() > D.fill)) { for (let rr = lot.r0; rr < lot.r0 + lot.d; rr++) for (let c = lot.c0; c < lot.c0 + lot.w; c++) set(c, rr, C.OPEN); continue; }
    const [dc, dr] = toward(s.facing), fc = s.facing === 'e' ? lot.c0 + lot.w : s.facing === 'w' ? lot.c0 - 1 : lot.c0 + Math.floor(lot.w / 2), fr = s.facing === 's' ? lot.r0 + lot.d : s.facing === 'n' ? lot.r0 - 1 : lot.r0 + Math.floor(lot.d / 2);
    const onMain = surf[fr * cols + fc] === 1 && at(fc, fr) === C.LANE; void dc; void dr;
    const h = H.find((q) => (q.minSide === undefined || Math.min(r.w, r.d) >= q.minSide) && (q.minArea === undefined || r.w * r.d >= q.minArea) && (!q.onMain || onMain)) ?? H[H.length - 1];
    if (!kit[h.asset]) { notes.push(`house '${h.asset}' has no asset in the kit`); continue; }
    slots.push({ ...s, asset: h.asset, z: Math.min(...zs) });
  }
  // the large lots nearest the precinct, and those on the main streets, given over
  for (const it of items) {
    if (it.where !== 'near-monument' && it.where !== 'main-street') continue;
    const cands = slots.filter((q) => houseAssets.has(q.asset));
    const dist = (q) => Math.hypot(centre(q.rect)[0] - mcx, centre(q.rect)[1] - mcy);
    const pickd = it.where === 'near-monument' ? cands.sort((a, b) => b.rect.w * b.rect.d - a.rect.w * a.rect.d).slice(0, 12).sort((a, b) => dist(a) - dist(b)) : cands;
    pickd.slice(0, it.max ?? 1).forEach((q) => { q.asset = it.asset; });
  }

  // ── the land: fields and trees outside the town; in a region, the work done in it ──
  const HL = F.hinterland || {}, GR = stream(seed, 'groves');
  const activities = view === 'city' ? [] : layActivities();
  function layActivities() {
    const out = [], land = landOf(culture), AC = stream(seed, 'activities'), inReach = new Set(availableAt(placeOf(culture)).map((r) => r.key));
    for (const a of F.activities || []) if (!activitiesOf(culture, { activities: [a] }, inReach).length) notes.push(`the activity '${a.id}' is left out: ${(a.cites || []).filter((k) => !inReach.has(k)).length ? `${(a.cites || []).filter((k) => !inReach.has(k)).join(', ')} not yet in reach at the town's year` : 'its kit lacks a piece'}`);
    for (const a of activitiesOf(culture, F, inReach)) {
      const K2 = (a.kit === 'farm' ? FARM_CULTURES : WORKS_CULTURES)[land];
      const sizes = a.pieces.map((p) => envelopeMid(K2.assets[p]));
      // the yard: the pieces in two rows round a court, 4 m apart
      const half = Math.ceil(sizes.length / 2), rowsP = [sizes.slice(0, half), sizes.slice(half)];
      const yw = Math.max(...rowsP.map((rw) => rw.reduce((s, [w]) => s + w + 4, 0))) + 4, yd = Math.max(...rowsP[0].map((q) => q[1])) + Math.max(0, ...rowsP[1].map((q) => q[1])) + 14;
      const score = (x, y) => {
        const dTown = Math.hypot(x - townCentre[0], y - townCentre[1]);
        if (a.where === 'fields') return -Math.abs(dTown - Math.max(tw, td) * 0.75);
        if (a.where === 'outside') return -dTown;
        // by the water, upstream (west or north of the town) or downstream
        const nearW = [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => water.isWater(x + dx * (yd / 2 + 8), y + dy * (yd / 2 + 8))) ? 0 : 400;
        const up = water.upstream === 'w' ? x < townCentre[0] : y < townCentre[1];
        return -(nearW + (up === (a.where === 'upstream') ? 0 : 300) + Math.abs(dTown - Math.max(tw, td) * 0.6) * 0.3);
      };
      let best = null;
      for (let y = 4; y + yd < frame.d - 4; y += CELL * 3) for (let x = 4; x + yw < frame.w - 4; x += CELL * 3) {
        const r = { x, y, w: yw, d: yd };
        if (!free(grow(r, 2), (v) => v === C.OUTSIDE)) continue;
        const zs = [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.d], [r.x + r.w, r.y + r.d]].map((p) => hAt(...p)); if (Math.max(...zs) - Math.min(...zs) > 1) continue;
        const sc = score(x + yw / 2, y + yd / 2) + AC() * 4;
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
  const fieldsOn = HL.fields ?? 0, treesOn = HL.trees ?? 0, maxTrees = HL.max ?? 120;
  let trees = 0;
  const plant = (x, y, z) => {
    if (trees >= maxTrees || HL.tree === 'none') return;
    const kind = HL.tree ?? 'palm';
    const lift = (bs) => bs.map((b) => ({ ...b, z0: b.z0 + z, z1: b.z1 + z, ...(b.pts ? { pts: b.pts.map(([px, py, pz]) => [px, py, pz + z]) } : {}) }));
    if (kind === 'palm') boxes.push(...lift([palm(x, y, GR)]));
    else if (kind === 'olive') boxes.push(...olive(x, y, z, GR, { olive: P.olive ?? '#6f7a4c', ...P }));
    else boxes.push(...lift(qinTree(x, y, GR, { poplar: P.poplar ?? '#5f7a3c', bark: P.bark ?? '#6b5a44', ...P }, { crown: kind, h: 7 + GR() * 3 })));
    trees++;
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

  // ── the slice's window: the region's ground round a focus, cut to its frame ──
  const views = {}, foci = {};
  const eyeOn = (x, y) => [x, y, hAt(x, y) + 1.7];
  const look = (x, y, z) => [x, y, z];
  const mTop = mZ + Math.min(30, Math.max(MW, MD) * 0.25);
  // the street view: on a main street some 70 m from the precinct's gate, looking up at the monument
  {
    let best = null;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (at(c, r) !== C.LANE || !surf[r * cols + c]) continue;
      const [x, y] = mid(c, r), dd = Math.abs(Math.hypot(x - gate[0], y - gate[1]) - 70);
      if (!best || dd < best.dd) best = { x, y, dd };
    }
    if (best) { views.street = { eye: eyeOn(best.x, best.y), at: look(mcx, mcy, mTop) }; foci.street = [best.x, best.y]; }
  }
  {
    const [fx, fy] = frontEdge(mRect, mFacing), off = apron + 14, ex = fx + front[0] * off, ey = fy + front[1] * off;
    views.monument = { eye: [ex, ey, hAt(ex, ey) + 1.7 + (square || A.kind === 'summit' ? 0 : terrace)], at: look(mcx, mcy, mZ + Math.min(14, mTop - mZ)) };
    foci.monument = [ex, ey];
  }
  if (water.kind !== 'none') {
    let best = null;
    const o = Math.min(8, water.width / 3);   // open water round the eye: a canal is narrow
    for (let k = 0; k < 1600; k++) { const x = (k % 40) / 40 * frame.w + 2, y = Math.floor(k / 40) / 40 * frame.d + 2; if (!water.isWater(x, y) || ![[o, 0], [-o, 0], [0, o], [0, -o]].every(([dx, dy]) => water.isWater(x + dx, y + dy))) continue; const dd = Math.hypot(x - mcx, y - mcy); if (!best || dd < best.dd) best = { x, y, dd }; }
    if (best) { views.water = { eye: [best.x, best.y, water.z + 2.2], at: look(mcx, mcy, mTop) }; foci.water = [best.x, best.y]; }
  }
  if (gates.length) { const [gc, gr] = gates[0], [x, y] = mid(gc, gr), o = toward(sideToward(townCentre, [x, y])); views.gate = { eye: eyeOn(x + o[0] * 30, y + o[1] * 30), at: look(x, y, hAt(x, y) + 6) }; foci.gate = [x, y]; }
  if (approach.market) { const [x, y] = centre(approach.market); foci.market = [x, y]; }
  for (const a of activities) { const [x, y] = a.centre, ex = x + a.rect.w * 0.5 + 16, ey = y + 18; views[a.id] = { eye: eyeOn(ex, ey), at: look(x, y, hAt(x, y) + 2) }; foci[a.id] = [x, y]; }
  let win = { x: 0, y: 0, w: frame.w, d: frame.d };
  if (view === 'slice') {
    const fid = focus ?? (activities[0]?.id ?? 'street');
    if (!foci[fid]) throw new Error(`historic: ${culture} has no slice of life round '${fid}' — one of ${Object.keys(foci).map((f) => `'${f}'`).join(', ')}`);
    const [fx, fy] = foci[fid], [sw, sd] = SLICE;
    win = { x: Math.max(0, Math.min(frame.w - sw, fx - sw / 2)), y: Math.max(0, Math.min(frame.d - sd, fy - sd / 2)), w: sw, d: sd };
    // the slice's own eye: at its focus, looking across it
    const eye = eyeOn(fx + sw * 0.28, fy + sd * 0.3);
    for (const k of Object.keys(views)) if (!views[k].eye.every((v, i) => i > 1 || (v >= win.x + (i ? 0 : 0) && v <= (i ? win.y + win.d : win.x + win.w)))) delete views[k];
    views.slice = { eye, at: look(fx, fy, hAt(fx, fy) + 2) };
  }
  const inWin = (r) => meets(r, grow(win, -0.05));   // what overlaps the window, not what only touches its edge

  // ── place: every slot by its kit; the activities by theirs; the monuments built outside a kit ──
  const keep = slots.filter((s) => inWin(s.rect));
  keep.forEach((slot, i) => {
    const A2 = kit[slot.asset];
    if (!A2) { notes.push(`no asset '${slot.asset}' in the ${culture} kit`); return; }
    // a borrowed asset is built in its lender's colours: its builder reads the lender's palette as it was written
    const pal = borrowed[slot.asset] ? { ...P, ...HISTORIC_CULTURES[borrowed[slot.asset]].palette } : P;
    const out = placeAsset(A2, slot, { palette: pal, culture: K, rng: stream(seed, `asset|${slot.asset}|${i}`) });
    boxes.push(...out.boxes.map((b) => (slot.monument ? { ...b, monument: slot.monument } : b))); grounds.push(...out.grounds);
  });
  for (const a of activities) {
    const K2 = (a.kit === 'farm' ? FARM_CULTURES : WORKS_CULTURES)[landOf(culture)];
    a.pieces.filter((s) => inWin(s.rect)).forEach((slot, i) => {
      const out = placeAsset(K2.assets[slot.asset], slot, { palette: K2.palette ?? P, culture: K, rng: stream(seed, `activity|${a.id}|${i}`) });
      boxes.push(...out.boxes); grounds.push(...out.grounds);
    });
    keep.push(...a.pieces.filter((s) => inWin(s.rect)));
  }
  const repeats = buildMonuments(builds.filter((b) => inWin(b.rect)), boxes, grounds);
  skinLoose(boxes, K);

  // ── ground: the terrain under it all, the lanes on it, the precinct's floor, the square ──
  const H0 = (x, y) => hAt(x + win.x, y + win.y);
  const groundFill = P.ground, sand = P.sand ?? scaleHex(P.ground, 1.08), rockFill = P.rock ?? P.platform ?? scaleHex(P.ground, 0.92);
  const waterFill = P.water ?? P.sea ?? '#4f7f86';
  const T = terrainMesh({
    hAt: H0, frame: { w: win.w, d: win.d }, cell: view === 'region' ? 20 : 10, eyeRadius: 40,
    eyes: Object.values(views).map((v) => [v.eye[0] - win.x, v.eye[1] - win.y]),
    surfaceAt: (x, y, z) => (z > 0 && z < 1.6 && water.kind === 'sea' ? { fill: sand } : site.rock && z >= site.rock - 0.5 ? { fill: rockFill } : { fill: groundFill, surface: 'dry-earth' }),
    riserTint: (h) => (h >= 4 ? P.cliff ?? scaleHex(groundFill, 0.82) : P.bank ?? P.socle ?? scaleHex(groundFill, 0.86)),
    water: water.kind === 'none' ? null : { z: water.z, fill: waterFill, ...(K.water?.look ? { liquid: { ...K.water.look, unit: 1 / 3.66 }, sheetFill: waterFill } : {}) },
  });
  const ground = [...T.grounds];
  boxes.push(...T.boxes.map((b) => shiftMass(b, win.x, win.y)));
  const surfOf = (main) => SURF[(main ? S.surface?.main : S.surface?.alley) ?? (main ? 'rubble' : 'mud')];
  const fillOf = (sname) => (sname === 'flagstone' || sname === 'brick' ? P.paving ?? P.street ?? P.lane : sname === 'rubble' ? P.street ?? P.lane : P.lane ?? P.ground);
  const level = (c, r) => hAt(...mid(c, r));
  for (const main of [0, 1]) {
    const sname = surfOf(main);
    // the lanes, and with the alleys the town's open ground: the slivers between houses, the strip under the wall
    const walked = (v, c, r) => (v === C.LANE && surf[r * cols + c] === main) || (!main && v === C.OPEN && !steepCells[r * cols + c]);
    runs(grid, cols, rows, (v, c, r) => walked(v, c, r) && !(square && meets({ x: c * CELL, y: r * CELL, w: CELL, d: CELL }, square)), (c, r, n) => {
      let s = c;
      for (let k = c; k <= c + n; k++) if (k === c + n || Math.abs(level(k, r) - level(s, r)) > 0.01) {
        const rect = { x: s * CELL, y: r * CELL - (r % 2 ? 0.08 : 0), w: (k - s) * CELL + 0.15, d: CELL + (r % 2 ? 0.16 : 0) };
        if (inWin(rect)) grounds.push({ kind: 'lane', ...rect, z: level(s, r) + laneZ(main, r), fill: fillOf(sname), surface: sname });
        s = k;
      }
    });
  }
  if (square) grounds.push({ kind: 'square', ...square, z: hAt(...centre(square)) + 0.05, fill: P.square ?? P.paving ?? P.street, surface: 'flagstone' });
  else if (A.kind !== 'axis' || PR.floor) {
    const t = PR.thickness ?? 0, fl = grow(precinct, -t);
    grounds.push({ kind: 'precinct-floor', ...fl, z: hAt(mcx, mcy) + terrace + 0.035, fill: P.precinctFloor ?? P.court ?? P.paving ?? P.ground, surface: PR.floor ?? 'dry-earth' });
  }
  if (approach.avenue) grounds.push({ kind: 'avenue', ...approach.avenue, z: hAt(...centre(approach.avenue)) + 0.05, fill: P.paving ?? P.street, surface: 'flagstone' });

  // ── into the window's frame ──
  const mv = (p) => [p[0] - win.x, p[1] - win.y, ...p.slice(2)];
  const placedBoxes = boxes.filter((b) => inWin(b)).map((b) => shiftMass(b, -win.x, -win.y));
  const placedGrounds = [...ground, ...grounds.filter((q) => (q.poly ? q.poly.some(([x, y]) => x > win.x && x < win.x + win.w && y > win.y && y < win.y + win.d) : inWin(q))).map((q) => (q.poly ? { ...q, poly: q.poly.map(mv) } : { ...q, x: q.x - win.x, y: q.y - win.y }))];
  for (const v of Object.values(views)) { v.eye = mv(v.eye); v.at = mv(v.at); }
  const mvRect = (r) => (r ? { ...r, x: r2(r.x - win.x), y: r2(r.y - win.y) } : r);
  const outSlots = keep.map((s) => ({ ...s, rect: mvRect(s.rect) }));
  const reps = repeats.map((r) => ({ ...r, transforms: r.transforms.map((t) => ({ pos: mv(t.pos) })) }));

  // ── what the field guide reads: the ledger at this place and year, the laws ──
  const place = placeOf(culture);
  const ledger = {
    place, buildable: buildableAt(place),
    findings: ledgerFindings(place, { surfaces: cardSurfaces(K), rows: [...new Set([...monuments.flatMap((m) => MONUMENTS[m.id].cites), ...Object.values(F.cites || {}).flat()])] }),
  };
  const laws = lawsOf();
  function lawsOf() {
    // a house's front: the cells just past its facing side, along its whole width
    const frontCells = (q) => { const r = q.rect, f = q.facing, out = []; for (let t = 0.5; t < (f === 'n' || f === 's' ? r.w : r.d); t += CELL) { const [x, y] = f === 'n' ? [r.x + t, r.y - 1.5] : f === 's' ? [r.x + t, r.y + r.d + 1.5] : f === 'w' ? [r.x - 1.5, r.y + t] : [r.x + r.w + 1.5, r.y + t]; out.push(at(...cellOf(x, y))); } return out; };
    const fronts = slots.filter((q) => houseAssets.has(q.asset)).filter((q) => !frontCells(q).some((v) => v === C.LANE || v === C.OPEN || v === C.PRECINCT)).length;
    // the lanes as one network: the share reachable from the precinct's gate
    const seen = new Uint8Array(cols * rows), q = [];
    let start = null, best = Infinity;
    for (const [c, r] of laneCells) { const d = Math.hypot(c - precinctGateCell[0], r - precinctGateCell[1]); if (d < best && at(c, r) === C.LANE) { best = d; start = [c, r]; } }
    if (start) { q.push(start); seen[start[1] * cols + start[0]] = 1; }
    const bridged = new Set();
    for (const s of slots) if (s.asset === F.water.bridge || s.asset === AP.quay) for (let rr = Math.floor(s.rect.y / CELL); rr < Math.ceil((s.rect.y + s.rect.d) / CELL); rr++) for (let c = Math.floor(s.rect.x / CELL); c < Math.ceil((s.rect.x + s.rect.w) / CELL); c++) bridged.add(rr * cols + c);
    while (q.length) { const [c, r] = q.pop(); for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const cc = c + dc, rr = r + dr; if (cc < 0 || rr < 0 || cc >= cols || rr >= rows || seen[rr * cols + cc]) continue; const v = at(cc, rr); if (v === C.LANE || v === C.OPEN || v === C.PRECINCT || bridged.has(rr * cols + cc)) { seen[rr * cols + cc] = 1; q.push([cc, rr]); } } }
    let lanes = 0, reached = 0; for (let i = 0; i < grid.length; i++) if (grid[i] === C.LANE) { lanes++; if (seen[i]) reached++; }
    const share = lanes ? reached / lanes : 1;
    const inFrame = mRect.x >= 0 && mRect.y >= 0 && mRect.x + mRect.w <= frame.w && mRect.y + mRect.d <= frame.d;
    return [
      { id: 'fronts', want: 'every house has its door on a lane', ok: fronts === 0, detail: fronts ? `${fronts} houses face no lane` : 'every house fronts a lane' },
      { id: 'connected', want: 'the lanes are one network, reached from the monument', ok: share > 0.9, detail: `${Math.round(share * 100)} % of the lanes reached from the precinct's gate` },
      { id: 'monument-fits', want: 'the monument stands whole on its site, inside the frame', ok: inFrame, detail: inFrame ? 'it stands whole' : 'it runs off the frame: move `armature.at` in' },
    ];
  }

  const houses = slots.filter((s) => houseAssets.has(s.asset)).length;
  return {
    boxes: placedBoxes, grounds: placedGrounds, views, slots: outSlots, frame: { w: win.w, d: win.d },
    hAt: H0, focus: M.focus ? (() => { const [fx, fy] = M.focus(MW, MD); const r = orientBox({ x: fx, y: fy, w: 0, d: 0 }, mRect, mFacing); return [r.x - win.x, r.y - win.y]; })() : [mcx - win.x, mcy - win.y],
    ...(reps.length ? { repeats: reps } : {}),
    world: { boxes: [], skirt: view === 'slice' ? null : { width: 120, cell: 20, fill: groundFill, ...(water.kind !== 'none' ? { waterZ: water.z, water: waterFill } : {}) } },
    stats: {
      culture, scene, focus: view === 'slice' ? (focus ?? activities[0]?.id ?? 'street') : null, form: F.label ?? null,
      houses, precinct: mvRect(precinct), ...(square ? { square: mvRect(square) } : {}),
      monuments: monuments.map((m) => ({ ...m, rect: mvRect(m.rect) })),
      activities: activities.map((a) => ({ id: a.id, read: a.read, rect: mvRect(a.rect) })),
      foci: Object.keys(foci), trees, laneCells: grid.reduce((n, v) => n + (v === C.LANE ? 1 : 0), 0),
      gates: gates.length, borrowed: [...new Set(slots.map((s) => borrowed[s.asset]).filter(Boolean))],
    },
    grid: { cols, rows, cell: CELL, data: grid, codes: C, origin: [win.x, win.y] },
    form: F, ledger, laws, notes,
  };
}

/** The middle of an asset's size envelope, [w, d] metres. */
function envelopeMid(A) {
  const e = A?.envelope;
  return e ? [(e.w[0] + e.w[1]) / 2, (e.d[0] + e.d[1]) / 2] : [6, 6];
}

/** A mass moved by (dx, dy): its rect, a solid's top, a panel's corners, a beam's ends. */
function shiftMass(b, dx, dy) {
  const o = { ...b, x: b.x + dx, y: b.y + dy };
  if (b.top) o.top = { ...b.top, x: b.top.x + dx, y: b.top.y + dy };
  if (b.pts) o.pts = b.pts.map(([x, y, z]) => [x + dx, y + dy, z]);
  if (b.solid === 'beam') { o.a = [b.a[0] + dx, b.a[1] + dy, b.a[2]]; o.b = [b.b[0] + dx, b.b[1] + dy, b.b[2]]; }
  return o;
}

const TURN = { n: 0, e: 1, s: 2, w: 3 };
/** Monuments built outside a kit (the Forum's orders): their masses into `boxes`, their instances gathered as repeats. */
function buildMonuments(builds, boxes, grounds) {
  const reps = new Map();
  for (const B of builds) {
    const { W, D } = localSize(B.rect, B.facing), r = B.build({ W, D }), z = B.z ?? 0;
    for (const b of r.boxes) {
      const o = { ...orientBox(b, B.rect, B.facing), ...orientSolid(b, B.facing, (rr) => orientBox(rr, B.rect, B.facing)), z0: b.z0 + z, z1: b.z1 + z, building: B.monument ?? B.id };
      if (o.pts) o.pts = o.pts.map(([x, y, zz]) => [x, y, zz + z]);
      for (const k of ['a', 'b']) if (Array.isArray(o[k])) o[k] = [o[k][0], o[k][1], o[k][2] + z];
      boxes.push(o);
    }
    for (const gq of r.grounds || []) grounds.push({ ...orientBox(gq, B.rect, B.facing), z: gq.z + z });
    for (const i of r.inst || []) {
      const p = orientBox({ x: i.x, y: i.y, w: 0, d: 0 }, B.rect, B.facing), turn = i.key.startsWith('col:') ? 0 : (i.turn + TURN[B.facing]) % 4;
      const key = i.turn === turn ? i.key : i.key.replace(/:\d$/, `:${turn}`);
      let e = reps.get(key);
      if (!e) {
        const remake = (f) => () => { const ms = f(); return turn === i.turn ? ms : turnFrom(ms, i.turn, turn); };
        e = { key, make: remake(i.make), low: remake(i.low), transforms: [] };
        reps.set(key, e);
      }
      e.transforms.push({ pos: [p.x, p.y, i.z + z] });
    }
  }
  return [...reps.values()].map((e) => ({ key: e.key, template: e.make(), low: e.low(), transforms: e.transforms }));
}

/** Re-turn a part built at quarter turn `from` to `to` (both about its origin). */
function turnFrom(ms, from, to) {
  const k = ((to - from) % 4 + 4) % 4, tp = ([x, y]) => [[x, y], [-y, x], [-x, -y], [y, -x]][k];
  const tr = (r) => { const ps = [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.d], [r.x + r.w, r.y + r.d]].map(tp), xs = ps.map((p) => p[0]), ys = ps.map((p) => p[1]); return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), d: Math.max(...ys) - Math.min(...ys) }; };
  return ms.map((m) => ({ ...m, ...tr(m), ...(m.top ? { top: tr(m.top) } : {}), ...(m.pts ? { pts: m.pts.map(([x, y, z]) => [...tp([x, y]), z]) } : {}), ...(m.out ? { out: [...tp([m.out[0], m.out[1]]), m.out[2]] } : {}), ...(m.a ? { a: [...tp([m.a[0], m.a[1]]), m.a[2]] } : {}), ...(m.b ? { b: [...tp([m.b[0], m.b[1]]), m.b[2]] } : {}) }));
}
