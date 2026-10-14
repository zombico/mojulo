/**
 * historic/solver/emit — the plan made solid: every slot built by its kit, the activities by theirs, the monuments
 * built outside a kit; the terrain under it all, the lanes on it, the precinct's floor, the square; all moved into the
 * window's frame.
 */
import { CELL, C, stream, runs, laneZ, skinLoose } from '../layout-kit.js';
import { HISTORIC_CULTURES, landOf } from '../cultures/index.js';
import { FARM_CULTURES, WORKS_CULTURES } from '../land-kits.js';
import { placeAsset, orientBox, localSize } from '../assets/kit.js';
import { orientSolid } from '../assets/solids.js';
import { terrainMesh } from '../terrain.js';
import { scaleHex } from '../../polygonizer/vexar.js';
import { r2, centre, grow, meets } from './context.js';

const SURF = { mud: 'mud', rubble: 'rubble', brick: 'brick', flagstone: 'flagstone', 'dry-earth': 'dry-earth' };
/** How much an asset that can say more or less (an inventory building) says, by the scene: a slice is seen close. */
const RING = { slice: 'near', city: 'mid', region: 'far' };

/** Build what was laid, lay the ground, and move it all into the window. */
export function emitPlan(X) {
  const { slots, boxes, grounds, builds, notes, kit, borrowed, P, K, culture, seed, activities, win, views, water, site, hAt, view, F, S, square, AR, PR, precinct, mcx, mcy, terrace, approach, grid, cols, rows, surf, steepCells, mid } = X;
  const inWin = (r) => meets(r, grow(win, -0.05));   // what overlaps the window, not what only touches its edge

  // ── place: every slot by its kit; the activities by theirs; the monuments built outside a kit ──
  const keep = X.keep = slots.filter((s) => inWin(s.rect));
  keep.forEach((slot, i) => {
    const A2 = kit[slot.asset];
    if (!A2) { notes.push(`no asset '${slot.asset}' in the ${culture} kit`); return; }
    // a borrowed asset is built in its lender's colours: its builder reads the lender's palette as it was written
    const pal = borrowed[slot.asset] ? { ...P, ...HISTORIC_CULTURES[borrowed[slot.asset]].palette } : P;
    const out = placeAsset(A2, slot, { palette: pal, culture: K, rng: stream(seed, `asset|${slot.asset}|${i}`), ring: RING[view] });
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
  const H0 = X.H0 = (x, y) => hAt(x + win.x, y + win.y);
  const groundFill = X.groundFill = P.ground, sand = P.sand ?? scaleHex(P.ground, 1.08), rockFill = P.rock ?? P.platform ?? scaleHex(P.ground, 0.92);
  const waterFill = X.waterFill = P.water ?? P.sea ?? '#4f7f86';
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
  else if (!AR.bareFloor || PR.floor) {
    const t = PR.thickness ?? 0, fl = grow(precinct, -t);
    grounds.push({ kind: 'precinct-floor', ...fl, z: hAt(mcx, mcy) + terrace + 0.035, fill: P.precinctFloor ?? P.court ?? P.paving ?? P.ground, surface: PR.floor ?? 'dry-earth' });
  }
  if (approach.avenue) grounds.push({ kind: 'avenue', ...approach.avenue, z: hAt(...centre(approach.avenue)) + 0.05, fill: P.paving ?? P.street, surface: 'flagstone' });

  // ── into the window's frame ──
  const mv = (p) => [p[0] - win.x, p[1] - win.y, ...p.slice(2)];
  X.placedBoxes = boxes.filter((b) => inWin(b)).map((b) => shiftMass(b, -win.x, -win.y));
  X.placedGrounds = [...ground, ...grounds.filter((q) => (q.poly ? q.poly.some(([x, y]) => x > win.x && x < win.x + win.w && y > win.y && y < win.y + win.d) : inWin(q))).map((q) => (q.poly ? { ...q, poly: q.poly.map(mv) } : { ...q, x: q.x - win.x, y: q.y - win.y }))];
  for (const v of Object.values(views)) { v.eye = mv(v.eye); v.at = mv(v.at); }
  X.mvRect = (r) => (r ? { ...r, x: r2(r.x - win.x), y: r2(r.y - win.y) } : r);
  X.outSlots = keep.map((s) => ({ ...s, rect: X.mvRect(s.rect) }));
  X.reps = repeats.map((r) => ({ ...r, transforms: r.transforms.map((t) => ({ pos: mv(t.pos) })) }));
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
