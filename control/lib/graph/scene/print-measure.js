/**
 * print-measure — the print leg's MEASURED printability facts
 * (text-to-cad-seam.plan.md T2; the second rung under print-advisory.js).
 *
 * The closure audit says whether the rims are closed; the Manifold union says
 * what the volume is; the slicer says whether it slices. None of them says the
 * two things a printer operator looks for first when the file opens: WHERE it
 * overhangs, and whether a wall the recipe never declared is thinner than the
 * nozzle. Both were eyes-gate catches on real objects (the hook's J arm; the
 * chariot's rail) that the machine gate had waved through. This module
 * measures them over the exported soup — the same millimetre triangles the
 * STL / 3MF carry — and hands back numbers the advisories word.
 *
 * What it is NOT (cad-aid.plan.md, settled): no distance field, no repair, no
 * topology, nothing in the recipe. Overhang is a per-triangle fact against
 * the build direction. Walls are a SAMPLE — one inward ray per sampled
 * triangle, counting shell depth (+1 entering a shell, −1 leaving one, stop
 * at zero) — so an un-unioned stack of overlapping shells reads the UNION's
 * depth, not the overlap gap. A face buried inside another shell (its outward
 * ray first meets some shell's exit face) is skipped in both passes: the
 * print has no surface there. A wall thinner along a diagonal than along its
 * normal still under-reports. The result says `sampled`, `buried`, and
 * `measured`; the advisory says "sampled". Support volume is a column-to-bed
 * BOUND, named as such. The ceiling of a closed cavity IS an overhang (a
 * bridge) and is reported as one.
 *
 * Pure: Float32 soup in, plain object out. No three.js, no DB. Deterministic
 * (a stride sample, never dice).
 *
 * Record — the hook (`sk_hpr0rf20ik`, 81 × 30 × 33 mm, 316 triangles), 2026-09-08:
 * overhang 1,125.71 mm² (14% of 8,158 mm², steepest 90°, 26 faces), support
 * footprint 1,088 mm², best axis y+ (420 mm² — on its side, the demo plan's own
 * guess), walls thinnest 4 mm (the jaw), p05 9.68, 25 buried + 2 coincident of
 * 316 samples. PrusaSlicer's stamp for the same file: `supports: false`. Eyes
 * gate (the slicer's overhang paint against `overhang.faces`) still open.
 */

import { printableShells, applyTransform } from './scene-stl.js';

const AXES = {
  'x+': [1, 0, 0], 'x-': [-1, 0, 0],
  'y+': [0, 1, 0], 'y-': [0, -1, 0],
  'z+': [0, 0, 1], 'z-': [0, 0, -1],
};

/**
 * printSoup(payload, { scale }) → Float32Array of triangle positions in mm
 * (9 floats per triangle), the exact set the STL writes: printable faces +
 * every repeat instance expanded, zero-area slivers dropped. Null when nothing
 * prints. The one soup both tools measure so their numbers agree.
 */
export function printSoup(payload, { scale = 1 } = {}) {
  const shells = printableShells(payload);
  if (!shells) return null;
  const soups = [shells.base ? shells.base.positions : new Float32Array(0)];
  for (const r of shells.repeats) {
    const tpl = r.positions;
    for (const t of r.transforms) {
      const inst = new Float32Array(tpl.length);
      for (let i = 0; i < tpl.length; i += 3) {
        const [x, y, z] = applyTransform(t, tpl[i], tpl[i + 1], tpl[i + 2]);
        inst[i] = x; inst[i + 1] = y; inst[i + 2] = z;
      }
      soups.push(inst);
    }
  }
  let total = 0;
  for (const s of soups) total += s.length - (s.length % 9);
  const out = new Float32Array(total);
  let o = 0;
  for (const s of soups) {
    for (let i = 0; i + 9 <= s.length; i += 9) {
      const ax = s[i] * scale, ay = s[i + 1] * scale, az = s[i + 2] * scale;
      const bx = s[i + 3] * scale, by = s[i + 4] * scale, bz = s[i + 5] * scale;
      const cx = s[i + 6] * scale, cy = s[i + 7] * scale, cz = s[i + 8] * scale;
      const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (!(nx * nx + ny * ny + nz * nz > 0)) continue;
      out[o++] = ax; out[o++] = ay; out[o++] = az;
      out[o++] = bx; out[o++] = by; out[o++] = bz;
      out[o++] = cx; out[o++] = cy; out[o++] = cz;
    }
  }
  return o ? out.subarray(0, o) : null;
}

