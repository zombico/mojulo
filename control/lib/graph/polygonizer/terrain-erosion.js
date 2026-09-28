/**
 * terrain-erosion — landforms by process. A heightfield is cut by water and slumps under
 * gravity, deterministically:
 *
 *   1. drainage: priority-flood (Barnes et al. 2014) with an ε gradient, so every cell drains to the grid's edge
 *      (the base level) — lakes become sills, no pit traps a river;
 *   2. flow: each cell sends its rain to its steepest downhill neighbour (D8); accumulation A is the drained area;
 *   3. incision: stream power, solved implicitly from the outlets upward (the FastScape scheme, Braun & Willett 2013):
 *      z ← (z + F·z_receiver) / (1 + F), F = strength · ((A − A_c) / A_max)^m. Unconditionally stable, so big rivers
 *      cut to near their base level while small gullies barely move — the concave river profile and the dendritic
 *      network come out of the rule, not out of noise. Below the channel head A_c (`channelHead` × the cell count)
 *      water sheets instead of cutting: hillslopes only slump (4), so ridges stay ridges;
 *   4. hillslopes: thermal relaxation, material moving down any slope steeper than the talus angle (Jacobi: every
 *      cell reads the same state, so the result does not depend on scan order).
 *
 * Why it belongs beside the rock: fracture roughness (H ≈ 0.8) sets a rock's skin, but above outcrop scale the
 * measured relief is smoother (H ≈ 0.5) and organised into valleys. That law is made by this process.
 *
 * Rock: an optional `hardness(k, z)` → 0 soil … 1 bedrock scales incision by (1 − 0.9·h) and
 * raises the slump angle from `talus` toward 82°, so rivers cut soft beds and not hard ones and bedrock holds its face.
 * It is read again every step, so a bed registered as a function of height is the bed the surface has cut down to.
 * Absent, the arithmetic is the plain path's, bit for bit.
 *
 * Pure: typed arrays, no dice, no clock. Same field and spec → the same eroded field.
 */

export const EROSION_DEFAULTS = Object.freeze({ steps: 60, strength: 0.5, m: 0.5, talus: 35, thermal: 0.25, res: 128, channelHead: 0.002 });
export const HARD_RESIST = 0.9;
export const HARD_CLIFF_DEG = 82;

// a binary min-heap on (height, index): ties break by index, so the flood order is total and deterministic
function makeHeap(cap) {
  const hv = new Float64Array(cap), ix = new Int32Array(cap); let n = 0;
  const less = (a, b) => hv[a] < hv[b] || (hv[a] === hv[b] && ix[a] < ix[b]);
  const swap = (a, b) => { const t = hv[a]; hv[a] = hv[b]; hv[b] = t; const u = ix[a]; ix[a] = ix[b]; ix[b] = u; };
  return {
    get size() { return n; },
    push(h, i) { hv[n] = h; ix[n] = i; let c = n++; while (c > 0) { const p = (c - 1) >> 1; if (!less(c, p)) break; swap(c, p); c = p; } },
    pop() { const out = ix[0]; n--; if (n > 0) { hv[0] = hv[n]; ix[0] = ix[n]; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < n && less(l, m)) m = l; if (r < n && less(r, m)) m = r; if (m === c) break; swap(c, m); c = m; } } return out; },
  };
}
const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Priority-flood with ε: the depression-filled surface every cell can drain across. */
export function priorityFlood(z, nx, ny, eps = 1e-7) {
  const N = nx * ny; const f = Float64Array.from(z); const done = new Uint8Array(N); const heap = makeHeap(N);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) { const k = j * nx + i; done[k] = 1; heap.push(f[k], k); }
  while (heap.size) {
    const k = heap.pop(); const i = k % nx, j = (k / nx) | 0;
    for (const [di, dj] of NB) {
      const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= ny) continue; const q = b * nx + a; if (done[q]) continue;
      done[q] = 1; if (f[q] <= f[k] + eps) f[q] = f[k] + eps; heap.push(f[q], q);
    }
  }
  return f;
}

/** D8 receivers on a filled surface (−1 at the edge / outlets) and the cells ordered from outlets upward. */
export function drainage(filled, nx, ny, cell = 1) {
  const N = nx * ny; const rec = new Int32Array(N).fill(-1);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i; if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) continue;
    let best = 0, r = -1;
    for (const [di, dj] of NB) { const q = (j + dj) * nx + (i + di); const s = (filled[k] - filled[q]) / (cell * Math.hypot(di, dj)); if (s > best) { best = s; r = q; } }
    rec[k] = r;
  }
  const order = Array.from({ length: N }, (_, k) => k).sort((a, b) => filled[a] - filled[b] || a - b);   // outlets first
  const area = new Float64Array(N).fill(1);
  for (let t = N - 1; t >= 0; t--) { const k = order[t]; if (rec[k] >= 0) area[rec[k]] += area[k]; }  // donors before receivers
  return { rec, order, area };
}

