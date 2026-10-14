/**
 * historic/solver/placement — what stands by meaning or need, and where: the form's `placement` list, each item laid
 * by the rule its `where` names. WHERE is keyed by that word; each rule says WHEN it is laid (`before` the streets, on
 * ground it claims; `after` them, along them or round the town; on the `lots`, replacing a house) and lays one item.
 * The form's schema reads its words (and what each means) from here.
 */
import { CELL, C, stream } from '../layout-kit.js';
import { orientBox } from '../assets/kit.js';
import { MONUMENTS } from '../monuments/index.js';
import { toward, turnFacing, opposite } from './site.js';
import { r2, centre, grow, meets, rectFor, sideToward, frontEdge, envelopeMid } from './context.js';

/** The placement rules, by `where`: `read` what the guide says, `when` the solver's moment, `lay(X, it, at)` the item. */
export const WHERE = Object.freeze({
  crossing: { read: 'where three or four streets meet, spread through the town', when: 'after', lay: crossing },
  'main-street': { read: 'on the lots that front a main street (the asset replaces the house)', when: 'lots', lay: (X, it) => replaceHouses(X, it, false) },
  'near-monument': { read: 'on the large lots nearest the precinct (the asset replaces the house)', when: 'lots', lay: (X, it) => replaceHouses(X, it, true) },
  'wall-strip': { read: 'in the open strip inside the wall, on one stretch of it', when: 'after', lay: wallStrip },
  'precinct-gate': { read: 'either side of the precinct gate', when: 'before', lay: precinctGate },
  'monument-front': { read: 'before the monument, on its axis', when: 'before', lay: monumentFront },
  precinct: { read: 'inside the precinct, beside the monument', when: 'before', lay: inPrecinct },
  'square-edge': { read: 'round the forum square, facing it', when: 'before', lay: squareEdge },
  approach: { read: 'lining the approach to the monument', when: 'after', lay: alongApproach },
  water: { read: 'afloat on the water', when: 'after', lay: afloat },
  bank: { read: 'on the bank of the water, outside the town', when: 'after', lay: onBank },
  'town-edge': { read: 'just outside the town, round its edge', when: 'after', lay: townEdge },
});

/** The items a form places that its kit (or the monument library) has; the rest noted and left out. */
export function placementItems(X) {
  const { F, kit, notes } = X;
  X.items = (F.placement || []).filter((it) => it.monument ? MONUMENTS[it.monument] : kit[it.asset]);
  for (const it of F.placement || []) if (!(it.monument ? MONUMENTS[it.monument] : kit[it.asset])) notes.push(`placement '${it.asset ?? it.monument}' has no asset in the kit: left out`);
  X.frontOffset = 0;
}

/** Lay every item whose rule is laid at `when`, in the form's order. */
export function layPlacement(X, when) {
  for (const it of X.items) {
    const rule = WHERE[it.where];
    if (rule?.when === when) rule.lay(X, it, { size: sizeOf(X, it), n: it.max ?? 1, every: it.every ?? 0 });
  }
}

const sizeOf = (X, it) => (it.monument ? MONUMENTS[it.monument].size : it.size ?? envelopeMid(X.kit[it.asset]));
const PL = (X, it) => stream(X.seed, `place|${it.asset ?? it.monument}`);

/** Put one item: an asset in a slot, or a monument seated and laid at the rect's middle. */
function put(X, it, rect, facing, extra = {}) {
  const { slots, builds, placed, hAt, P, K, claimRect } = X;
  if (it.monument) {
    const m = MONUMENTS[it.monument], f = facing, mr = rectFor(...centre(rect), m.size[0], m.size[1], f), z = hAt(...centre(mr));
    const lay2 = m.lay({ palette: P, culture: K });
    for (const s of lay2.slots || []) slots.push({ ...s, rect: orientBox(s.rect, mr, f), facing: turnFacing(s.facing, f), z: z + (s.z ?? 0), monument: it.monument });
    for (const b of lay2.builds || []) builds.push({ ...b, rect: orientBox(b.rect, mr, f), facing: turnFacing(b.facing, f), z, monument: it.monument });
    X.monuments.push({ id: it.monument, rect: mr, facing: f, z: r2(z) });
    claimRect(mr, C.HOUSE, (v) => v !== C.WATER);
    placed.push({ ...it, rect: mr });
    return;
  }
  slots.push({ asset: it.asset, rect, facing, z: extra.z ?? hAt(...centre(rect)), ...extra });
  placed.push({ ...it, rect });
}

