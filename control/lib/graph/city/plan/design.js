/**
 * THE CITY, DESIGNED: a plan read off its card, laid layer by layer, pure. Each layer reads only the layers before it
 * and rolls only its own dice: a stream named for the layer (and, below the street grid, for the block), so a change
 * to one layer never rerolls the layers before it, and a change to one block's lots never rerolls another block.
 *
 *   1 site      the frame: the board in metres
 *   2 spine     the main streets, laid first
 *   3 districts what each part is for (a district laid by hand, else read off the height field)
 *   4 blocks    the street grid between the spine and the reserved ground; blocks are what the streets leave
 *   5 lots      each block's frontage cut into lots, a tower on a core corner; heights off the field
 *   6 sites     plazas, parks, landmarks, civic ground: reserved before the grid, built here
 *   7 transit   lines and their stops
 *   8 walk      the walk graph: crossings, block faces, lot doors, and what a walker meets along them
 *
 * Everything is in metres, x across the board (columns), y down it (rows), z up. Lengths a walker covers are scaled
 * by the plan's `play` (grammar.js); nothing here reads a clock, a locale or Math.random.
 */
import { exp, log, cos, pow, hypot } from '../../../util/dmath.js';
const sqrt = Math.sqrt;
import { readCityPlan, DISTRICT_USES } from './card.js';
import { grammarAtPlay } from './grammar.js';
import { resolveGrammar } from './grammars.js';
import { evaluateLaws } from './laws.js';
import { streamOf } from './dice.js';
import { citySegments } from './segments.js';

const r2 = (v) => Math.round(v * 100) / 100;
export { streamOf };
function gaussian(rng) { const u = Math.max(1e-9, rng()), v = rng(); return sqrt(-2 * log(u)) * cos(2 * Math.PI * v); }

// ── the raster: what ground is claimed ───────────────────────────────────────────────────────────────────────────────
export const CLAIM = Object.freeze({ FREE: 0, ROAD: 1, WALK: 2, SITE: 3, WATER: 4, PARK: 5 });
function raster(W, D) {
  const res = Math.max(2, Math.ceil(Math.max(W, D) / 700));
  const cols = Math.ceil(W / res), rows = Math.ceil(D / res), data = new Uint8Array(cols * rows);
  const at = (x, y) => { const i = Math.floor(x / res), j = Math.floor(y / res); return i < 0 || j < 0 || i >= cols || j >= rows ? -1 : j * cols + i; };
  return { res, cols, rows, data, at, get: (x, y) => { const k = at(x, y); return k < 0 ? -1 : data[k]; } };
}
function stampRect(R, x0, y0, x1, y1, code) {
  const i0 = Math.max(0, Math.floor(x0 / R.res)), i1 = Math.min(R.cols - 1, Math.ceil(x1 / R.res) - 1);
  const j0 = Math.max(0, Math.floor(y0 / R.res)), j1 = Math.min(R.rows - 1, Math.ceil(y1 / R.res) - 1);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) R.data[j * R.cols + i] = code;
}
const segDist = (px, py, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy, t = L2 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / L2)) : 0;
  return { d: hypot(px - a[0] - t * dx, py - a[1] - t * dy), t };
};
// a street's right-of-way onto the raster: its carriageway as ROAD, its walks as WALK (a road never yields to a walk)
function stampStreet(R, s) {
  const half = s.road / 2 + s.walk;
  for (let k = 1; k < s.pts.length; k++) {
    const a = s.pts[k - 1], b = s.pts[k];
    const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - half) / R.res)), i1 = Math.min(R.cols - 1, Math.ceil((Math.max(a[0], b[0]) + half) / R.res));
    const j0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) - half) / R.res)), j1 = Math.min(R.rows - 1, Math.ceil((Math.max(a[1], b[1]) + half) / R.res));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const { d } = segDist((i + 0.5) * R.res, (j + 0.5) * R.res, a, b), idx = j * R.cols + i;
      if (d <= s.road / 2) R.data[idx] = CLAIM.ROAD;
      else if (d <= half && R.data[idx] !== CLAIM.ROAD) R.data[idx] = CLAIM.WALK;
    }
  }
}

// ── layer 3: the height field and the districts ──────────────────────────────────────────────────────────────────────
function heightField(plan, G, W, D, cellRect) {
  const core = plan.districts.filter((d) => d.use === 'core'), mark = plan.sites.find((s) => s.use === 'landmark');
  let cx = W / 2, cy = D / 2;
  if (core.length) {
    let a = 0, sx = 0, sy = 0;
    for (const d of core) { const r = cellRect(d.cells), ar = (r.x1 - r.x0) * (r.y1 - r.y0); a += ar; sx += ar * (r.x0 + r.x1) / 2; sy += ar * (r.y0 + r.y1) / 2; }
    cx = sx / a; cy = sy / a;
  } else if (mark) { const r = cellRect(mark.cells); cx = (r.x0 + r.x1) / 2; cy = (r.y0 + r.y1) / 2; }
  else {
    // the spine's first crossing, else the middle
    const [s0, s1] = plan.spine;
    if (s0 && s1) { cx = (s1.path[0].c + 0.5) * plan.board.cell; cy = (s0.path[0].r - 0.5) * plan.board.cell; }
  }
  const lambda = Math.max(G.height.lambda[0], Math.min(G.height.lambda[1], G.height.lambdaFrac * Math.max(W, D)));
  return { cx: r2(cx), cy: r2(cy), lambda: r2(lambda), k: (x, y) => exp(-hypot(x - cx, y - cy) / lambda) };
}
const IMPLIED = (k) => (k > 0.6 ? 'core' : k > 0.22 ? 'commercial' : 'residential');

