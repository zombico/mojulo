/**
 * Shoot plan — clearance: does a camera's move pass through the world? Each camera's per-frame track is walked as a
 * chain of short segments and every segment is tested against the world's faces (fanned into triangles, found
 * through a coarse xy grid). A crossing is reported once per run of frames that keep crossing, with the time and
 * the point, so "the dolly drives through the bus shelter at 2.4 s" is a readout line, not a surprise in the render.
 *
 * Static geometry only: what moves (cars, walkers) is not a face, so a camera that rides close behind a car is not
 * flagged for it. Advisory, like every gate: it reports, it never refuses. Pure.
 */
import { sampleCameraTrack } from './sample.js';

const EPS = 1e-9;

// segment p→q against triangle (a,b,c): the hit parameter in [0,1], or -1 (Möller–Trumbore)
function segTri(p, d, a, b, c) {
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const h = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
  const det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
  if (Math.abs(det) < EPS) return -1;
  const inv = 1 / det, s = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const u = inv * (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]);
  if (u < 0 || u > 1) return -1;
  const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
  const v = inv * (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]);
  if (v < 0 || u + v > 1) return -1;
  const t = inv * (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]);
  return t >= 0 && t <= 1 ? t : -1;
}

function buildGrid(faces) {
  const tris = [];
  for (const f of faces) {
    const c = f && f.corners;
    if (!Array.isArray(c) || c.length < 3) continue;
    for (let i = 1; i + 1 < c.length; i++) tris.push([c[0], c[i], c[i + 1]]);
  }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const t of tris) for (const p of t) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  const N = 64, cw = Math.max(1e-6, (x1 - x0) / N), ch = Math.max(1e-6, (y1 - y0) / N);
  const cells = new Map();
  const cx = (x) => Math.max(0, Math.min(N - 1, Math.floor((x - x0) / cw))), cy = (y) => Math.max(0, Math.min(N - 1, Math.floor((y - y0) / ch)));
  tris.forEach((t, ti) => {
    const xs = t.map((p) => p[0]), ys = t.map((p) => p[1]);
    for (let i = cx(Math.min(...xs)); i <= cx(Math.max(...xs)); i++) for (let j = cy(Math.min(...ys)); j <= cy(Math.max(...ys)); j++) {
      const k = i * N + j;
      if (!cells.has(k)) cells.set(k, []);
      cells.get(k).push(ti);
    }
  });
  return { tris, cells, cx, cy, N, empty: !tris.length };
}

/**
 * The places a plan's cameras pass through the world's faces: `[{ camera, t, at }]`, the first frame of each run of
 * crossing frames, in camera-local (world-clock) seconds, at most `max` in all.
 */
export function shootClearance(plan, faces, { subjects = null, max = 12 } = {}) {
  const grid = buildGrid(Array.isArray(faces) ? faces : []);
  if (grid.empty) return [];
  const hits = [];
  const stamp = new Int32Array(grid.tris.length).fill(-1);
  let seg = 0;
  for (const cam of plan.cameras) {
    const tr = sampleCameraTrack(cam, plan.fps, { subjects });
    let crossing = false;
    for (let j = 1; j < tr.n && hits.length < max; j++) {
      const p = tr.pos.slice((j - 1) * 3, j * 3), q = tr.pos.slice(j * 3, j * 3 + 3);
      const d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
      let hit = -1;
      seg += 1;
      for (let i = grid.cx(Math.min(p[0], q[0])); i <= grid.cx(Math.max(p[0], q[0])) && hit < 0; i++) {
        for (let k = grid.cy(Math.min(p[1], q[1])); k <= grid.cy(Math.max(p[1], q[1])) && hit < 0; k++) {
          for (const ti of grid.cells.get(i * grid.N + k) || []) {
            if (stamp[ti] === seg) continue;
            stamp[ti] = seg;
            const t = grid.tris[ti];
            const h = segTri(p, d, t[0], t[1], t[2]);
            if (h >= 0) { hit = h; break; }
          }
        }
      }
      if (hit >= 0 && !crossing) {
        const r2 = (v) => Math.round(v * 100) / 100;
        hits.push({ camera: cam.id, t: r2(tr.t0 + (j - 1 + hit) / tr.fps), at: [0, 1, 2].map((c) => r2(p[c] + d[c] * hit)) });
      }
      crossing = hit >= 0;
    }
  }
  return hits;
}
