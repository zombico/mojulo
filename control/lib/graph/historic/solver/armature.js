/**
 * historic/solver/armature — what a town is organised round: its monument seated at its place, the precinct round it,
 * the approach to it. ARMATURES is keyed by the form's `armature.kind`; each entry says which way the monument faces
 * and what its kind brings (a square, a rock, an avenue, a climb). The form's schema reads its words from here.
 */
import { CELL, C, stream } from '../layout-kit.js';
import { heightOf, waterOf, turnFacing, opposite, toward } from './site.js';
import { orientBox, localSize } from '../assets/kit.js';
import { MONUMENTS } from '../monuments/index.js';
import { r2, centre, grow, rectFor, sideToward, frontEdge } from './context.js';

/**
 * The armatures, by `armature.kind`. `read` is what the guide says; `face(X)` which way the monument looks; the rest
 * are what the kind brings:
 *   seat      seats the monument itself (the forum: at its square's head) instead of on its point
 *   rock      the summit's precinct stands on the rock (`site.rock`)
 *   overWater the precinct may claim water (a summit over the sea)
 *   avenue    an `approach.width` is an avenue from the precinct's front out to the water
 *   aside     the processional way leaves from the precinct's side toward the town
 *   openFront the precinct's front wall is open the approach's width
 *   climb     the way is a climb down into the town, 40 m in
 *   flankWay  the way is lined like the avenue
 *   eyeLevel  the monument's view stands on the ground, not on the terrace
 *   bareFloor the precinct has a floor only when the form asks for one
 */
export const ARMATURES = Object.freeze({
  heart: { read: 'the monument at the heart of the town', face: (X) => (X.water.kind === 'canal' ? (X.water.centre(X.ax) > X.ay ? 's' : 'n') : X.water.side ?? 's') },
  axis: {
    read: 'the monument at the end of an axis from the water',
    face: (X) => (X.water.kind === 'canal' ? (X.water.centre(X.ax) > X.ay ? 's' : 'n') : X.water.side ?? opposite(X.F.site.high ?? 'n')),
    avenue: true, aside: true, openFront: true, flankWay: true, bareFloor: true,
  },
  summit: { read: 'the monument on the summit above the town', face: (X) => sideToward([X.ax, X.ay], X.townCentre), rock: true, overWater: true, openFront: true, climb: true, eyeLevel: true },
  forum: {
    read: 'the monument at the head of a forum square',
    face: (X) => ((X.A.square?.[1] ?? 1) >= (X.A.square?.[0] ?? 1) ? 's' : 'e'),
    seat: (X) => {
      const { A, ax, ay, mFacing } = X, [MW, MD] = X.M.size, [sw, sd] = A.square;
      X.square = { x: ax - sw / 2, y: ay - sd / 2, w: sw, d: sd };
      // the monument at the square's head, its back to the head's edge, facing down the square
      return mFacing === 's' ? { x: ax - MW / 2, y: X.square.y + 3, w: MW, d: MD } : { x: X.square.x + 3, y: ay - MW / 2, w: MD, d: MW };
    },
    eyeLevel: true,
  },
});

/** The site: the water, the monument's place and facing, its precinct, the lie of the land. */
export function seatArmature(X) {
  const { F, town, tw, td, seed } = X;
  X.water = waterOf(F.water, town, stream(seed, 'water'));
  const A = X.A = F.armature, M = X.M = MONUMENTS[A.monument], AR = X.AR = ARMATURES[A.kind];
  if (!M) throw new Error(`historic: the form names a monument '${A.monument}' the library does not have`);
  [X.ax, X.ay] = [town.x + (A.at?.[0] ?? 0.5) * tw, town.y + (A.at?.[1] ?? 0.5) * td];
  X.townCentre = [town.x + tw / 2, town.y + td / 2];
  X.mFacing = AR.face(X);
  const [MW, MD] = M.size;
  X.square = null;
  X.mRect = AR.seat ? AR.seat(X) : rectFor(X.ax, X.ay, MW, MD, X.mFacing);
  const { mRect, mFacing, square } = X;
  X.front = toward(mFacing); X.apron = M.apron ?? 0;
  const PR = X.PR = A.precinct || {}, margin = PR.margin ?? 0;
  // the precinct: the monument with its margin, the apron before it, `back` more behind
  const precinct = X.precinct = square ? { ...square } : grow(mRect, margin);
  if (!square) {
    const ext = (side, m) => { if (side === 'n') { precinct.y -= m; precinct.d += m; } else if (side === 's') precinct.d += m; else if (side === 'w') { precinct.x -= m; precinct.w += m; } else precinct.w += m; };
    ext(mFacing, X.apron); ext(opposite(mFacing), PR.back ?? 0);
  }
  const site = X.site = heightOf(F.site, X.water, town, { rockRect: AR.rock && F.site.rock ? precinct : null, rng: stream(seed, 'site') });
  X.hAt = site.hAt;
  // a canal is dug in the low ground: it never climbs a bluff or a plateau
  if (X.water.kind === 'canal' && (F.site.relief ?? 0) > 0) { const dug = X.water.isWater; X.water.isWater = (x, y) => dug(x, y) && site.base(x, y) < 0.5; }
  [X.mcx, X.mcy] = centre(mRect); X.terrace = PR.terrace ?? 0; X.mZ = X.hAt(X.mcx, X.mcy) + X.terrace;
}

