/**
 * ground — what stands on the floor of ANY world, read from its faces. Every world mojulo makes resolves to faces
 * (worlds/world-scene.js), so a scene can be played in any of them without the world saying anything more: where a
 * face rises through the height of a body, a figure cannot walk, and a camera or a storyboard has something to see.
 * A world that says it itself (a decorated room's own pieces: interior/places.js `blocks`) is taken at its word; this
 * is the reading for every other.
 *
 *   standingOf(faces, { about, reach?, cell?, most? }) → { blocks: [{ min: [x, y], max: [x, y], h }], cell, box }
 *     faces   [{ corners: [[x, y, z], …] }] in the scene's frame: metres, the floor the cast stands on at z 0
 *             (mcp/tools/scene-film.js setFaces)
 *     about   [[x, y], …] where the scene is played (its marks): only the ground within `reach` of them is read
 *     blocks  upright boxes over the floor, the same shape a decorated room gives (actor/route.js goes round them,
 *             actor/storyboard.js draws them), `h` how high each stands (to TOP at most)
 *
 * What counts: a face that passes between STEP (a rug, a kerb, a threshold are stepped over) and HEAD (a lintel, a
 * ceiling, a bough above a head are walked under) above the floor. The floor is one height (a scene's marks are
 * stood on one floor: actor/set.js): rising ground reads as standing in the way, as it would to a walker on the flat.
 *
 * The ground is read on a grid of `cell` metres and its taken cells gathered into boxes; where they are more than
 * `most`, the grid is coarsened until they are not (a walk's search and a board's drawing are both by the box).
 *
 * Pure and deterministic.
 */

/** what is stepped over, what is walked under, and how high a block is drawn at most, metres above the floor */
export const STEP = 0.25, HEAD = 1.9, TOP = 3.2;
/** how far about the scene's marks the ground is read, the grid's cell, and the most boxes a ground is gathered into */
export const REACH = 7, CELL = 0.2, MOST = 72;
/** the grid's most cells a side: a wider ground is read coarser */
const SIDE = 160;
const r3 = (v) => Math.round(v * 1000) / 1000;

/** The ground about a scene (see the header) */
export function standingOf(faces, { about = [], reach = REACH, cell = CELL, most = MOST } = {}) {
  const pts = about.filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (!pts.length || !Array.isArray(faces) || !faces.length) return { blocks: [], cell, box: null };
  const box = {
    x0: Math.min(...pts.map((p) => p[0])) - reach, x1: Math.max(...pts.map((p) => p[0])) + reach,
    y0: Math.min(...pts.map((p) => p[1])) - reach, y1: Math.max(...pts.map((p) => p[1])) + reach,
  };
  let c = Math.max(cell, (box.x1 - box.x0) / SIDE, (box.y1 - box.y0) / SIDE), blocks = [];
  for (let pass = 0; pass < 6; pass++, c *= 1.6) {
    blocks = gather(taken(faces, box, c), box, c);
    if (blocks.length <= most) break;
  }
  return { blocks, cell: r3(c), box: { min: [r3(box.x0), r3(box.y0)], max: [r3(box.x1), r3(box.y1)] } };
}