// ── layer 4: the street grid ─────────────────────────────────────────────────────────────────────────────────────────
// Grid lines are rolled between FIXED lines (the frame's edges, every straight run of the spine, every edge of reserved
// ground), so the grid always meets them; each gap is cut into the whole number of blocks its pitch allows, jittered,
// on the gap's own dice: a fixed line added or moved rerolls only the gaps either side of it.
function gridLines(fixed, pitch, rngOf, avenueEvery = 3) {
  const xs = [...new Set(fixed.map((v) => r2(v)))].sort((a, b) => a - b), out = [];
  const mean = (pitch[0] + pitch[1]) / 2;
  for (let i = 0; i < xs.length; i++) {
    out.push({ at: xs[i], fixed: true });
    if (i === xs.length - 1) break;
    const gap = xs[i + 1] - xs[i];
    if (gap < pitch[0] * 0.6) continue;
    const n = Math.max(1, Math.round(gap / mean), Math.ceil(gap / pitch[1] - 1e-9));   // never a block over the top of the pitch
    const rng = rngOf(`${xs[i]}-${xs[i + 1]}`);
    for (let k = 1; k < n; k++) {
      const jitter = (rng() - 0.5) * 0.3 * (gap / n);
      // the avenue of a gap wide enough for one: its middle line, so it never depends on a line elsewhere
      out.push({ at: r2(xs[i] + (gap * k) / n + jitter), fixed: false, avenue: n >= avenueEvery && k === Math.round(n / 2) });
    }
  }
  return out;
}
// Reserved ground's edges brought onto the grid AFTER it is rolled: the nearest rolled line moves onto each edge (or a
// line is added when none is near), and a rolled line left too close to one is dropped. A site is a local edit: it
// moves the lines round it and no others.
function snapLines(lines, edges, pitch, max) {
  const out = lines.map((l) => ({ ...l }));
  for (const e of [...new Set(edges.map(r2))].filter((v) => v > 0 && v < max).sort((a, b) => a - b)) {
    if (out.some((l) => l.fixed && Math.abs(l.at - e) < 0.01)) continue;
    const free = out.filter((l) => !l.fixed), near = free.reduce((b, l) => (!b || Math.abs(l.at - e) < Math.abs(b.at - e) ? l : b), null);
    if (near && Math.abs(near.at - e) < pitch[0] * 0.5) { near.at = e; near.fixed = true; } else out.push({ at: e, fixed: true });
  }
  const fixed = out.filter((l) => l.fixed);
  return out.filter((l) => l.fixed || !fixed.some((f) => Math.abs(f.at - l.at) < pitch[0] * 0.35)).sort((a, b) => a.at - b.at);
}

// the part of a line [lo, hi] along its run left after the obstacles it crosses are cut out of it
function cutRun(lo, hi, cuts) {
  let spans = [[lo, hi]];
  for (const [a, b] of cuts) spans = spans.flatMap(([p, q]) => (b <= p || a >= q ? [[p, q]] : [...(a > p ? [[p, a]] : []), ...(b < q ? [[b, q]] : [])]));
  return spans.filter(([p, q]) => q - p > 1);
}

