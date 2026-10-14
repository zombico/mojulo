/**
 * historic/solver/enclosure — what closes the town: nothing, a ring wall with towers and gates, walled wards.
 * ENCLOSURES is keyed by the form's `enclosure.kind`; the form's schema reads its words from here.
 */
import { CELL, C, stream, runs } from '../layout-kit.js';
import { toward, opposite } from './site.js';
import { centre, grow, sideToward } from './context.js';

/**
 * The enclosures, by `enclosure.kind`. `lay(X)` builds it before the streets; the rest are what the kind brings:
 *   wobble   the town's edge wobbles, as a wall laid round it does
 *   plans    the enclosure is the street plan: a grid is not laid over it, its alleys run at half a block
 *   strip    the open strip inside the wall takes `wall-strip` placements
 *   foci(E)  the slices of life it offers
 */
export const ENCLOSURES = Object.freeze({
  none: { read: 'no wall', lay: () => {}, foci: () => [] },
  ring: { read: 'a ring wall round the town, with towers and gates', lay: ringWall, wobble: true, strip: true, foci: (E) => ((E.gates ?? 4) > 0 ? ['gate'] : []) },
  wards: { read: 'walled wards, a gate each, one the market', lay: wards, plans: true, foci: (E) => (E.market ? ['market'] : []) },
});

function ringWall(X) {
  const { F, cols, rows, at, set, grid, slots, gates, townCentre, hAt, seed } = X;
  const E = F.enclosure, WL = F.walls || {};
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
  for (const [gc, gr] of gates) for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) if (at(gc + dc, gr + dr) === C.WALL) set(gc + dc, gr + dr, C.OPEN);
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

/** The wards: walled blocks with streets between them, a gate each, one the market (laid before the streets: they are the plan). */
function wards(X) {
  const { F, town, tw, td, ax, townCentre, slots, approach, hAt, seed, mid, set, cellOf, rectCells, claimRect, lane } = X;
  const E = F.enclosure, WL = F.walls || {};
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