/** The grid: for each cell, how high what stands in it rises (0: clear floor) */
function taken(faces, box, c) {
  const nx = Math.max(1, Math.ceil((box.x1 - box.x0) / c)), ny = Math.max(1, Math.ceil((box.y1 - box.y0) / c));
  const top = new Float32Array(nx * ny);
  const put = (i, j, z) => { if (i < 0 || j < 0 || i >= nx || j >= ny) return; const k = j * nx + i; if (z > top[k]) top[k] = z; };
  const ci = (x) => Math.floor((x - box.x0) / c), cj = (y) => Math.floor((y - box.y0) / c);
  // (the levels a wall is cut at: a wall face stands on edge, so it covers no cell from above and is found by its cut)
  const levels = [];
  for (let z = STEP; z <= HEAD + 1e-9; z += 0.15) levels.push(z);
  for (const f of faces) {
    const P = f?.corners;
    if (!Array.isArray(P) || P.length < 3) continue;
    for (let n = 1; n + 1 < P.length; n++) {
      const A = P[0], B = P[n], C = P[n + 1];
      const zl = Math.min(A[2], B[2], C[2]), zh = Math.max(A[2], B[2], C[2]);
      if (zh < STEP || zl > HEAD) continue;
      const xl = Math.min(A[0], B[0], C[0]), xh = Math.max(A[0], B[0], C[0]), yl = Math.min(A[1], B[1], C[1]), yh = Math.max(A[1], B[1], C[1]);
      if (xh < box.x0 || xl > box.x1 || yh < box.y0 || yl > box.y1) continue;
      const rise = Math.min(zh, TOP);
      // from above: each cell whose middle the face covers, where the face is at a body's height there
      const det = (B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1]);
      if (Math.abs(det) > 1e-9) {
        for (let j = Math.max(0, cj(yl)); j <= Math.min(ny - 1, cj(yh)); j++) {
          for (let i = Math.max(0, ci(xl)); i <= Math.min(nx - 1, ci(xh)); i++) {
            const x = box.x0 + (i + 0.5) * c, y = box.y0 + (j + 0.5) * c;
            const u = ((x - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (y - A[1])) / det, v = ((B[0] - A[0]) * (y - A[1]) - (x - A[0]) * (B[1] - A[1])) / det;
            if (u < 0 || v < 0 || u + v > 1) continue;
            const z = A[2] + u * (B[2] - A[2]) + v * (C[2] - A[2]);
            if (z >= STEP && z <= HEAD) put(i, j, Math.min(z, TOP));
          }
        }
      }
      // on edge: the line the face is cut along at each level, walked a half cell at a time
      for (const z of levels) {
        if (z < zl || z > zh) continue;
        const E = [];
        for (const [p, q] of [[A, B], [B, C], [C, A]]) {
          if ((p[2] - z) * (q[2] - z) > 0 || Math.abs(p[2] - q[2]) < 1e-12) continue;
          const t = (z - p[2]) / (q[2] - p[2]);
          E.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
        }
        if (E.length < 2) continue;
        const [a, b] = [E[0], E.find((e) => Math.hypot(e[0] - E[0][0], e[1] - E[0][1]) > 1e-9) ?? E[1]];
        const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (c / 2)));
        for (let s = 0; s <= steps; s++) put(ci(a[0] + ((b[0] - a[0]) * s) / steps), cj(a[1] + ((b[1] - a[1]) * s) / steps), rise);
      }
    }
  }
  return { top, nx, ny };
}

/** how high a block reads: the low (stepped round, seen over) by the quarter metre, the tall as one */
const band = (h) => (h >= 1.2 ? 9 : Math.max(1, Math.round(h / 0.25)));

/** The taken cells gathered into boxes: a run along x, grown along y while the rows below match it */
function gather({ top, nx, ny }, box, c) {
  const used = new Uint8Array(nx * ny), out = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (!top[k] || used[k]) continue;
      const b = band(top[k]);
      let i1 = i;
      while (i1 + 1 < nx && top[j * nx + i1 + 1] && !used[j * nx + i1 + 1] && band(top[j * nx + i1 + 1]) === b) i1++;
      let j1 = j;
      const rowOk = (jj) => { for (let ii = i; ii <= i1; ii++) { const kk = jj * nx + ii; if (!top[kk] || used[kk] || band(top[kk]) !== b) return false; } return true; };
      while (j1 + 1 < ny && rowOk(j1 + 1)) j1++;
      let h = 0;
      for (let jj = j; jj <= j1; jj++) for (let ii = i; ii <= i1; ii++) { used[jj * nx + ii] = 1; h = Math.max(h, top[jj * nx + ii]); }
      out.push({ min: [r3(box.x0 + i * c), r3(box.y0 + j * c)], max: [r3(box.x0 + (i1 + 1) * c), r3(box.y0 + (j1 + 1) * c)], h: r3(h) });
    }
  }
  return out;
}

/** the clear ground a cast is stood on wants about it (m), and how far from the world's middle it is looked for */
export const EASE = 0.7, SEEK = 14;