// ── layer 5: blocks and lots ─────────────────────────────────────────────────────────────────────────────────────────
function components(R) {
  const seen = new Uint8Array(R.data.length), out = [];
  for (let s = 0; s < R.data.length; s++) {
    if (seen[s] || R.data[s] !== CLAIM.FREE) continue;
    const cells = [], stack = [s];
    seen[s] = 1;
    while (stack.length) {
      const k = stack.pop(); cells.push(k);
      const i = k % R.cols, j = (k - i) / R.cols;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= R.cols || nj >= R.rows) continue;
        const n = nj * R.cols + ni;
        if (!seen[n] && R.data[n] === CLAIM.FREE) { seen[n] = 1; stack.push(n); }
      }
    }
    out.push(cells);
  }
  return out;
}
// the largest axis-aligned rectangle of a component's cells (the histogram method), in raster cells
function largestRect(R, cells) {
  let i0 = Infinity, j0 = Infinity, i1 = -1, j1 = -1;
  for (const k of cells) { const i = k % R.cols, j = (k - i) / R.cols; i0 = Math.min(i0, i); i1 = Math.max(i1, i); j0 = Math.min(j0, j); j1 = Math.max(j1, j); }
  const w = i1 - i0 + 1, h = j1 - j0 + 1, mask = new Uint8Array(w * h);
  for (const k of cells) { const i = k % R.cols, j = (k - i) / R.cols; mask[(j - j0) * w + (i - i0)] = 1; }
  const hist = new Int32Array(w);
  let best = { a: 0 };
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) hist[i] = mask[j * w + i] ? hist[i] + 1 : 0;
    const st = [];
    for (let i = 0; i <= w; i++) {
      const v = i < w ? hist[i] : 0;
      while (st.length && hist[st[st.length - 1]] >= v) {
        const top = st.pop(), height = hist[top], left = st.length ? st[st.length - 1] + 1 : 0, width = i - left;
        if (height * width > best.a) best = { a: height * width, i0: i0 + left, i1: i0 + i - 1, j0: j0 + j - height + 1, j1: j0 + j };
      }
      st.push(i);
    }
  }
  return { bbox: { i0, i1, j0, j1 }, rect: best.a ? { x0: best.i0 * R.res, y0: best.j0 * R.res, x1: (best.i1 + 1) * R.res, y1: (best.j1 + 1) * R.res } : null };
}
function frontages(len, rng, L) {
  const out = [];
  let left = len;
  while (left > 1e-6) {
    let f = rng() < L.wideP ? L.wide[0] + rng() * (L.wide[1] - L.wide[0]) : L.front[0] + rng() * (L.front[1] - L.front[0]);
    if (left - f < L.front[0]) f = left;
    out.push(f); left -= f;
  }
  return out;
}
function lotHeight(lot, rng, G, k, low) {
  if (low) { const floors = 1 + (rng() < 0.4 ? 1 : 0), floorH = 6; return { h: r2(floors * floorH + 0.3), floors, floorH }; }
  const H = G.height, med = H.edge + (H.core - H.edge) * k, sigma = H.sigmaEdge + (H.sigmaCore - H.sigmaEdge) * k;
  const z = Math.max(-1.8, Math.min(2.4, gaussian(rng)));
  const h = Math.min(med * exp(sigma * z), H.slender * Math.min(lot.x1 - lot.x0, lot.y1 - lot.y0), H.cap ?? Infinity);
  const floorH = h > 29 ? G.floorH.office : G.floorH.residential, floors = Math.max(1, Math.round(h / floorH));
  return { h: r2(floors * floorH + 0.45), floors, floorH };
}
const MATERIALS = ['glass', 'stone', 'brick'];
function skinWeights(G, k, tilt = null) {
  const w = Object.fromEntries(MATERIALS.map((id) => { const [b, c, e] = G.skin.mix[id] || [0, 0, 0]; return [id, Math.max(0, b + c * k * k + e * (1 - k))]; }));
  if (tilt) w[tilt] *= G.skin.tilt;
  return w;
}
function drawMaterial(u, w) {
  const tot = MATERIALS.reduce((a, id) => a + w[id], 0) || 1;
  let r = u * tot;
  for (const id of MATERIALS) { if ((r -= w[id]) < 0) return id; }
  return 'brick';
}
// a material each district of the skin lattice leans to, on its own stream: one lattice square's dice never move another
function skinDistricts(seed, G, field) {
  const memo = new Map();
  return (x, y) => {
    const i = Math.floor(x / G.skin.district), j = Math.floor(y / G.skin.district), key = `${i},${j}`;
    if (!memo.has(key)) memo.set(key, drawMaterial(streamOf(seed, 'skin', key)(), skinWeights(G, field.k((i + 0.5) * G.skin.district, (j + 0.5) * G.skin.district))));
    return memo.get(key);
  };
}
function skinOf(rng, G, k, lean, h) {
  const material = drawMaterial(rng(), skinWeights(G, k, lean));
  return material === 'brick' && h > G.skin.brickMax ? 'stone' : material;
}
/** A block's lots: two rows back to back along its long side (an inner court when it is deep enough, end rows round it),
 *  a tower on a core corner first. Each lot faces the street its row fronts. */