/** Erode a heightfield (row-major Float64Array, nx × ny, `cell` world units per cell). → { z, stats }. */
export function erodeHeightfield(z0, nx, ny, cell, spec = {}, { hardness = null } = {}) {
  const o = { ...EROSION_DEFAULTS, ...spec };
  const z = Float64Array.from(z0); const N = nx * ny; const talus = Math.tan((o.talus * Math.PI) / 180);
  const hard = hardness ? new Float64Array(N) : null;
  let maxArea = 1;
  for (let step = 0; step < o.steps; step++) {
    if (hard) for (let k = 0; k < N; k++) hard[k] = hardness(k, z[k]);
    const filled = priorityFlood(z, nx, ny); const { rec, order, area } = drainage(filled, nx, ny, cell);
    maxArea = 0; for (let k = 0; k < N; k++) if (area[k] > maxArea) maxArea = area[k];
    // implicit stream power, receivers first
    const Ac = Math.max(2, o.channelHead * N);
    for (const k of order) {
      const r = rec[k]; if (r < 0 || area[k] <= Ac) continue;
      const F = hard ? o.strength * (1 - HARD_RESIST * hard[k]) * ((area[k] - Ac) / maxArea) ** o.m : o.strength * ((area[k] - Ac) / maxArea) ** o.m;
      const zn = (z[k] + F * z[r]) / (1 + F);
      if (zn < z[k] && zn >= z[r]) z[k] = zn;                   // cut toward the receiver, never below it
    }
    // thermal relaxation (Jacobi): move part of the excess over the talus slope downhill
    if (o.thermal > 0) {
      const dz = new Float64Array(N);
      for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
        const k = j * nx + i; const crit = hard ? Math.tan(((o.talus + (HARD_CLIFF_DEG - o.talus) * hard[k]) * Math.PI) / 180) : talus;
        for (const [di, dj] of NB) {
          const q = (j + dj) * nx + (i + di); const d = cell * Math.hypot(di, dj); const excess = z[k] - z[q] - crit * d;
          if (excess > 0) { const m = (o.thermal * excess) / 16; dz[k] -= m; dz[q] += m; }
        }
      }
      for (let k = 0; k < N; k++) z[k] += dz[k];
    }
  }
  return { z, stats: { steps: o.steps, maxArea } };
}

/** Bilinear sampler over a grid spanning [x0, x1] × [y0, y1]; clamps outside. Also its central-difference gradient. */
export function gridSampler(z, nx, ny, x0, x1, y0, y1) {
  const dx = (x1 - x0) / (nx - 1), dy = (y1 - y0) / (ny - 1);
  const at = (x, y) => {
    const u = Math.min(Math.max((x - x0) / dx, 0), nx - 1), v = Math.min(Math.max((y - y0) / dy, 0), ny - 1);
    const i = Math.min(Math.floor(u), nx - 2), j = Math.min(Math.floor(v), ny - 2), fu = u - i, fv = v - j;
    const a = z[j * nx + i], b = z[j * nx + i + 1], c = z[(j + 1) * nx + i], d = z[(j + 1) * nx + i + 1];
    return (a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + d * fu) * fv;
  };
  const grad = (x, y) => [(at(x + dx, y) - at(x - dx, y)) / (2 * dx), (at(x, y + dy) - at(x, y - dy)) / (2 * dy)];
  return { at, grad, dx, dy };
}

/** Errors (strings) for an `erosion` spec. */
export function validateErosion(e, at = 'erosion') {
  if (e === true) return [];
  if (!e || typeof e !== 'object' || Array.isArray(e)) return [`${at} must be true or { steps?, strength?, talus?, res? }`];
  const errs = []; const inRange = (k, lo, hi, what) => { if (e[k] !== undefined && !(Number.isFinite(e[k]) && e[k] >= lo && e[k] <= hi)) errs.push(`${at}.${k} must be ${what}`); };
  if (e.steps !== undefined && !(Number.isInteger(e.steps) && e.steps >= 1 && e.steps <= 300)) errs.push(`${at}.steps must be an integer 1–300 (iterations of rain; cost is linear)`);
  inRange('strength', 0, 2, 'a number 0–2 (how hard the rivers cut; 0.5 default)');
  inRange('talus', 10, 60, 'an angle 10–60° (slopes steeper than this slump; 35 default)');
  if (e.res !== undefined && !(Number.isInteger(e.res) && e.res >= 32 && e.res <= 256)) errs.push(`${at}.res must be an integer 32–256 (grid cells along the longer side; cost grows with its square)`);
  return errs;
}