// Per-triangle normal (unit, right-hand rule over the winding), area, centroid.
function triangleFacts(p) {
  const n = p.length / 9;
  const normals = new Float32Array(n * 3);
  const areas = new Float32Array(n);
  const centroids = new Float32Array(n * 3);
  for (let t = 0; t < n; t++) {
    const i = t * 9;
    const ax = p[i], ay = p[i + 1], az = p[i + 2];
    const bx = p[i + 3], by = p[i + 4], bz = p[i + 5];
    const cx = p[i + 6], cy = p[i + 7], cz = p[i + 8];
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    areas[t] = len / 2;
    if (len > 0) { nx /= len; ny /= len; nz /= len; }
    normals[t * 3] = nx; normals[t * 3 + 1] = ny; normals[t * 3 + 2] = nz;
    centroids[t * 3] = (ax + bx + cx) / 3; centroids[t * 3 + 1] = (ay + by + cy) / 3; centroids[t * 3 + 2] = (az + bz + cz) / 3;
  }
  return { n, normals, areas, centroids };
}

const r2 = (v) => Math.round(v * 100) / 100;

/**
 * overhangPass(facts, d, { limitDeg, layerMm }) — the per-triangle fact against
 * one build direction `d` (unit). A face needs support when its surface tilts
 * more than `limitDeg` from vertical while facing DOWN: −n·d > sin(limit).
 * Faces whose centroid sits within `layerMm` of the lowest point along `d`
 * are the first layer (bed contact), exempt and reported apart.
 */
function overhangPass(p, facts, d, { limitDeg, layerMm, isBuried = null }) {
  const { n, normals, areas, centroids } = facts;
  const sinLimit = Math.sin((limitDeg * Math.PI) / 180);
  // the bed is the model's LOWEST VERTEX along the build direction
  let minH = Infinity;
  for (let i = 0; i < p.length; i += 3) {
    const h = p[i] * d[0] + p[i + 1] * d[1] + p[i + 2] * d[2];
    if (h < minH) minH = h;
  }
  let area = 0, footprint = 0, volume = 0, total = 0, bed = 0, worst = 0, faces = 0, buried = 0;
  const which = [];
  for (let t = 0; t < n; t++) {
    const a = areas[t];
    total += a;
    const down = -(normals[t * 3] * d[0] + normals[t * 3 + 1] * d[1] + normals[t * 3 + 2] * d[2]);
    if (!(down > 0)) continue;
    const h = centroids[t * 3] * d[0] + centroids[t * 3 + 1] * d[1] + centroids[t * 3 + 2] * d[2] - minH;
    if (h <= layerMm) { bed += a * down; continue; }
    if (down <= sinLimit) continue;
    // a down-facing face buried inside another shell is not a surface the print has
    if (isBuried && isBuried(t)) { buried++; continue; }
    const deg = (Math.asin(Math.min(1, down)) * 180) / Math.PI;
    if (deg > worst) worst = deg;
    area += a;
    footprint += a * down;
    volume += a * down * h;
    faces++;
    which.push(t);
  }
  return { area, footprint, volume, total, bed, worst, faces, buried, which };
}

// ── walls: one inward ray per sampled triangle against a uniform grid ────────

function buildGrid(p, facts) {
  const { n } = facts;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) {
    for (let k = 0; k < 3; k++) { const v = p[i + k]; if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v; }
  }
  const size = [max[0] - min[0] || 1e-6, max[1] - min[1] || 1e-6, max[2] - min[2] || 1e-6];
  // cells ≈ triangles, capped so a giant soup does not allocate a giant grid
  const target = Math.min(Math.max(1, n), 200_000);
  const vol = size[0] * size[1] * size[2];
  const cell = Math.max(Math.cbrt(vol / target), Math.max(...size) / 128);
  const dims = size.map((s) => Math.max(1, Math.min(128, Math.ceil(s / cell) + 1)));
  const cells = new Array(dims[0] * dims[1] * dims[2]);
  const idx = (ix, iy, iz) => (ix * dims[1] + iy) * dims[2] + iz;
  const clampI = (v, k) => Math.min(dims[k] - 1, Math.max(0, Math.floor((v - min[k]) / cell)));
  for (let t = 0; t < n; t++) {
    const i = t * 9;
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let v = 0; v < 3; v++) for (let k = 0; k < 3; k++) { const c = p[i + v * 3 + k]; if (c < lo[k]) lo[k] = c; if (c > hi[k]) hi[k] = c; }
    const a = lo.map((v, k) => clampI(v, k)), b = hi.map((v, k) => clampI(v, k));
    for (let ix = a[0]; ix <= b[0]; ix++) for (let iy = a[1]; iy <= b[1]; iy++) for (let iz = a[2]; iz <= b[2]; iz++) {
      const c = idx(ix, iy, iz);
      (cells[c] || (cells[c] = [])).push(t);
    }
  }
  return { min, max, cell, dims, cells, idx, clampI };
}

