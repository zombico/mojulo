/**
 * interior/place — the room as a placer sees it, and the moves pieces are placed by.
 *
 * The frame is the room's usable floor in millimetres: x east, y south (the plan's own axes), [0, W] × [0, D], N the
 * y = 0 wall. Every wall has its own frame too, the way a decorator stands with their back to it: `u` runs along the
 * wall (left to right as they face the room), `v` runs into the room. A piece placed in a wall frame says which way its
 * front points; the four frames are rotations of one another, never mirrors, so left stays left.
 *
 * What a piece may not stand in (hard laws, interior/laws.js): the walls, another piece (a rug excepted: pieces stand on
 * it), the approach before a door, and the glass of a window when it is taller than the sill.
 */
import { law } from './laws.js';

export const EDGES = ['N', 'E', 'S', 'W'];
const INTO = { N: 'S', E: 'W', S: 'N', W: 'E' };         // the facing of a piece whose back is to the wall
const ALONG_PLUS = { N: 'E', E: 'S', S: 'W', W: 'N' };   // the facing toward +u
const ALONG_MINUS = { N: 'W', E: 'N', S: 'E', W: 'S' };  // toward −u
export const OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E' };

/** A wall's frame: its length, the room's depth off it, and (u, v) → plan (x, y). */
export function wallFrame(R, edge) {
  const { W, D } = R;
  const at = {
    N: (u, v) => [u, v],
    E: (u, v) => [W - v, u],
    S: (u, v) => [W - u, D - v],
    W: (u, v) => [v, D - u],
  }[edge];
  const ns = edge === 'N' || edge === 'S';
  return {
    edge, len: ns ? W : D, depth: ns ? D : W, at,
    into: INTO[edge], toWall: edge, plusU: ALONG_PLUS[edge], minusU: ALONG_MINUS[edge],
    // an opening's span on this wall, in u
    span: (a, b) => (edge === 'N' || edge === 'E' ? [a, b] : [(ns ? W : D) - b, (ns ? W : D) - a]),
  };
}

/** A piece's plan rect: centre (x, y), w across its front, d front to back, facing a compass letter. */
export function footprint(x, y, w, d, facing) {
  const side = facing === 'N' || facing === 'S';
  const ex = side ? w : d, ey = side ? d : w;
  return { x0: x - ex / 2, x1: x + ex / 2, y0: y - ey / 2, y1: y + ey / 2 };
}
const overlap = (a, b, pad = 0) => Math.min(a.x1, b.x1) > Math.max(a.x0, b.x0) - pad && Math.min(a.y1, b.y1) > Math.max(a.y0, b.y0) - pad;
const EPS = 1;

/**
 * The room a placer works in, from its shell (interior/shell.js): W × D mm, its openings, and what they keep clear.
 * `keep` holds { rect, why, maxH? }: a floor piece may not enter a rect; a rect with `maxH` only refuses what is taller.
 */
export function makeRoom(shell) {
  const R = { W: shell.W, D: shell.D, H: shell.H, openings: shell.openings, features: shell.features || [], keep: [], placed: [] };
  const approach = law('door-approach').target;
  for (const op of shell.openings) {
    const F = wallFrame(R, op.wall);
    const [u0, u1] = F.span(op.a, op.b);
    if (op.kind === 'door') {
      // the doorway and its approach: the leaf's swing and a step through, kept clear of every standing piece
      const depth = Math.max(approach, u1 - u0);
      R.keep.push({ rect: rectInFrame(F, u0 - 100, u1 + 100, 0, depth), why: `the approach to door ${op.tag}`, door: op.tag });
    } else if (op.kind === 'window') {
      // tall storage and lamps stand clear of the glass; a seat or a table under a window is as decorators place them
      R.keep.push({ rect: rectInFrame(F, u0, u1, 0, 600), why: `the window ${op.tag}`, maxH: Math.max(op.sill - 50, 1100), window: op.tag });
    }
  }
  for (const f of R.features) R.keep.push({ rect: f.rect, why: `the ${f.type}`, feature: f.type, ...(f.keep ? { rect: f.keep } : {}) });
  return R;
}

/** A rect given in a wall's frame (u0..u1 along, v0..v1 into the room) → plan rect. */
export function rectInFrame(F, u0, u1, v0, v1) {
  const a = F.at(u0, v0), b = F.at(u1, v1);
  return { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y0: Math.min(a[1], b[1]), y1: Math.max(a[1], b[1]) };
}