function cutBlock(block, G, field, districtAt, leanAt, rng) {
  const { x0, y0, x1, y1 } = block.rect, along = x1 - x0 >= y1 - y0 ? 'x' : 'y';
  const long = along === 'x' ? x1 - x0 : y1 - y0, short = along === 'x' ? y1 - y0 : x1 - x0;
  const R = (a0, c0, aL, cL) => (along === 'x' ? { x0: x0 + a0, y0: y0 + c0, x1: x0 + a0 + aL, y1: y0 + c0 + cL } : { x0: x0 + c0, y0: y0 + a0, x1: x0 + c0 + cL, y1: y0 + a0 + aL });
  const facing = { lo: along === 'x' ? 'n' : 'w', hi: along === 'x' ? 's' : 'e', start: along === 'x' ? 'w' : 'n', end: along === 'x' ? 'e' : 's' };
  const L = G.lot, k = field.k((x0 + x1) / 2, (y0 + y1) / 2), use = districtAt((x0 + x1) / 2, (y0 + y1) / 2), U = DISTRICT_USES[use];
  const kk = U.k(k);
  let Dp = L.depth[0] + rng() * (L.depth[1] - L.depth[0]);
  const court = short - 2 * Dp >= L.court;
  if (!court) Dp = short / 2;
  const strips = [{ r: R(0, 0, long, Dp), run: along, face: facing.lo }, { r: R(0, short - Dp, long, Dp), run: along, face: facing.hi }];
  let courtRect = null;
  if (court) {
    const D2 = Math.min(Dp, (long - L.court) / 2);
    if (D2 > 4) {
      strips.push({ r: R(0, Dp, D2, short - 2 * Dp), run: along === 'x' ? 'y' : 'x', face: facing.start }, { r: R(long - D2, Dp, D2, short - 2 * Dp), run: along === 'x' ? 'y' : 'x', face: facing.end });
      courtRect = R(D2, Dp, long - 2 * D2, short - 2 * Dp);
    } else courtRect = R(0, Dp, long, short - 2 * Dp);
  }
  const lots = [], cuts = [];
  // a tower on a corner, in a district that raises them, as the field pulls it up
  if (U.towers && rng() < G.tower.p * pow(kk, 1.5)) {
    const T = G.tower, h = (T.h[0] + rng() * (T.h[1] - T.h[0])) * (0.55 + 0.45 * kk);
    let b = Math.max(T.base[0], Math.min(T.base[1], h / (T.slender[0] + rng() * (T.slender[1] - T.slender[0]))));
    b = Math.min(b, short, long * 0.6, h / T.slender[0]);
    const bl = Math.min(long * 0.6, b * (1 + rng() * 0.3)), atEnd = rng() < 0.5, atFar = rng() < 0.5;
    const rect = R(atEnd ? long - bl : 0, atFar ? short - b : 0, bl, b);
    const floors = Math.max(1, Math.round(h / G.floorH.office));
    const sh = rng(), [s1, s2, s3] = T.shapes, shape = sh < s1 ? 'setback' : sh < s2 ? 'box' : sh < s3 ? 'podium' : 'cylinder';
    lots.push({ ...rect, use: 'office', tower: true, shape, floors, floorH: G.floorH.office, h: r2(floors * G.floorH.office + 0.6), face: atFar ? facing.hi : facing.lo, skin: rng() < G.skin.towerGlass ? 'glass' : 'stone', shopfront: true, k: r2(kk) });
    cuts.push(rect);
  }
  for (const s of strips) {
    const ax = s.run === 'x', lo = ax ? s.r.x0 : s.r.y0, hi = ax ? s.r.x1 : s.r.y1;
    const blockers = cuts.filter((c) => !(c.x1 <= s.r.x0 || c.x0 >= s.r.x1 || c.y1 <= s.r.y0 || c.y0 >= s.r.y1)).map((c) => (ax ? [c.x0, c.x1] : [c.y0, c.y1]));
    for (const [p, q] of cutRun(lo, hi, blockers)) {
      let t = p;
      for (const f of frontages(q - p, rng, L)) {
        const lot = ax ? { x0: t, y0: s.r.y0, x1: t + f, y1: s.r.y1 } : { x0: s.r.x0, y0: t, x1: s.r.x1, y1: t + f };
        t += f;
        if (lot.x1 - lot.x0 < 3 || lot.y1 - lot.y0 < 3) continue;
        const lk = field.k((lot.x0 + lot.x1) / 2, (lot.y0 + lot.y1) / 2), lkk = U.k(lk);
        if (!U.low && use !== 'core' && rng() < 0.06) { lots.push({ ...lot, use: 'parking', floors: 0, h: 0, face: s.face, k: r2(lkk) }); continue; }
        const m = lotHeight(lot, rng, G, lkk, U.low);
        const lu = U.uses[0] === 'office' && m.h < 29 ? 'mixed' : U.uses[0];
        lots.push({ ...lot, use: lu, ...m, face: s.face, skin: skinOf(rng, G, lkk, leanAt((lot.x0 + lot.x1) / 2, (lot.y0 + lot.y1) / 2), m.h), shopfront: rng() < U.shopfront, k: r2(lkk) });
      }
    }
  }
  return { lots, court: courtRect, use };
}

