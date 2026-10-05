/**
 * historic/terrain — ground that is not flat, for any culture. A layout hands over its height function
 * `hAt(x, y)` (metres; it may JUMP: a sea cliff, a terrace wall) and gets back the ground the page draws:
 *
 *   - FLAT ground as rects in runs along each row, textured and shaded like any town ground;
 *   - a gentle SLOPE as two sloping triangles (Giza's escarpment);
 *   - a RISER — where the ground steps from one level to another inside a cell — as a vertical face
 *     standing on the contour between them, its top as a flat panel at the upper level and the lower
 *     level as ordinary ground under it. A riser at least `cliff` m tall is a `cliff` (bare rock, the
 *     culture's cliff skin); a lower one is a `terrace-wall` (the hillside built up in dry stone).
 *
 * The contour is found by bisection on `hAt` along each cell edge, so a jump in `hAt` lands where the
 * jump is — a cliff is sheer and straight, not the staircase of a grid — and a steep smooth face is
 * stood up at its mid-height. A cell holding more than two levels is cut in four until each piece holds
 * at most two (down to `minCell`). Under `waterZ` the ground is the sea's: a riser runs down below the
 * water to the sea bed, and the water is laid over every cell that dips under it.
 *
 * Shared by every culture with terrain (Lindos today); a layout that passes a flat `hAt` gets plain rects.
 * Plans in metres. Pure and deterministic.
 */

const DEFAULTS = { cell: 10, minCell: 2.5, step: 0.5, cliff: 4, eyeRadius: 60, eyeSquare: 5, runMax: 40, layer: 0.04 };

/**
 * `hAt` the height; `frame` { w, d }; `surfaceAt(x, y, z)` → { fill, surface? } for the ground at a point;
 * `riserTint(height, x, y)` the colour of a riser's face; `water` { z, fill } (optional: the sea);
 * `eyes` [[x, y], …] views whose ground is cut fine (a big face reaching behind an eye is dropped whole);
 * `skip(x0, y0, size)` true for a cell another mesher draws (./rock.js). The sea is laid over skipped cells too.
 * `water` { z, fill, fillAt?, liquid?, alphaAt?, sheetFill?, fine?, fineSize? }: the sea's level and colour; `liquid`
 * its look on the World page (../materials/aqua-look.js), `alphaAt(x, y)` its opacity there and `sheetFill` its one
 * body colour there (its depth does what `fillAt`'s two tones do on the page); `fine(x, y)` where to cut it small.
 * Returns { grounds, boxes, stats }.
 */