/** Why a rect cannot be stood in, or null. `skin` (a rug) only stays inside the room; `ignore` names placed ids. */
export function whyNot(R, rect, { h = 0, skin = false, ignore = [] } = {}) {
  if (rect.x0 < -EPS || rect.y0 < -EPS || rect.x1 > R.W + EPS || rect.y1 > R.D + EPS) return 'it runs into a wall';
  if (skin) return null;
  for (const k of R.keep) {
    if (k.maxH != null && h <= k.maxH) continue;
    if (overlap(rect, k.rect)) return `it stands in ${k.why}`;
  }
  for (const p of R.placed) {
    if (p.mount === 'skin' || ignore.includes(p.id)) continue;
    if (overlap(rect, p.rect)) return `it collides with ${p.id}`;
  }
  return null;
}

/** Record a placed piece: { id, piece, x, y, w, d, h, facing, mount } → its rect. */
export function put(R, p) {
  const rect = footprint(p.x, p.y, p.w, p.d, p.facing);
  const placed = { ...p, rect };
  R.placed.push(placed);
  return placed;
}

/**
 * Stand a piece with its back to a wall: the first spot along it, from `target` (u, default the middle) outward in
 * steps, that nothing refuses. `gap` is how far its back stands off the wall. → { x, y, facing, u } or null with why.
 */
export function onWall(R, edge, { w, d, h }, { target = null, gap = 0, step = 50, avoid = [] } = {}) {
  const F = wallFrame(R, edge);
  if (w > F.len) return { why: `the ${edge} wall is ${Math.round(F.len)} mm, the piece ${Math.round(w)} mm` };
  const t = target == null ? F.len / 2 : target;
  const lo = w / 2, hi = F.len - w / 2;
  let last = null;
  for (let k = 0; k <= Math.ceil(F.len / step); k += 1) {
    for (const s of k ? [1, -1] : [1]) {
      const u = Math.min(hi, Math.max(lo, t + s * k * step));
      const [x, y] = F.at(u, gap + d / 2);
      const rect = footprint(x, y, w, d, F.into);
      const why = whyNot(R, rect, { h }) || (avoid.some((a) => overlap(rect, a)) ? 'it is in the way of the group' : null);
      if (!why) return { x, y, facing: F.into, u, edge };
      last = why;
    }
  }
  return { why: `nowhere on the ${edge} wall: ${last}` };
}

/** The stretches of a wall clear of openings, longest first: [{ u0, u1, len }]. */
export function solidSpans(R, edge) {
  const F = wallFrame(R, edge);
  const cuts = R.openings.filter((o) => o.wall === edge).map((o) => F.span(o.a, o.b)).sort((a, b) => a[0] - b[0]);
  const out = []; let c = 0;
  for (const [a, b] of cuts) { if (a - c > 1) out.push({ u0: c, u1: a, len: a - c }); c = Math.max(c, b); }
  if (F.len - c > 1) out.push({ u0: c, u1: F.len, len: F.len - c });
  return out.sort((p, q) => q.len - p.len);
}

/** The free floor's share of the room (rugs are floor), for the negative-space law. */
export function openShare(R) {
  const used = R.placed.filter((p) => p.mount !== 'skin').reduce((a, p) => a + (p.rect.x1 - p.rect.x0) * (p.rect.y1 - p.rect.y0), 0);
  return 1 - used / (R.W * R.D);
}

/**
 * The narrowest clear passage from the room's first door to each other door and to every seat, bed, desk and table, in
 * mm: a grid walk where each cell's clearance is twice its distance to the nearest standing piece or wall (rugs are
 * floor), and a path's width is its narrowest cell. A piece is reached at the cells against it, and the way to it does
 * not count the piece itself. → [{ from, to, kind: 'through' | 'to', clear }]
 */