// ── layer 8: the walk graph ──────────────────────────────────────────────────────────────────────────────────────────
function segX(a, b, p, q) {
  const d = (b[0] - a[0]) * (q[1] - p[1]) - (b[1] - a[1]) * (q[0] - p[0]);
  if (Math.abs(d) < 1e-9) return null;
  const t = ((p[0] - a[0]) * (q[1] - p[1]) - (p[1] - a[1]) * (q[0] - p[0])) / d, u = ((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) / d;
  return t >= -1e-6 && t <= 1 + 1e-6 && u >= -1e-6 && u <= 1 + 1e-6 ? t : null;
}
function walkGraph(streets) {
  const segs = streets.flatMap((s) => s.pts.slice(1).map((b, k) => ({ street: s.id, a: s.pts[k], b })));
  const ts = segs.map(() => [0, 1]);
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const t = segX(segs[i].a, segs[i].b, segs[j].a, segs[j].b);
    if (t === null) continue;
    const u = segX(segs[j].a, segs[j].b, segs[i].a, segs[i].b);
    ts[i].push(t); ts[j].push(u);
  }
  const nodes = [], key = new Map(), edges = [];
  const nodeAt = (x, y) => {
    const k = `${Math.round(x)},${Math.round(y)}`;
    if (!key.has(k)) { key.set(k, nodes.length); nodes.push({ id: nodes.length, x: r2(x), y: r2(y), degree: 0 }); }
    return key.get(k);
  };
  segs.forEach((s, i) => {
    const pts = [...new Set(ts[i].map((t) => Math.max(0, Math.min(1, t)).toFixed(5)))].map(Number).sort((a, b) => a - b);
    for (let k = 1; k < pts.length; k++) {
      const P = (t) => [s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t];
      const A = nodeAt(...P(pts[k - 1])), B = nodeAt(...P(pts[k]));
      if (A === B) continue;
      edges.push({ id: edges.length, street: s.street, a: A, b: B, len: r2(hypot(nodes[B].x - nodes[A].x, nodes[B].y - nodes[A].y)), beats: [] });
      nodes[A].degree++; nodes[B].degree++;
    }
  });
  return { nodes, edges };
}
// the nearest edge whose own reach covers the point (a door on a corner is on both walks: it takes the one it is on)
function nearestEdge(g, x, y, reachOf = () => Infinity) {
  let best = null;
  for (const e of g.edges) {
    const A = g.nodes[e.a], B = g.nodes[e.b], { d, t } = segDist(x, y, [A.x, A.y], [B.x, B.y]);
    if (d <= reachOf(e) && (!best || d < best.d)) best = { e, d, t };
  }
  return best;
}
function shortestWalk(g, from, to) {
  const adj = g.nodes.map(() => []);
  for (const e of g.edges) { adj[e.a].push([e.b, e.len]); adj[e.b].push([e.a, e.len]); }
  const dist = new Float64Array(g.nodes.length).fill(Infinity), done = new Uint8Array(g.nodes.length);
  dist[from] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < dist.length; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || u === to) break;
    done[u] = 1;
    for (const [v, w] of adj[u]) if (dist[u] + w < dist[v]) dist[v] = dist[u] + w;
  }
  return dist[to];
}

/**
 * Design a city from its recipe. → { plan, grammar, frame, field, streets, districts, blocks, lots, gore, sites,
 * transit, walk, laws, stats }. Pure: the same recipe is the same city.
 */