// Möller–Trumbore; returns t or null. `p` soup, triangle `tri`.
function rayTri(p, tri, ox, oy, oz, dx, dy, dz) {
  const i = tri * 9;
  const ax = p[i], ay = p[i + 1], az = p[i + 2];
  const e1x = p[i + 3] - ax, e1y = p[i + 4] - ay, e1z = p[i + 5] - az;
  const e2x = p[i + 6] - ax, e2y = p[i + 7] - ay, e2z = p[i + 8] - az;
  const hx = dy * e2z - dz * e2y, hy = dz * e2x - dx * e2z, hz = dx * e2y - dy * e2x;
  const det = e1x * hx + e1y * hy + e1z * hz;
  if (Math.abs(det) < 1e-12) return null;
  const inv = 1 / det;
  const sx = ox - ax, sy = oy - ay, sz = oz - az;
  const u = (sx * hx + sy * hy + sz * hz) * inv;
  if (u < -1e-9 || u > 1 + 1e-9) return null;
  const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
  const v = (dx * qx + dy * qy + dz * qz) * inv;
  if (v < -1e-9 || u + v > 1 + 1e-9) return null;
  const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return t > 0 ? t : null;
}

// Walk the grid along the ray (3-D DDA) and return EVERY hit as
// [{ t, exit }] sorted by t, where `exit` means the triangle's outward normal
// points along the ray (the ray leaves that shell there).
function castAll(p, facts, grid, ox, oy, oz, dx, dy, dz, eps) {
  const { min, cell, dims, cells, idx, clampI } = grid;
  const o = [ox, oy, oz], d = [dx, dy, dz];
  const ci = [clampI(ox, 0), clampI(oy, 1), clampI(oz, 2)];
  const step = d.map((v) => (v > 0 ? 1 : v < 0 ? -1 : 0));
  const tMax = [0, 0, 0], tDelta = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    if (step[k] === 0) { tMax[k] = Infinity; tDelta[k] = Infinity; continue; }
    const edge = min[k] + (ci[k] + (step[k] > 0 ? 1 : 0)) * cell;
    tMax[k] = (edge - o[k]) / d[k];
    tDelta[k] = cell / Math.abs(d[k]);
  }
  const hits = [];
  const seen = new Set();
  for (let guard = 0; guard < dims[0] + dims[1] + dims[2] + 3; guard++) {
    const list = cells[idx(ci[0], ci[1], ci[2])];
    if (list) {
      for (const tri of list) {
        if (seen.has(tri)) continue;
        seen.add(tri);
        const t = rayTri(p, tri, ox, oy, oz, dx, dy, dz);
        if (t == null || t <= eps) continue;
        const facing = facts.normals[tri * 3] * dx + facts.normals[tri * 3 + 1] * dy + facts.normals[tri * 3 + 2] * dz;
        hits.push({ t, exit: facing > 0 });
      }
    }
    const k = tMax[0] < tMax[1] ? (tMax[0] < tMax[2] ? 0 : 2) : (tMax[1] < tMax[2] ? 1 : 2);
    ci[k] += step[k];
    if (ci[k] < 0 || ci[k] >= dims[k]) break;
    tMax[k] += tDelta[k];
  }
  hits.sort((a, b) => a.t - b.t);
  return hits;
}