export function terrainMesh({ hAt, frame, surfaceAt, riserTint, water = null, eyes = [], skip = null, ...opts }) {
  const O = { ...DEFAULTS, ...opts }, grounds = [], boxes = [];
  const stats = { flats: 0, slopes: 0, cliffs: 0, terraceWalls: 0, cliffArea: 0, water: 0 };
  const cols = Math.ceil(frame.w / O.cell), rows = Math.ceil(frame.d / O.cell);
  const wz = water ? water.z : -Infinity;
  const layerOf = (x, y) => ((Math.round(x / O.eyeSquare) + Math.round(y / O.eyeSquare)) % 2 ? O.layer : 0);

  const flatRect = (x, y, w, d, z, odd) => {
    if (z < wz) return;
    const s = surfaceAt(x + w / 2, y + d / 2, z), ov = odd ? 0.06 : 0;
    grounds.push({ kind: 'ground', x: x - ov, y: y - ov, w: w + 2 * ov, d: d + 2 * ov, z: z + 0.01 + (odd ? O.layer : 0), fill: s.fill, ...(s.surface ? { surface: s.surface } : {}) });
    stats.flats++;
  };
  // the sample lattice of a cell (5 × 5, corners included: a terrace a quarter of a cell wide still shows) and its
  // levels: the samples clustered where they part by more than `step`
  const Q = [0, 0.25, 0.5, 0.75, 1];
  const lattice = (x0, y0, s) => { const out = []; for (const v of Q) for (const u of Q) out.push([x0 + u * s, y0 + v * s, hAt(x0 + u * s, y0 + v * s)]); return out; };
  const levels = (zs) => {
    const z = [...zs].sort((a, b) => a - b), out = [[z[0]]];
    for (let i = 1; i < z.length; i++) { if (z[i] - z[i - 1] > O.step) out.push([]); out.at(-1).push(z[i]); }
    return out;
  };

  /** One cell (or a quarter of one); `run` collects base-level flats for merging. Returns true if it laid a flat for the run. */
  const cellOut = (x0, y0, s, flatSink) => {
    const L = lattice(x0, y0, s), zs = L.map((p) => p[2]), lv = levels(zs);
    const lo = Math.min(...zs), hi = Math.max(...zs);
    if (hi < wz - 0.05) return;   // under the sea: the water covers it
    // a smooth slope however steep: every sample within a hair of the corners' bilinear surface — two triangles, no steps
    const bil = (u, v) => L[0][2] * (1 - u) * (1 - v) + L[4][2] * u * (1 - v) + L[20][2] * (1 - u) * v + L[24][2] * u * v;
    const smoothCell = hi - lo >= 0.05 && L.every((p, k) => Math.abs(p[2] - bil(Q[k % 5], Q[Math.floor(k / 5)])) < O.step * 0.4);
    if (lv.length === 1 || smoothCell) {
      if (hi - lo < 0.05) { flatSink(x0, y0, s, (lo + hi) / 2); return; }
      // a gentle slope: two triangles on the corners
      const c = [L[0], L[4], L[24], L[20]], s0 = surfaceAt(x0 + s / 2, y0 + s / 2, (lo + hi) / 2);
      for (const tri of [[c[0], c[1], c[2]], [c[0], c[2], c[3]]]) boxes.push(panel('slope', tri, [0, 0, 1], s0.fill));
      stats.slopes++;
      return;
    }
    const split = () => { const h = s / 2; for (const [dx, dy] of [[0, 0], [h, 0], [0, h], [h, h]]) cellOut(x0 + dx, y0 + dy, h, (x, y, w, z) => flatRect(x, y, w, w, z, false)); };
    const corners = [L[0], L[4], L[24], L[20]];
    // the two levels this cell steps between: split at the widest gap
    let gi = 0, gap = -1; const sorted = [...zs].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) if (sorted[i] - sorted[i - 1] > gap) { gap = sorted[i] - sorted[i - 1]; gi = i; }
    const thr = (sorted[gi - 1] + sorted[gi]) / 2, isHi = corners.map((p) => p[2] > thr);
    const nHi = isHi.filter(Boolean).length, saddle = nHi === 2 && isHi[0] === isHi[2];
    const tidy = lv.length === 2 && lv.every((g) => g.at(-1) - g[0] < 0.3);
    if ((!tidy || nHi === 0 || nHi === 4 || saddle) && s / 2 >= O.minCell) return split();
    if (nHi === 0 || nHi === 4 || saddle) {
      // too small to cut again: lay it at its level nearest the ground's middle (a sliver of a riser lost to the grid)
      flatSink(x0, y0, s, nHi === 4 ? sorted[gi] : sorted[gi - 1]);
      return;
    }
    const zLo = mean(sorted.slice(0, gi)), zHi = mean(sorted.slice(gi));
    // where the contour crosses each edge whose ends differ: bisect `hAt` along it
    const cross = (a, b) => {
      let t0 = 0, t1 = 1;
      const aHi = a[2] > thr;
      for (let k = 0; k < 16; k++) { const t = (t0 + t1) / 2; if ((hAt(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t) > thr) === aHi) t0 = t; else t1 = t; }
      const t = (t0 + t1) / 2;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    };
    const top = [], foot = [], ends = [];
    for (let i = 0; i < 4; i++) {
      const a = corners[i], b = corners[(i + 1) % 4];
      (isHi[i] ? top : foot).push([a[0], a[1], isHi[i] ? zHi : zLo]);
      if (isHi[i] !== isHi[(i + 1) % 4]) { const p = cross(a, b); top.push([p[0], p[1], zHi]); foot.push([p[0], p[1], zLo]); ends.push(p); }
    }
    // the two levels, each a flat panel on its side of the contour (none under the other: a ground laid under
    // the upper level would show through the seams between its triangles)
    const at = (poly) => surfaceAt(mean(poly.map((p) => p[0])), mean(poly.map((p) => p[1])), poly[0][2]).fill;
    if (zLo >= wz) boxes.push(panel('terrace-foot', foot, [0, 0, 1], at(foot)));
    boxes.push(panel('terrace-top', top, [0, 0, 1], at(top)));
    // the riser: from the lower level (or the sea bed under the water) up to the upper, facing the low side
    const [A, B] = ends, h = zHi - zLo, cx = x0 + s / 2, cy = y0 + s / 2;
    const tx = B[0] - A[0], ty = B[1] - A[1], len = Math.hypot(tx, ty) || 1;
    let n = [ty / len, -tx / len];
    const hiC = [mean(top.map((p) => p[0])), mean(top.map((p) => p[1]))];
    if ((hiC[0] - (A[0] + B[0]) / 2) * n[0] + (hiC[1] - (A[1] + B[1]) / 2) * n[1] > 0) n = [-n[0], -n[1]];
    const kind = h >= O.cliff ? 'cliff' : 'terrace-wall', zf = zLo - 0.05;
    boxes.push(panel(kind, [[A[0], A[1], zf], [B[0], B[1], zf], [B[0], B[1], zHi], [A[0], A[1], zHi]], [n[0], n[1], 0], riserTint(h, cx, cy)));
    if (kind === 'cliff') { stats.cliffs++; stats.cliffArea += len * h; } else stats.terraceWalls++;
  };

  for (let r = 0; r < rows; r++) {
    const y0 = r * O.cell, d = Math.min(O.cell, frame.d - y0), odd = r % 2 === 1;
    let run = null;
    const flush = () => { if (run) flatRect(run.x, y0, run.w, d, run.z, odd); run = null; };
    for (let c = 0; c < cols; c++) {
      const x0 = c * O.cell, s = Math.min(O.cell, frame.w - x0, d), mx = x0 + s / 2, my = y0 + s / 2;
      const nearEye = eyes.some(([ex, ey]) => Math.hypot(mx - ex, my - ey) < O.eyeRadius);
      // a flat base cell joins the row's run; a flat piece of a stepped cell (or one near an eye) stands alone
      const sink = (x, y, w, z, under = false) => {
        if (w === s && !under && !nearEye) {
          if (run && Math.abs(run.z - z) < 0.05 && Math.abs(run.x + run.w - x) < 1e-6 && run.w < O.runMax) { run.w += w; return; }
          flush(); run = { x, w, z }; return;
        }
        if (w === s) flush();
        if (nearEye) { for (let yy = y; yy < y + w - 1e-6; yy += O.eyeSquare) for (let xx = x; xx < x + w - 1e-6; xx += O.eyeSquare) { const q = Math.min(O.eyeSquare, x + w - xx); flatRect(xx, yy, q, Math.min(q, y + w - yy), z + layerOf(xx, yy), false); } return; }
        flatRect(x, y, w, w, z, odd);
      };
      // a cell another mesher owns (./rock.js: weathered rock) is left to it
      if (skip && skip(x0, y0, s)) { flush(); continue; }
      cellOut(x0, y0, s, sink);
      if (!run || Math.abs(run.x + run.w - (x0 + s)) > 1e-6) flush();
    }
    flush();
  }

  // the sea over every cell that dips under it, in runs along each row of one colour (`water.fillAt` may tint
  // it by place: the shallows), at most `waterRun` m long; odd rows overlap their neighbours, a layer up
  if (water) {
    const fillAt = water.fillAt || (() => water.fill), wr = O.waterRun || O.runMax;
    // a piece of sea: tagged with its look for the World's water shader (`liquid`) and, with `alphaAt`, its
    // opacity at each corner (clear over a shallow bed, opaque over deep water) — the page's flat fill is unchanged
    // `ov` the hair of overlap that closes the CSS page's seams; a translucent sheet would darken twice where pieces
    // overlap, so a piece with a look keeps its exact rect too (`sheet`), which the World draws instead
    const piece = (x, y, w, d, z, fill, ov = 0) => {
      const g = { kind: 'water', x: x - ov, y: y - ov, w: w + 2 * ov, d: d + 2 * ov, z, fill };
      if (water.liquid) { g.liquid = water.liquid; g.sheet = { x, y, w, d, z: wz, fill: water.sheetFill || fill }; }
      if (water.alphaAt) g.cornerAlpha = [[x, y], [x + w, y], [x + w, y + d], [x, y + d]].map(([a, b]) => +water.alphaAt(a, b).toFixed(3));
      grounds.push(g); stats.water++;
    };
    const cut = (x, y, s, d, size, fill) => { for (let yy = y; yy < y + d - 1e-6; yy += size) for (let xx = x; xx < x + s - 1e-6; xx += size) piece(xx, yy, Math.min(size, x + s - xx), Math.min(size, y + d - yy), wz + layerOf(xx, yy), fill, 0.15); };
    for (let r = 0; r < rows; r++) {
      const y = r * O.cell, d = Math.min(O.cell, frame.d - y), ov = r % 2 ? 0.25 : 0;
      let run = null;
      const flush = () => { if (run) piece(run.x, y, run.w, d, wz + (r % 2 ? O.layer : 0), run.fill, ov); run = null; };
      for (let c = 0; c < cols; c++) {
        const x = c * O.cell, s = Math.min(O.cell, frame.w - x);
        const dips = [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0.5]].some(([u, v]) => hAt(Math.min(frame.w, x + u * s), Math.min(frame.d, y + v * d)) < wz);
        if (!dips) { flush(); continue; }
        const fill = fillAt(x + s / 2, y + d / 2);
        // round an eye the sea is cut fine too (a big face reaching behind the eye is dropped whole); where the
        // water's depth changes (`water.fine`) it is cut fine so its corners can carry the change
        if (eyes.some(([ex, ey]) => Math.hypot(x + s / 2 - ex, y + d / 2 - ey) < O.eyeRadius + s)) { flush(); cut(x, y, s, d, O.eyeSquare * 2, fill); continue; }
        if (water.fine && water.fine(x + s / 2, y + d / 2)) { flush(); cut(x, y, s, d, water.fineSize || 10, fill); continue; }
        if (run && run.fill === fill && run.w + s <= wr) run.w += s; else { flush(); run = { x, w: s, fill }; }
      }
      flush();
    }
  }
  return { grounds, boxes, stats };
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const bbox = (pts) => { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), zs = pts.map((p) => p[2]); return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(0.01, Math.max(...xs) - Math.min(...xs)), d: Math.max(0.01, Math.max(...ys) - Math.min(...ys)), z0: Math.min(...zs), z1: Math.max(...zs) }; };
function panel(kind, pts, out, tint) { return { kind, solid: 'panel', pts, out, ...bbox(pts), tint }; }

/** Round a height to terraces `step` m apart (a built-up hillside): flat steps the town and its fields stand on. */
export const terraced = (z, step) => Math.round(z / step) * step;