export function designCity(recipe) {
  const plan = readCityPlan(recipe);
  const G = grammarAtPlay(resolveGrammar(plan.grammar), plan.play);
  const { cell, cols, rows } = plan.board, W = cols * cell, D = rows * cell;
  const cellRect = (c) => ({ x0: c.c0 * cell, x1: (c.c1 + 1) * cell, y0: (c.r0 - 1) * cell, y1: c.r1 * cell });
  const centre = (p) => [r2((p.c + 0.5) * cell), r2((p.r - 0.5) * cell)];

  // 3 · the field, then the districts: the ones laid by hand, last laid wins; the rest read off the field
  const field = heightField(plan, G, W, D, cellRect);
  const laidDistricts = plan.districts.map((d, i) => ({ id: `d${i + 1}`, ...d, rect: cellRect(d.cells) }));
  const districtAt = (x, y) => {
    for (let i = laidDistricts.length - 1; i >= 0; i--) { const r = laidDistricts[i].rect; if (x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1) return laidDistricts[i].use; }
    return IMPLIED(field.k(x, y));
  };

  // 2 · the spine; 6 · the reserved ground (sites, and districts nothing is built in)
  const S = (rank) => G.street[rank];
  const spine = plan.spine.map((s, i) => ({ id: s.name ? s.name : `spine-${i + 1}`, rank: s.rank, pts: s.path.map(centre), source: 'spine', ...S(s.rank) }));
  const reserved = [
    ...plan.sites.map((s, i) => ({ id: `site-${i + 1}`, kind: 'site', use: s.use, rect: cellRect(s.cells), name: s.name, height: s.height })),
    ...laidDistricts.filter((d) => !DISTRICT_USES[d.use].built).map((d) => ({ id: d.id, kind: 'district', use: d.use, rect: d.rect, name: d.name })),
  ];

  // 4 · the grid, rolled between the fixed lines
  const straight = (s, axis) => s.pts.slice(1).map((b, k) => [s.pts[k], b]).filter(([a, b]) => (axis === 'x' ? Math.abs(a[0] - b[0]) < 1e-6 : Math.abs(a[1] - b[1]) < 1e-6));
  const fixedX = [0, W, ...spine.flatMap((s) => straight(s, 'x').map(([a]) => a[0]))].filter((v) => v >= 0 && v <= W);
  const fixedY = [0, D, ...spine.flatMap((s) => straight(s, 'y').map(([a]) => a[1]))].filter((v) => v >= 0 && v <= D);
  const xs = snapLines(gridLines(fixedX, G.block.pitch, (gap) => streamOf(plan.seed, 'grid', `x:${gap}`), G.block.avenueEvery), reserved.flatMap((r) => [r.rect.x0, r.rect.x1]), G.block.pitch, W);
  const ys = snapLines(gridLines(fixedY, G.block.pitch, (gap) => streamOf(plan.seed, 'grid', `y:${gap}`), G.block.avenueEvery), reserved.flatMap((r) => [r.rect.y0, r.rect.y1]), G.block.pitch, D);
  const streets = [];
  const spineOn = (axis, v) => spine.find((s) => straight(s, axis).some(([a]) => Math.abs((axis === 'x' ? a[0] : a[1]) - v) < 0.01));
  // a grid street is named by where it runs ('x340' runs down at x 340 m), so a line added elsewhere renames nothing
  const laneLine = (axis, line) => {
    const v = line.at, sp = spineOn(axis, v), edge = v <= 0 || v >= (axis === 'x' ? W : D);
    const rank = sp ? sp.rank : !edge && line.avenue ? 'major' : 'minor';
    const len = axis === 'x' ? D : W;
    // a line crossing reserved ground stops at it; a reserved edge the line runs along keeps it
    const cuts = reserved.filter((r) => (axis === 'x' ? v > r.rect.x0 + 0.01 && v < r.rect.x1 - 0.01 : v > r.rect.y0 + 0.01 && v < r.rect.y1 - 0.01)).map((r) => (axis === 'x' ? [r.rect.y0, r.rect.y1] : [r.rect.x0, r.rect.x1]));
    // the spine crosses water and parks whole (a bridge, a parkway): its line is not cut
    const runs = sp ? [[0, len]] : cutRun(0, len, cuts), name = sp ? sp.id : `${axis}${Math.round(v)}`;
    runs.forEach(([p, q], k) => streets.push({ id: runs.length > 1 ? `${name}.${k + 1}` : name, rank, source: sp ? 'spine' : edge ? 'edge' : 'grid', pts: axis === 'x' ? [[v, p], [v, q]] : [[p, v], [q, v]], ...S(rank) }));
  };
  xs.forEach((l) => laneLine('x', l));
  ys.forEach((l) => laneLine('y', l));
  // the spine's turns and diagonals, laid over the grid as their own streets
  for (const s of spine) {
    const bent = s.pts.slice(1).map((b, k) => [s.pts[k], b]).filter(([a, b]) => Math.abs(a[0] - b[0]) > 1e-6 && Math.abs(a[1] - b[1]) > 1e-6);
    bent.forEach(([a, b], k) => streets.push({ id: bent.length > 1 ? `${s.id}~${k + 1}` : `${s.id}~`, rank: s.rank, source: 'spine', pts: [a, b], road: s.road, walk: s.walk }));
  }

  // the raster: reserved ground, then every right-of-way over it
  const Rr = raster(W, D);
  for (const r of reserved) stampRect(Rr, r.rect.x0, r.rect.y0, r.rect.x1, r.rect.y1, r.use === 'water' ? CLAIM.WATER : r.use === 'park' ? CLAIM.PARK : CLAIM.SITE);
  for (const s of streets) stampStreet(Rr, s);

  // 4 · blocks: what the streets leave; 5 · their lots, each block on its own dice
  const blocks = [], lots = [], gore = [];
  const seenIds = new Map(), leanAt = skinDistricts(plan.seed, G, field);
  for (const cells of components(Rr)) {
    const area = cells.length * Rr.res * Rr.res;
    const { rect, bbox } = largestRect(Rr, cells);
    const minLot = G.lot.front[0] * G.lot.depth[0];
    if (!rect || area < minLot * 2 || (rect.x1 - rect.x0) < G.lot.front[0] * 1.5 || (rect.y1 - rect.y0) < 8) {
      gore.push({ x0: bbox.i0 * Rr.res, y0: bbox.j0 * Rr.res, x1: (bbox.i1 + 1) * Rr.res, y1: (bbox.j1 + 1) * Rr.res, area: r2(area), cells: cells.length });
      continue;
    }
    let id = `b${Math.round(rect.x0)}-${Math.round(rect.y0)}`;
    const n = (seenIds.get(id) || 0) + 1; seenIds.set(id, n); if (n > 1) id = `${id}.${n}`;
    const block = { id, rect, area: r2(area), rectArea: r2((rect.x1 - rect.x0) * (rect.y1 - rect.y0)) };
    const cut = cutBlock(block, G, field, districtAt, leanAt, streamOf(plan.seed, 'lots', id));
    block.use = cut.use; block.court = cut.court;
    const rest = area - block.rectArea;
    if (rest > minLot) gore.push({ block: id, area: r2(rest), x0: bbox.i0 * Rr.res, y0: bbox.j0 * Rr.res, x1: (bbox.i1 + 1) * Rr.res, y1: (bbox.j1 + 1) * Rr.res, cells: null });
    cut.lots.forEach((l, i) => {
      const lid = `${id}.${i + 1}`, over = plan.lots[lid];
      const lot = { id: lid, block: id, ...Object.fromEntries(Object.entries(l).map(([k, v]) => [k, typeof v === 'number' ? r2(v) : v])) };
      if (over) {
        if (over.use) lot.use = over.use;
        if (over.storeys) { lot.floors = over.storeys; lot.h = r2(over.storeys * lot.floorH + 0.45); }
        if (over.use === 'parking') { lot.floors = 0; lot.h = 0; }
        if (over.facade) lot.facade = over.facade;
        lot.byHand = true;
      }
      // the door on the face its row fronts, if a walk runs past it; else on any other face a walk runs past (a
      // block a diagonal clipped leaves some rows facing the scrap it cut off, not a street)
      const doorOn = (f) => (f === 'n' ? [(lot.x0 + lot.x1) / 2, lot.y0, 0, -1] : f === 's' ? [(lot.x0 + lot.x1) / 2, lot.y1, 0, 1] : f === 'w' ? [lot.x0, (lot.y0 + lot.y1) / 2, -1, 0] : [lot.x1, (lot.y0 + lot.y1) / 2, 1, 0]);
      const onWalk = (f) => { const [x, y, dx, dy] = doorOn(f), c = Rr.get(x + dx * Rr.res * 1.5, y + dy * Rr.res * 1.5); return c === CLAIM.WALK || c === CLAIM.ROAD; };
      if (!onWalk(lot.face)) {
        const other = ['n', 's', 'w', 'e'].find((f) => f !== lot.face && onWalk(f));
        // landlocked (behind the scrap, no face on a walk): not built, it goes green with the scrap
        if (!other && !lot.byHand) { gore.push({ block: id, lot: lot.id, landlocked: true, area: r2((lot.x1 - lot.x0) * (lot.y1 - lot.y0)), x0: lot.x0, y0: lot.y0, x1: lot.x1, y1: lot.y1, cells: null }); return; }
        if (other) lot.face = other;
      }
      lot.door = doorOn(lot.face).slice(0, 2).map(r2);
      lots.push(lot);
    });
    block.lots = lots.filter((l) => l.block === id).length;
    blocks.push(block);
  }

  // 6 · the sites, built
  const sites = reserved.filter((r) => r.kind === 'site').map((r) => {
    const w = r.rect.x1 - r.rect.x0, d = r.rect.y1 - r.rect.y0, ring = r.use === 'landmark' ? Math.min(w, d) * 0.22 : 0;
    const mass = r.use === 'landmark' ? { x0: r.rect.x0 + ring, y0: r.rect.y0 + ring, x1: r.rect.x1 - ring, y1: r.rect.y1 - ring, h: r.height ?? r2(G.height.core * 3.5) }
      : r.use === 'civic' ? { x0: r.rect.x0 + w * 0.2, y0: r.rect.y0 + d * 0.2, x1: r.rect.x1 - w * 0.2, y1: r.rect.y1 - d * 0.2, h: r.height ?? r2(G.height.edge * 1.6) } : null;
    return { id: r.id, use: r.use, ...(r.name ? { name: r.name } : {}), rect: r.rect, ...(mass ? { mass: Object.fromEntries(Object.entries(mass).map(([k, v]) => [k, r2(v)])) } : {}) };
  });

  // 7 · transit: each line through its cells, a stop every `stop` metres along it
  const transit = plan.transit.map((t, i) => {
    const pts = t.path.map(centre), stops = [];
    let carry = G.transit.stop / 2, length = 0;
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1], b = pts[k], L = hypot(b[0] - a[0], b[1] - a[1]);
      for (let s = carry; s <= L; s += G.transit.stop) {
        const p = [r2(a[0] + (b[0] - a[0]) * (s / L)), r2(a[1] + (b[1] - a[1]) * (s / L))], claim = Rr.get(p[0], p[1]);
        stops.push({ at: p, onStreet: claim === CLAIM.ROAD || claim === CLAIM.WALK });
      }
      carry = G.transit.stop - ((L - carry) % G.transit.stop);
      length += L;
    }
    const along = [];
    for (let k = 1; k < pts.length; k++) for (let s = 0; s <= 1; s += 0.05) { const p = [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * s, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * s], c = Rr.get(p[0], p[1]); along.push(c === CLAIM.ROAD || c === CLAIM.WALK); }
    return { id: t.name || `line-${i + 1}`, mode: t.mode, pts, stops, length: r2(length), onStreet: r2(along.filter(Boolean).length / along.length) };
  });

  // 8 · the walk: the graph of every right-of-way, each door hung on its nearest face, each beat on its edge
  const walk = walkGraph(streets);
  const reach = (s) => s.road / 2 + s.walk + 4;
  const byId = new Map(streets.map((s) => [s.id, s]));
  for (const l of lots) {
    if (l.use === 'parking') continue;
    const ne = nearestEdge(walk, l.door[0], l.door[1], (e) => reach(byId.get(e.street)));
    if (ne) {
      l.street = ne.e.street;   // the street its door is on (by id: an edge index moves when any street does)
      if (l.shopfront || l.use === 'civic') ne.e.beats.push({ t: r2(ne.t), what: l.tower ? 'tower lobby' : l.use === 'civic' ? 'civic door' : 'shopfront', lot: l.id });
    }
  }
  for (const s of sites) {
    const { x0, y0, x1, y1 } = s.rect;
    for (const p of [[(x0 + x1) / 2, y0], [(x0 + x1) / 2, y1], [x0, (y0 + y1) / 2], [x1, (y0 + y1) / 2]]) {
      const ne = nearestEdge(walk, p[0], p[1], (e) => reach(byId.get(e.street)) + 4);
      if (ne) ne.e.beats.push({ t: r2(ne.t), what: s.use, site: s.id });
    }
  }
  for (const t of transit) for (const st of t.stops) {
    const ne = nearestEdge(walk, st.at[0], st.at[1], () => 12);
    if (ne) ne.e.beats.push({ t: r2(ne.t), what: `${t.mode} stop`, line: t.id });
  }

  const design = { plan, grammar: G, frame: { W, D, cell, cols, rows }, field, raster: Rr, streets, districts: laidDistricts, reserved, blocks, lots, gore, sites, transit, walk };
  // 9 · the segments the city is played in (segments.js), cut along the streets just laid
  if (plan.segments) design.segments = citySegments(design, plan.segments);
  design.laws = evaluateLaws(design);
  design.stats = cityStats(design);
  return design;
}