function apronRect(X) { const { mRect, mFacing, front, apron } = X, [fx, fy] = frontEdge(mRect, mFacing); return rectFor(fx + front[0] * apron / 2, fy + front[1] * apron / 2, (mFacing === 'n' || mFacing === 's' ? mRect.w : mRect.d), apron, mFacing); }

// ── before the streets ──

function inPrecinct(X, it, { size: [w, d], n }) {
  // beside the monument, behind it, at its sides: the first free spot, facing the monument
  const { precinct, mcx, mcy, mRect, notes, hAt, terrace, free, claimRect } = X;
  const inside = (v) => v === C.PRECINCT;
  const cands = [];
  for (let y = precinct.y + 3; y + d < precinct.y + precinct.d - 3; y += CELL) for (let x = precinct.x + 3; x + w < precinct.x + precinct.w - 3; x += CELL) cands.push({ x, y, w, d });
  cands.sort((a, b) => Math.hypot(...centre(a).map((v, i) => v - [mcx, mcy][i])) - Math.hypot(...centre(b).map((v, i) => v - [mcx, mcy][i])));
  for (let k = 0; k < n; k++) {
    const r = cands.find((q) => !meets(grow(q, 2), mRect) && !meets(q, apronRect(X)) && free(q, inside));
    if (!r) { notes.push(`no room in the precinct for '${it.asset ?? it.monument}'`); break; }
    put(X, it, r, sideToward(centre(r), [mcx, mcy]), { z: hAt(...centre(r)) + terrace });
    claimRect(grow(r, 1), C.HOUSE, inside);
  }
}

function monumentFront(X, it, { size: [w, d] }) {
  const { mRect, mFacing, front, hAt, terrace } = X;
  const gap = 1.5, off = X.frontOffset + gap + d / 2, [fx, fy] = frontEdge(mRect, mFacing);
  const r = rectFor(fx + front[0] * off, fy + front[1] * off, w, d, mFacing);
  X.frontOffset += d + gap;
  put(X, it, r, mFacing, { z: hAt(...centre(r)) + terrace });
}

function precinctGate(X, it, { size: [w, d] }) {
  const { gate: [gx2, gy2], gateSide, hAt, terrace } = X, along = gateSide === 'n' || gateSide === 's', back = toward(opposite(gateSide));
  for (const o of [-1, 1]) {
    const cx = gx2 + (along ? o * (9 + w / 2) : 0) + back[0] * (d / 2 + 2), cy = gy2 + (along ? 0 : o * (9 + w / 2)) + back[1] * (d / 2 + 2);
    put(X, it, rectFor(cx, cy, w, d, gateSide), gateSide, { z: hAt(cx, cy) + terrace });
  }
}

function squareEdge(X, it, { size: [w, d], n, every }) {
  const { square, free, claimRect } = X;
  if (!square) return;
  const long = square.d >= square.w, sideLen = long ? square.d : square.w;
  if (w >= sideLen * 0.6) {
    // a portico along each long side, just inside the square
    for (const o of [-1, 1].slice(0, n)) {
      const r = long ? { x: o < 0 ? square.x : square.x + square.w - d, y: square.y + (square.d - Math.min(w, square.d)) / 2, w: d, d: Math.min(w, square.d) } : { x: square.x + (square.w - Math.min(w, square.w)) / 2, y: o < 0 ? square.y : square.y + square.d - d, w: Math.min(w, square.w), d };
      put(X, it, r, long ? (o < 0 ? 'e' : 'w') : (o < 0 ? 's' : 'n'));
    }
    return;
  }
  if (w <= 4) {
    // statues and bases in a row along a long side, inside the square
    const step = Math.max(every || 8, w + 2);
    for (let k = 0; k < n; k++) {
      const s = (k + 1) * step; if (s > sideLen - 8) break;
      const r = long ? { x: square.x + 7, y: square.y + square.d - s, w: d, d: w } : { x: square.x + s, y: square.y + square.d - 7 - d, w, d };
      put(X, it, r, long ? 'e' : 'n', {});
    }
    return;
  }
  // a building outside a long side, facing the square: down each side in turn
  let k = 0;
  for (const o of [1, -1]) for (let s = 10; s + w < sideLen && k < n; s += 6) {
    const r = long ? { x: o < 0 ? square.x - d - 2 : square.x + square.w + 2, y: square.y + s, w: d, d: w } : { x: square.x + s, y: o < 0 ? square.y - d - 2 : square.y + square.d + 2, w, d };
    if (!free(r, (v) => v === C.EMPTY || v === C.OPEN)) continue;
    put(X, it, r, long ? (o < 0 ? 'e' : 'w') : (o < 0 ? 's' : 'n')); claimRect(r, C.HOUSE); k++; s += w;
  }
}