// A point a hair OUTSIDE face `t` is buried when the first thing its outward
// ray meets is the exit face of some other shell — i.e. it sits inside that
// shell. Overlapping un-unioned parts leave such faces everywhere; the print
// has no surface there.
function buriedTester(p, facts, grid, eps) {
  const { normals, centroids } = facts;
  return (t) => {
    const nx = normals[t * 3], ny = normals[t * 3 + 1], nz = normals[t * 3 + 2];
    const cx = centroids[t * 3], cy = centroids[t * 3 + 1], cz = centroids[t * 3 + 2];
    const hits = castAll(p, facts, grid, cx + nx * eps, cy + ny * eps, cz + nz * eps, nx, ny, nz, eps);
    return hits.length > 0 && hits[0].exit;
  };
}

// The union's depth along the inward normal: start inside ONE shell, enter
// (+1) on a front face, leave (−1) on an exit face, stop at zero. Hits closer
// than `touch` are COINCIDENT geometry — two parts meeting face to face (a
// sweep's cap on the wall it grows from) — not a wall; they are skipped and
// counted, so a flush joint does not read as a 0.01 mm wall.
function inwardDepth(p, facts, grid, t, eps, touch) {
  const { normals, centroids } = facts;
  const nx = normals[t * 3], ny = normals[t * 3 + 1], nz = normals[t * 3 + 2];
  const cx = centroids[t * 3], cy = centroids[t * 3 + 1], cz = centroids[t * 3 + 2];
  const hits = castAll(p, facts, grid, cx - nx * eps, cy - ny * eps, cz - nz * eps, -nx, -ny, -nz, eps);
  let depth = 1, coincident = 0;
  for (const h of hits) {
    if (h.t < touch) { coincident++; continue; }
    depth += h.exit ? -1 : 1;
    if (depth <= 0) return { d: h.t, coincident };
  }
  return { d: null, coincident };
}

function wallsPass(p, facts, grid, eps, { sample, floorMm, isBuried }) {
  const { n, areas } = facts;
  if (!n) return { measured: false, reason: 'no triangles', min_mm: null, p05_mm: null, sampled: 0, under_floor_mm2: 0 };
  const stride = Math.max(1, Math.ceil(n / sample));
  // a hair of the model's size: anything nearer is touching, not a wall (0.09 mm on a 90 mm part)
  const touch = Math.max(eps * 10, Math.max(...grid.max.map((v, k) => v - grid.min[k])) * 1e-3);
  const dists = [];
  let nulls = 0, buried = 0, coincident = 0, sampledArea = 0, thinArea = 0, totalArea = 0, sampled = 0;
  for (let t = 0; t < n; t++) totalArea += areas[t];
  for (let t = 0; t < n; t += stride) {
    if (!(areas[t] > 0)) continue;
    sampled++;
    if (isBuried(t)) { buried++; continue; }
    const r = inwardDepth(p, facts, grid, t, eps, touch);
    coincident += r.coincident;
    sampledArea += areas[t];
    if (r.d == null) { nulls++; continue; }
    dists.push(r.d);
    if (r.d < floorMm) thinArea += areas[t];
  }
  const live = sampled - buried;
  if (!dists.length || nulls > live / 2) {
    return { measured: false, reason: nulls ? `${nulls} of ${live} inward rays found no far side — open shells or inward-facing faces` : 'no sample', min_mm: null, p05_mm: null, sampled, buried, unresolved: nulls, coincident, under_floor_mm2: 0 };
  }
  dists.sort((a, b) => a - b);
  const p05 = dists[Math.min(dists.length - 1, Math.floor(dists.length * 0.05))];
  const scaleUp = sampledArea > 0 ? totalArea / sampledArea : 1;
  return { measured: true, min_mm: r2(dists[0]), p05_mm: r2(p05), median_mm: r2(dists[Math.floor(dists.length / 2)]), sampled, buried, unresolved: nulls, coincident, touch_mm: r2(touch), under_floor_mm2: r2(thinArea * scaleUp) };
}

/**
 * measurePrintability({ positions, printer, sample, walls }) → {
 *   triangles, area_mm2, bed_contact_mm2,
 *   overhang:    { limit_deg, worst_deg, area_mm2, fraction, faces } | null (powder),
 *   support:     { footprint_mm2, volume_mm3_upper } | null,
 *   walls:       { measured, min_mm, p05_mm, median_mm, sampled, unresolved, under_floor_mm2 },
 *   orientation: { best, footprint_mm2_by_axis }
 * }
 * `positions` is the mm soup from `printSoup`; `printer` a resolved profile
 * (print-advisory `resolvePrinter`): `self_support_deg` (null = the process
 * supports everything → overhang/support/orientation are null), `layer_mm`,
 * `min_wall_mm`. `sample` caps the wall rays (default 20,000); `walls: false`
 * skips them. Build direction is +z (the export frame); the orientation hint
 * tries all six axes.
 */