/**
 * The floor under a point of a world that names no floor: the lowest face over it (a world's ground lies under what
 * is built on it), else the lowest the world goes. `faces` in metres.
 */
export function floorUnder(faces, [x, y]) {
  let under = Infinity, low = Infinity;
  for (const f of faces ?? []) {
    const P = f?.corners;
    if (!Array.isArray(P) || P.length < 3) continue;
    for (let n = 1; n + 1 < P.length; n++) {
      const A = P[0], B = P[n], C = P[n + 1];
      low = Math.min(low, A[2], B[2], C[2]);
      const det = (B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1]);
      if (Math.abs(det) < 1e-9) continue;
      const u = ((x - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (y - A[1])) / det, v = ((B[0] - A[0]) * (y - A[1]) - (x - A[0]) * (B[1] - A[1])) / det;
      if (u < 0 || v < 0 || u + v > 1) continue;
      under = Math.min(under, A[2] + u * (B[2] - A[2]) + v * (C[2] - A[2]));
    }
  }
  return r3(Number.isFinite(under) ? under : Number.isFinite(low) ? low : 0);
}

/** Whether a face lies over a point of the floor, above a head: a roof, a ceiling, the top of the thing it is inside */
function roofed(faces, [x, y]) {
  for (const f of faces) {
    const P = f?.corners;
    if (!Array.isArray(P) || P.length < 3) continue;
    for (let n = 1; n + 1 < P.length; n++) {
      const A = P[0], B = P[n], C = P[n + 1];
      if (Math.max(A[2], B[2], C[2]) <= HEAD) continue;
      const det = (B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1]);
      if (Math.abs(det) < 1e-9) continue;
      const u = ((x - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (y - A[1])) / det, v = ((B[0] - A[0]) * (y - A[1]) - (x - A[0]) * (B[1] - A[1])) / det;
      if (u >= 0 && v >= 0 && u + v <= 1 && A[2] + u * (B[2] - A[2]) + v * (C[2] - A[2]) > HEAD) return true;
    }
  }
  return false;
}

/** The middle of a world's faces from above, [x, y] */
export function middleOf(faces) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const f of faces ?? []) for (const p of f?.corners ?? []) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  return Number.isFinite(x0) ? [r3((x0 + x1) / 2), r3((y0 + y1) / 2)] : [0, 0];
}

/**
 * Where a cast is stood in a world that names no place: the clear ground nearest `near` with room for a line of
 * figures `width` metres long (along x) and EASE about it, looked for outward ring by ring to SEEK. `faces` in the
 * scene's frame (the floor at z 0). Ground under the open sky is taken before ground under a roof. `near` itself when
 * the world is bare there or nothing nearer is clear.
 */
export function openGround(faces, near, { width = 0, seek = SEEK } = {}) {
  const { blocks } = standingOf(faces, { about: [near], reach: seek + width });
  const off = (p) => Math.min(Infinity, ...blocks.map((B) => Math.hypot(Math.max(B.min[0] - p[0], 0, p[0] - B.max[0]), Math.max(B.min[1] - p[1], 0, p[1] - B.max[1]))));
  const line = (p) => [-width / 2, 0, width / 2].map((dx) => [p[0] + dx, p[1]]);
  const clear = (p) => line(p).every((q) => off(q) >= EASE);
  // (under the open sky first: the middle of an object, a statue, a tower, is inside it, clear of its own walls;
  // only a world roofed all over is stood in under its roof)
  for (const open of [true, false]) {
    const ok = (p) => clear(p) && !(open && line(p).some((q) => roofed(faces, q)));
    if (ok(near)) return [r3(near[0]), r3(near[1])];
    for (let r = 0.4; r <= seek; r += 0.4) {
      const n = Math.max(8, Math.round((2 * Math.PI * r) / 0.4));
      // (from the south round: a scene's first camera stands on the cast's south side)
      for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n, p = [near[0] + Math.cos(a) * r, near[1] + Math.sin(a) * r]; if (ok(p)) return [r3(p[0]), r3(p[1])]; }
    }
  }
  return [r3(near[0]), r3(near[1])];
}
