/**
 * nav — PATHFINDING for minds on the ground: a walk grid baked from the world's colliders, A* over it, and a string
 * pull so a mind walks corner to corner instead of cell to cell.
 *
 * The grid is lazy and cached on the world, one per (body radius, z band), and rebuilt when the collider set changes
 * (breakables splice it at runtime). A box blocks a cell when it overlaps the cell's centre circle inflated by the body
 * radius and its z band meets the body's (the same gate as core.js resolveBlocking: a body walks under a raised slab
 * and over a box it stands on). One floor at the body's height: stairs, multi-level floors and space are out of scope.
 *
 *   navPath(world, from, to, opts) → [[x, y], ...] corners after `from` ending at `to`, [] when the line is clear, or
 *                                    null when no path exists (opts: { radius, height, footZ, step, cell })
 *   navClear(world, from, to, opts) → true when the grid line between the two points is walkable
 *
 * BUILDER CONTRACT (compose.js): import-free; deterministic (ties broken by cell index, no dice).
 */

export function buildNav(E) {
  const MAX_CELLS = 250000;

  // a cheap fingerprint of the collider set: count plus the sum of every coordinate
  function collidersKey(cs) {
    if (!cs || !cs.length) return '0';
    let s = 0;
    for (let k = 0; k < cs.length; k++) { const c = cs[k]; if (c && c.min && c.max) s += c.min[0] + c.min[1] + c.min[2] + 3 * (c.max[0] + c.max[1] + c.max[2]); }
    return cs.length + ':' + s.toFixed(3);
  }

  function bakeGrid(world, o) {
    const cs = world.colliders || [];
    const pad = o.radius + o.cell * 4;
    let x0 = Math.min(o.from[0], o.to[0]) - pad, y0 = Math.min(o.from[1], o.to[1]) - pad;
    let x1 = Math.max(o.from[0], o.to[0]) + pad, y1 = Math.max(o.from[1], o.to[1]) + pad;
    for (const c of cs) { if (!c || !c.min || !c.max) continue; x0 = Math.min(x0, c.min[0] - pad); y0 = Math.min(y0, c.min[1] - pad); x1 = Math.max(x1, c.max[0] + pad); y1 = Math.max(y1, c.max[1] + pad); }
    let cell = o.cell;
    while (Math.ceil((x1 - x0) / cell) * Math.ceil((y1 - y0) / cell) > MAX_CELLS) cell *= 1.5;
    const nx = Math.ceil((x1 - x0) / cell), ny = Math.ceil((y1 - y0) / cell);
    const block = new Uint8Array(nx * ny);
    const r = o.radius;
    for (const c of cs) {
      if (!c || !c.min || !c.max) continue;
      if (o.footZ >= c.max[2] - o.step) continue;        // stands on it
      if (o.footZ + o.height <= c.min[2]) continue;      // walks under it
      const i0 = Math.max(0, Math.floor((c.min[0] - r - x0) / cell)), i1 = Math.min(nx - 1, Math.floor((c.max[0] + r - x0) / cell));
      const j0 = Math.max(0, Math.floor((c.min[1] - r - y0) / cell)), j1 = Math.min(ny - 1, Math.floor((c.max[1] + r - y0) / cell));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const cx = x0 + (i + 0.5) * cell, cy = y0 + (j + 0.5) * cell;
          const qx = cx < c.min[0] ? c.min[0] : cx > c.max[0] ? c.max[0] : cx;
          const qy = cy < c.min[1] ? c.min[1] : cy > c.max[1] ? c.max[1] : cy;
          if ((cx - qx) * (cx - qx) + (cy - qy) * (cy - qy) < r * r) block[j * nx + i] = 1;
        }
      }
    }
    return { x0, y0, cell, nx, ny, block };
  }

  function gridOf(world, o) {
    const key = collidersKey(world.colliders) + '|' + o.radius + '|' + o.height + '|' + Math.round(o.footZ * 10) + '|' + o.cell;
    const cache = world.navCache || (world.navCache = {});
    let g = cache[key];
    const inside = (g2, p) => p[0] >= g2.x0 && p[1] >= g2.y0 && p[0] < g2.x0 + g2.nx * g2.cell && p[1] < g2.y0 + g2.ny * g2.cell;
    if (!g || !inside(g, o.from) || !inside(g, o.to)) {
      for (const k in cache) if (k.split('|')[0] !== key.split('|')[0]) delete cache[k];   // the colliders moved on
      g = cache[key] = bakeGrid(world, o);
    }
    return g;
  }

  const cellIdx = (g, p) => {
    const i = Math.min(g.nx - 1, Math.max(0, Math.floor((p[0] - g.x0) / g.cell)));
    const j = Math.min(g.ny - 1, Math.max(0, Math.floor((p[1] - g.y0) / g.cell)));
    return j * g.nx + i;
  };
  const centre = (g, idx) => [g.x0 + ((idx % g.nx) + 0.5) * g.cell, g.y0 + (Math.floor(idx / g.nx) + 0.5) * g.cell];

  // the nearest open cell to a blocked one (a goal inside an inflated wall, or a body pressed against one)
  function nearestOpen(g, idx) {
    if (!g.block[idx]) return idx;
    const i0 = idx % g.nx, j0 = Math.floor(idx / g.nx);
    for (let rad = 1; rad < 12; rad++) {
      let best = -1, bd = Infinity;
      for (let j = j0 - rad; j <= j0 + rad; j++) {
        for (let i = i0 - rad; i <= i0 + rad; i++) {
          if (i < 0 || j < 0 || i >= g.nx || j >= g.ny) continue;
          if (Math.max(Math.abs(i - i0), Math.abs(j - j0)) !== rad) continue;
          const k = j * g.nx + i;
          if (g.block[k]) continue;
          const d = (i - i0) * (i - i0) + (j - j0) * (j - j0);
          if (d < bd || (d === bd && k < best)) { bd = d; best = k; }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  // line of sight on the grid: sample the segment between two cell centres every quarter cell; every cell a sample
  // lands in must be open (the grid is already inflated by the body radius, so this is a swept-body test)
  function lineOpen(g, a, b) {
    const p = centre(g, a), q = centre(g, b);
    const n = Math.max(1, Math.ceil((Math.hypot(q[0] - p[0], q[1] - p[1]) / g.cell) * 4));
    for (let k = 0; k <= n; k++) {
      const x = p[0] + ((q[0] - p[0]) * k) / n, y = p[1] + ((q[1] - p[1]) * k) / n;
      if (g.block[cellIdx(g, [x, y])]) return false;
    }
    return true;
  }

  // A*: 8-connected, no corner cutting, octile heuristic, a binary heap ordered by (f, index)
  function aStar(g, s, t) {
    const n = g.nx * g.ny, G = new Float64Array(n).fill(Infinity), from = new Int32Array(n).fill(-1), closed = new Uint8Array(n);
    const heap = [];
    const less = (a, b) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
    const push = (x) => { heap.push(x); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (!less(heap[k], heap[p])) break; [heap[k], heap[p]] = [heap[p], heap[k]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && less(heap[l], heap[m])) m = l; if (r < heap.length && less(heap[r], heap[m])) m = r; if (m === k) break; [heap[k], heap[m]] = [heap[m], heap[k]]; k = m; } } return top; };
    const ti = t % g.nx, tj = Math.floor(t / g.nx);
    const h = (k) => { const dx = Math.abs(k % g.nx - ti), dy = Math.abs(Math.floor(k / g.nx) - tj); return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy); };
    G[s] = 0; push([h(s), s]);
    while (heap.length) {
      const [, k] = pop();
      if (closed[k]) continue;
      if (k === t) break;
      closed[k] = 1;
      const i = k % g.nx, j = Math.floor(k / g.nx);
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = i + di, nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= g.nx || nj >= g.ny) continue;
          const nk = nj * g.nx + ni;
          if (g.block[nk] || closed[nk]) continue;
          if (di && dj && (g.block[j * g.nx + ni] || g.block[nj * g.nx + i])) continue;   // no corner cutting
          const ng = G[k] + (di && dj ? Math.SQRT2 : 1);
          if (ng < G[nk]) { G[nk] = ng; from[nk] = k; push([ng + h(nk), nk]); }
        }
      }
    }
    if (G[t] === Infinity) return null;
    const cells = [];
    for (let k = t; k !== -1; k = from[k]) cells.push(k);
    return cells.reverse();
  }

  function optsOf(world, from, to, opts) {
    const radius = Math.max(0.01, (opts && opts.radius) || 0.5);
    return {
      from, to, radius,
      height: (opts && opts.height) ?? 24,
      footZ: (opts && opts.footZ) ?? 0,
      step: (opts && opts.step) ?? 0.35,
      cell: (opts && opts.cell) || world.navCell || Math.max(1, radius),
    };
  }

  function navClear(world, from, to, opts) {
    if (!world || !world.colliders || !world.colliders.length) return true;
    const o = optsOf(world, from, to, opts), g = gridOf(world, o), own = cellIdx(g, from), s = nearestOpen(g, own);
    // a walker pressed into a blocked cell (against a wall's end) is not clear: it steps out to the open cell first
    return s === own && lineOpen(g, s, cellIdx(g, to));
  }

  function navPath(world, from, to, opts) {
    if (!world || !world.colliders || !world.colliders.length) return [];
    const o = optsOf(world, from, to, opts), g = gridOf(world, o);
    const own = cellIdx(g, from), s = nearestOpen(g, own), t = nearestOpen(g, cellIdx(g, to));
    if (s < 0 || t < 0) return null;
    // from a blocked cell, the open one it steps out to comes first
    const out = s === own ? [] : [centre(g, s)];
    if (lineOpen(g, s, t)) return out.length ? [...out, [to[0], to[1]]] : [];
    const cells = aStar(g, s, t);
    if (!cells) return null;
    // string pull: from each kept corner, skip ahead to the farthest cell still in line of sight
    let a = 0;
    while (a < cells.length - 1) {
      let b = cells.length - 1;
      while (b > a + 1 && !lineOpen(g, cells[a], cells[b])) b--;
      out.push(b === cells.length - 1 ? [to[0], to[1]] : centre(g, cells[b]));
      a = b;
    }
    return out;
  }

  Object.assign(E, { navPath, navClear });
}