// ── after the streets ──

function alongApproach(X, it, { size: [w, d], n, every }) {
  const { approach, mFacing, mRect, notes, free, claimRect } = X;
  const way = approach.way ?? approach.avenue;
  if (!way) return;
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
      if (free(r, ok) && !meets(r, grow(mRect, 4))) { put(X, it, r, f); done = true; }
    }
    if (!done) notes.push(`no room beside the approach for '${it.monument}'`);
    return;
  }
  let k = 0;
  for (let s = step; s < len && k < n; s += step) for (const o of [-1, 1]) {
    if (k >= n) break;
    const r = horiz ? { x: way.x + s, y: o < 0 ? way.y - d - 0.4 : way.y + way.d + 0.4, w, d } : { x: o < 0 ? way.x - w - 0.4 : way.x + way.w + 0.4, y: way.y + s, w, d };
    if (!free(r, (v) => v === C.EMPTY || v === C.OPEN || v === C.OUTSIDE)) continue;
    put(X, it, r, horiz ? (o < 0 ? 's' : 'n') : (o < 0 ? 'e' : 'w')); claimRect(r, C.OPEN); k++;
  }
}

function crossing(X, it, { size: [w, d], n, every }) {
  const { rows, cols, at, mid } = X, rng = PL(X, it), done = [];
  const isLane = (c, r) => at(c, r) === C.LANE;
  for (let r = 1; r < rows - 1 && done.length < n; r++) for (let c = 1; c < cols - 1 && done.length < n; c++) {
    if (!isLane(c, r) || isLane(c - 1, r) + isLane(c + 1, r) + isLane(c, r - 1) + isLane(c, r + 1) < 3) continue;
    const p = mid(c, r);
    if (done.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > (every || 50)) && rng() < 0.5) { done.push(p); put(X, it, rectFor(p[0], p[1], w, d, 's'), 's'); }
  }
}

function wallStrip(X, it, { size: [w, d], n }) {
  const { ENC, rows, cols, townCentre, free, claimRect } = X;
  if (!ENC.strip) return;
  const quarter = PL(X, it)() * 6.283, got = [];
  for (let r = 0; r < rows && got.length < n; r++) for (let c = 0; c < cols && got.length < n; c++) {
    const rect = { x: c * CELL, y: r * CELL, w, d };
    if (!free(rect, (v) => v === C.OPEN)) continue;
    const th = Math.atan2(r * CELL - townCentre[1], c * CELL - townCentre[0]), dth = Math.abs(((th - quarter + 9.42) % 6.283) - 3.14);
    if (dth < 0.4 && got.every((q) => Math.hypot(q[0] - rect.x, q[1] - rect.y) > 9)) { got.push([rect.x, rect.y]); put(X, it, rect, sideToward(townCentre, centre(rect)) === 'n' ? 's' : 'n'); claimRect(rect, C.HOUSE); }
  }
}