const q = (arr, p) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
/** The census, in the legacy city's own terms (fractal-city.js cityScaleCensus), so the two can be held side by side. */
export function cityStats(d) {
  const { W, D } = d.frame, km2 = (W * D) / 1e6;
  const built = d.lots.filter((l) => l.use !== 'parking');
  const hs = built.map((l) => l.h), fronts = built.filter((l) => !l.tower).map((l) => Math.min(l.x1 - l.x0, l.y1 - l.y0));
  let walkCells = 0, roadCells = 0;
  for (const c of d.raster.data) { if (c === CLAIM.WALK) walkCells++; else if (c === CLAIM.ROAD) roadCells++; }
  const cellA = d.raster.res * d.raster.res;
  const junctions = d.walk.nodes.filter((n) => n.degree >= 3).length;
  const skins = {};
  for (const l of built) skins[l.skin] = (skins[l.skin] || 0) + 1;
  const corner = (x, y) => d.walk.nodes.reduce((b, n) => (!b || hypot(n.x - x, n.y - y) < hypot(b.x - x, b.y - y) ? n : b), null);
  const a = corner(0, 0), b = corner(W, D), across = a && b ? shortestWalk(d.walk, a.id, b.id) : Infinity;
  const p50 = q(hs, 0.5);
  return {
    km2: r2(km2), blocks: d.blocks.length, lots: d.lots.length, masses: built.length, landlocked: d.gore.filter((g) => g.landlocked).length,
    pitch: d.blocks.length ? r2(sqrt((W * D) / d.blocks.length)) : null,
    crossingsPerKm2: r2(junctions / km2),
    streetShare: r2((walkCells * cellA) / (W * D)), roadShare: r2((roadCells * cellA) / (W * D)),
    height: { p10: r2(q(hs, 0.1)), p50: r2(p50), p90: r2(q(hs, 0.9)), max: r2(hs.length ? Math.max(...hs) : 0), share100: r2(hs.length ? hs.filter((h) => h >= 100).length / hs.length : 0) },
    towers: built.filter((l) => l.tower).length,
    lotFront: { p50: r2(q(fronts, 0.5)) },
    skin: Object.fromEntries(Object.entries(skins).sort().map(([k, v]) => [k, r2(v / (built.length || 1))])),
    streetKm: r2(d.streets.reduce((s, x) => s + x.pts.slice(1).reduce((t, p, k) => t + hypot(p[0] - x.pts[k][0], p[1] - x.pts[k][1]), 0), 0) / 1000),
    walkAcross: Number.isFinite(across) ? { metres: r2(across), minutes: r2(across / d.grammar.walk.speed / 60), pace: d.grammar.walk.speed } : null,
    stops: d.transit.reduce((s, t) => s + t.stops.length, 0),
  };
}