export function measurePrintability({ positions, printer, sample = 20_000, walls = true } = {}) {
  if (!positions || !positions.length) return null;
  const facts = triangleFacts(positions);
  const layerMm = Number.isFinite(printer?.layer_mm) ? printer.layer_mm : 0.2;
  const floorMm = Number.isFinite(printer?.min_wall_mm) ? printer.min_wall_mm : 0.8;
  const limitDeg = printer?.self_support_deg;
  let totalArea = 0;
  for (let t = 0; t < facts.n; t++) totalArea += facts.areas[t];
  const grid = buildGrid(positions, facts);
  const eps = Math.max(1e-6, Math.max(...grid.max.map((v, k) => v - grid.min[k])) * 1e-6);
  const isBuried = buriedTester(positions, facts, grid, eps);
  const out = { triangles: facts.n, area_mm2: r2(totalArea), bed_contact_mm2: null, overhang: null, support: null, walls: null, orientation: null };
  if (limitDeg != null) {
    const byAxis = {};
    let best = 'z+', bestFoot = Infinity;
    let primary = null;
    // the buried test costs a ray per candidate face; past the sample budget every
    // pass goes unfiltered and says so (`buried_filtered: false`) — union first for exact numbers
    const filtered = facts.n <= sample;
    for (const [name, d] of Object.entries(AXES)) {
      const r = overhangPass(positions, facts, d, { limitDeg, layerMm, isBuried: filtered ? isBuried : null });
      byAxis[name] = r2(r.footprint);
      if (name === 'z+') primary = r;
      if (r.footprint < bestFoot - 1e-9) { bestFoot = r.footprint; best = name; }
    }
    // ties keep the export's own frame
    if (Math.abs(byAxis['z+'] - r2(bestFoot)) < 1e-9) best = 'z+';
    out.bed_contact_mm2 = r2(primary.bed);
    out.overhang = { limit_deg: limitDeg, worst_deg: r2(primary.worst), area_mm2: r2(primary.area), fraction: totalArea > 0 ? Math.round((primary.area / totalArea) * 1000) / 1000 : 0, faces: primary.faces, buried_skipped: primary.buried };
    out.support = { footprint_mm2: r2(primary.footprint), volume_mm3_upper: r2(primary.volume) };
    out.orientation = { best, footprint_mm2_by_axis: byAxis, buried_filtered: filtered };
  } else {
    const r = overhangPass(positions, facts, AXES['z+'], { limitDeg: 89.9, layerMm });
    out.bed_contact_mm2 = r2(r.bed);
  }
  out.walls = walls ? wallsPass(positions, facts, grid, eps, { sample, floorMm, isBuried }) : { measured: false, reason: 'walls: false', min_mm: null, p05_mm: null, sampled: 0, under_floor_mm2: 0 };
  return out;
}

/** measureLine(m) → one README / note sentence for the measurement, or the skip reason. */
export function measureLine(m) {
  if (!m) return 'measured printability: nothing printable to measure';
  const parts = [];
  if (m.overhang) {
    parts.push(m.overhang.area_mm2 > 0
      ? `overhang ${m.overhang.area_mm2} mm² (${Math.round(m.overhang.fraction * 100)}% of ${m.area_mm2} mm², steepest ${Math.round(m.overhang.worst_deg)}° vs the ${m.overhang.limit_deg}° limit; support footprint ≈${m.support.footprint_mm2} mm²)`
      : `no overhang past ${m.overhang.limit_deg}° (${m.area_mm2} mm² of surface)`);
    if (m.orientation && m.orientation.best !== 'z+') parts.push(`least support built along ${m.orientation.best}`);
  } else {
    parts.push(`overhang not judged (the process supports everything; ${m.area_mm2} mm² of surface)`);
  }
  if (m.walls?.measured) parts.push(`walls sampled ${m.walls.sampled}×: thinnest ${m.walls.min_mm} mm, p05 ${m.walls.p05_mm} mm, median ${m.walls.median_mm} mm`);
  else if (m.walls) parts.push(`walls not measured (${m.walls.reason})`);
  return `measured printability: ${parts.join('; ')}`;
}