/** The precinct claimed, the monument laid in it, its walls and gate, the approach (an avenue, a way, a climb). */
export function layArmature(X) {
  const { A, AR, M, P, K, PR, F, precinct, mRect, mFacing, square, terrace, hAt, mcx, mcy, mZ, slots, builds, boxes, water, townCentre, front, approach, claimRect, rectCells, strip } = X;
  claimRect(precinct, C.PRECINCT, (v) => v !== C.WATER || AR.overWater);
  const laid = M.lay({ palette: P, culture: K });
  for (const s of laid.slots || []) slots.push({ ...s, rect: orientBox(s.rect, mRect, mFacing), facing: turnFacing(s.facing, mFacing), z: mZ + (s.z ?? 0), monument: A.monument });
  for (const b of laid.builds || []) builds.push({ ...b, rect: orientBox(b.rect, mRect, mFacing), facing: turnFacing(b.facing, mFacing), z: mZ, monument: A.monument });
  X.monuments.push({ id: A.monument, rect: mRect, facing: mFacing, z: r2(mZ), main: true });
  // the precinct's front edge, its gate there (or on the way's side), its walls
  const AP = X.AP = A.approach || {};
  const toTown = sideToward([mcx, mcy], townCentre);
  const waySide = AP.way && AR.aside ? toTown === mFacing || toTown === opposite(mFacing) ? turnFacing('e', mFacing) : toTown : null;
  const gateSide = X.gateSide = waySide ?? mFacing, gate = X.gate = frontEdge(precinct, gateSide);
  if (!square && (PR.wall || PR.thickness)) wallPrecinct(X);
  if (terrace > 0 && !square) boxes.push({ kind: 'terrace', ...precinct, z0: hAt(mcx, mcy), z1: hAt(mcx, mcy) + terrace, tint: P.platform ?? P.wall ?? P.ground });

  if (AR.avenue && AP.width) {
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
    const climbStop = (x, y) => { if (water.isWater(x, y)) return true; if (X.inTown(x, y)) inside += CELL / 2; return inside > 40; };
    const w = strip(gate, gateSide, AP.way, { stop: AR.climb ? climbStop : (x, y) => water.isWater(x, y) || !X.inTown(x, y), over: [C.EMPTY, C.OPEN, C.OUTSIDE] });
    approach.way = { ...w, side: gateSide };
    if (AP.flank && AR.flankWay) {
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
}

/** The precinct's walls, open at its front or gated on its gate's side. */
function wallPrecinct(X) {
  const { PR, AP, AR, P, precinct, mFacing, gateSide, slots, boxes, hAt } = X;
  const t = PR.thickness ?? 2, h = PR.height, gw = Math.max(AP.width ?? 0, 10) + 2 * (AP.flankDepth ?? 0);
  for (const side of ['n', 'e', 's', 'w']) {
    const along = side === 'n' || side === 's', len = along ? precinct.w : precinct.d;
    const x0 = side === 'e' ? precinct.x + precinct.w - t : precinct.x, y0 = side === 's' ? precinct.y + precinct.d - t : precinct.y;
    const open = side === mFacing && (AR.openFront || !PR.gate) ? gw : side === gateSide && PR.gate ? 0 : side === gateSide ? 8 : 0;
    const gateHere = side === gateSide && PR.gate;
    const gap = gateHere ? localSize({ w: 14, d: 9 }, 'n').W : open;
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

/** The town's reach and the ground no one can build on: the water, outside the town, too steep. */
export function claimSite(X) {
  const { F, water, site, hAt, townCentre, tw, td, cols, rows, mid, set, seed } = X;
  const ext = X.ext = F.enclosure.extent ?? [0.9, 0.9], L = stream(seed, 'layout');
  const wob = X.ENC.wobble ? [0, 1, 2].map(() => ({ a: 0.03 + L() * 0.04, f: 2 + Math.floor(L() * 3), p: L() * 6.283 })) : [];
  const band = F.hinterland?.band ?? 0;
  const relief = F.site.relief ?? 0;
  const inTown = X.inTown = (x, y) => {
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
  const steepCells = X.steepCells = new Uint8Array(cols * rows);   // open because no one can build there, not because it is a street
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const [x, y] = mid(c, r);
    if (water.isWater(x, y)) set(c, r, C.WATER);
    else if (!inTown(x, y)) set(c, r, C.OUTSIDE);
    else if (steep(x, y)) { set(c, r, C.OPEN); steepCells[r * cols + c] = 1; }
  }
}