function afloat(X, it, { size: [w, d], n, every }) {
  const { water, town, tw, td, frame, placed, slots, F, AP } = X;
  if (water.kind === 'none') return;
  const rng = PL(X, it);
  let k = 0;
  for (let tries = 0; tries < 400 && k < n; tries++) {
    const x = town.x - 40 + rng() * (tw + 80), y = town.y - 40 + rng() * (td + 80), horiz = water.kind === 'canal' || water.side === 'n' || water.side === 's';
    const r = rectFor(x, y, w, d, horiz ? 'n' : 'e');
    if (![[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.d], [r.x + r.w, r.y + r.d]].every(([px, py]) => water.isWater(px, py) && px > 0 && py > 0 && px < frame.w && py < frame.d)) continue;
    if (placed.some((q) => q.rect && meets(grow(q.rect, every ? every / 3 : 3), r)) || slots.some((s) => (s.asset === F.water.bridge || s.asset === AP.quay) && meets(grow(s.rect, 4), r))) continue;
    put(X, it, r, horiz ? (rng() < 0.5 ? 'n' : 's') : (rng() < 0.5 ? 'e' : 'w'), { z: water.z + 0.05 }); k++;
  }
}

function onBank(X, it, { size: [w, d], n, every }) {
  // on dry ground outside the town, its back to the land and its front to the water
  const { water, frame, placed, cellOf, at, free, claimRect } = X;
  if (water.kind === 'none') return;
  const rng = PL(X, it);
  let k = 0;
  for (let tries = 0; tries < 600 && k < n; tries++) {
    const x = rng() * frame.w, y = rng() * frame.d;
    const [c, r] = cellOf(x, y);
    if (at(c, r) !== C.OUTSIDE) continue;
    // the nearest water within a few metres
    let side = null; for (const sd of ['n', 's', 'e', 'w']) { const [dx, dy] = toward(sd); if (water.isWater(x + dx * (d / 2 + 4), y + dy * (d / 2 + 4))) { side = sd; break; } }
    if (!side) continue;
    const rect = rectFor(x, y, w, d, side);
    if (!free(rect, (v) => v === C.OUTSIDE) || placed.some((q) => q.rect && meets(grow(q.rect, every ? every / 2 : 2), rect))) continue;
    put(X, it, rect, side); claimRect(rect, C.REED); k++;
  }
}

function townEdge(X, it, { size: [w, d], n, every }) {
  const { frame, hAt, water, cellOf, at, placed, townCentre, free, claimRect } = X, rng = PL(X, it);
  let k = 0;
  const cands = [];
  for (let y = 0; y + d < frame.d; y += CELL * 2) for (let x = 0; x + w < frame.w; x += CELL * 2) {
    const r = { x, y, w, d }; if (!free(r, (v) => v === C.OUTSIDE)) continue;
    const zs = [[r.x, r.y], [r.x + w, r.y], [r.x, r.y + d], [r.x + w, r.y + d]].map((p) => hAt(...p)); if (Math.max(...zs) - Math.min(...zs) > 1.5 || Math.min(...zs) < 0.2 && water.kind === 'sea') continue;
    let near = Infinity; for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) for (let s = 1; s < 12; s++) { const [c, rr] = cellOf(x + w / 2 + dx * (w / 2 + s * CELL), y + d / 2 + dy * (d / 2 + s * CELL)); const v = at(c, rr); if (v !== C.OUTSIDE && v !== -1 && v !== C.WATER && v !== C.FIELD && v !== C.REED) { near = Math.min(near, s); break; } }
    if (near < 12) cands.push({ r, near: near + rng() * 3 });
  }
  cands.sort((a, b) => a.near - b.near);
  for (const { r } of cands) { if (k >= n) break; if (!free(r, (v) => v === C.OUTSIDE) || placed.some((q) => q.rect && meets(grow(q.rect, every ? every / 2 : 4), r))) continue; put(X, it, r, sideToward(centre(r), townCentre)); claimRect(r, C.HOUSE); k++; }
}

// ── on the lots ──

/** The large lots nearest the precinct, or those on the main streets, given over to the item. */
function replaceHouses(X, it, nearMonument) {
  const { slots, houseAssets, mcx, mcy } = X;
  const cands = slots.filter((q) => houseAssets.has(q.asset));
  const dist = (q) => Math.hypot(centre(q.rect)[0] - mcx, centre(q.rect)[1] - mcy);
  const pickd = nearMonument ? cands.sort((a, b) => b.rect.w * b.rect.d - a.rect.w * a.rect.d).slice(0, 12).sort((a, b) => dist(a) - dist(b)) : cands;
  pickd.slice(0, it.max ?? 1).forEach((q) => { q.asset = it.asset; });
}