export function passages(R, { cell = 100 } = {}) {
  const doors = R.openings.filter((o) => o.kind === 'door');
  if (!doors.length) return [];
  const nx = Math.max(1, Math.ceil(R.W / cell)), ny = Math.max(1, Math.ceil(R.D / cell));
  const standing = R.placed.filter((p) => p.mount !== 'skin');
  const clearMap = (skip = null) => {
    const clear = new Float64Array(nx * ny);
    for (let j = 0; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const x = (i + 0.5) * cell, y = (j + 0.5) * cell;
        let c = Math.max(0, Math.min(x, y, R.W - x, R.D - y)) * 2;
        for (const p of standing) {
          if (p === skip) continue;
          const r = p.rect;
          const dx = Math.max(r.x0 - x, 0, x - r.x1), dy = Math.max(r.y0 - y, 0, y - r.y1);
          c = Math.min(c, Math.hypot(dx, dy) * 2);
        }
        clear[j * nx + i] = c;
      }
    }
    return clear;
  };
  const cellOf = (x, y) => [clampI(Math.floor(x / cell), nx), clampI(Math.floor(y / cell), ny)];
  // a doorway's threshold: half a walkway into the room, where a passage of the full width could begin
  const pointOf = (o) => { const F = wallFrame(R, o.wall); const [u0, u1] = F.span(o.a, o.b); return cellOf(...F.at((u0 + u1) / 2, law('walkway').target / 2)); };
  // the widest-bottleneck path (maximin) from a start cell to every cell
  const widest = (start, clear) => {
    const best = new Float64Array(nx * ny).fill(-1);
    const s = start[1] * nx + start[0];
    best[s] = clear[s];
    const heap = maxHeap();
    heap.push(best[s], s);
    while (heap.size()) {
      const [b, k] = heap.pop();
      if (b < best[k]) continue;
      const i = k % nx, j = (k - i) / nx;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, c = j + dj;
        if (a < 0 || c < 0 || a >= nx || c >= ny) continue;
        const n = c * nx + a, v = Math.min(b, clear[n]);
        if (v > best[n]) { best[n] = v; heap.push(v, n); }
      }
    }
    return best;
  };
  const SEATS = new Set(['sofa', 'loveseat', 'lounge-chair', 'bed', 'desk', 'dining-table']);
  const goals = standing.filter((p) => SEATS.has(p.piece)).map((p) => {
    const r = p.rect, reach = 150, cells = [];
    for (let j = cellOf(0, r.y0 - reach)[1]; j <= cellOf(0, r.y1 + reach)[1]; j += 1) {
      for (let i = cellOf(r.x0 - reach, 0)[0]; i <= cellOf(r.x1 + reach, 0)[0]; i += 1) {
        const x = (i + 0.5) * cell, y = (j + 0.5) * cell;
        if (x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1) continue;
        cells.push([i, j]);
      }
    }
    return { p, cells };
  });
  const out = [];
  const start = pointOf(doors[0]);
  const best = widest(start, clearMap());
  for (const e of doors.slice(1)) { const c = pointOf(e); out.push({ from: doors[0].tag, to: e.tag, kind: 'through', clear: Math.round(best[c[1] * nx + c[0]]) }); }
  for (const g of goals) {
    const b = widest(start, clearMap(g.p));
    out.push({ from: doors[0].tag, to: g.p.id, kind: 'to', clear: Math.round(Math.max(0, ...g.cells.map((c) => b[c[1] * nx + c[0]]))) });
  }
  return out;
}

/** Why the room's ways are too narrow now, or null: a door to a door under the walkway's least, a door to a seat
 *  under the secondary path's. */
export function wayWhy(R) {
  const walk = law('walkway').min, side = law('secondary-path').min;
  for (const p of passages(R)) {
    if (p.clear < (p.kind === 'through' ? walk : side)) return `it would narrow the way from door ${p.from} to ${p.to} to ${p.clear} mm`;
  }
  return null;
}

const clampI = (i, n) => Math.max(0, Math.min(n - 1, i));
// a binary max-heap of [key, value]
function maxHeap() {
  const a = [];
  const up = (i) => { while (i) { const p = (i - 1) >> 1; if (a[p][0] >= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } };
  const down = (i) => {
    for (;;) {
      const l = 2 * i + 1, r = l + 1; let m = i;
      if (l < a.length && a[l][0] > a[m][0]) m = l;
      if (r < a.length && a[r][0] > a[m][0]) m = r;
      if (m === i) return;
      [a[m], a[i]] = [a[i], a[m]]; i = m;
    }
  };
  return {
    size: () => a.length,
    push: (k, v) => { a.push([k, v]); up(a.length - 1); },
    pop: () => { const top = a[0], last = a.pop(); if (a.length) { a[0] = last; down(0); } return top; },
  };
}
