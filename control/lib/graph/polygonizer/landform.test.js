/**
 * landform operators and the sliced mesh. Claims under test, each measured:
 *   peaks  — ridged: the Laplacian is skewed negative (knife crests, broad valleys); a plain fBm's is not
 *   strata — on a ramp, the slopes split into benches and near-vertical risers
 *   scarp  — the throw across mid-trace is the declared throw, the face is steep, the tips taper
 *   joints — on a steep cone, facet aspects crowd onto the joint normals; columns have flat tops; facets never build
 *   talus  — the apron lies at the angle of repose; debris is conserved (supplied = settled + left the map); the rim
 *            is untouched; nothing piles on the border
 *   erosion with hardness — hard beds keep steeper faces; hardness 0 everywhere is the plain path, bit for bit
 *   runner — talus settles after erosion whatever its place in the list; deterministic
 *   mesh   — no cracks (every interior edge is shared by exactly two triangles, displaced or not); flat ground stays
 *            two triangles a quad; a cliff adds polygons in proportion to its height
 */
import { describe, expect, it } from 'vitest';

import { landformGrid, bakeGrid, gridGradient, gridX, gridY, peaks, strata, scarp, joints, talus, applyLandform, validateLandform, gnoise } from './landform.js';
import { slicedTerrainFaces, sliceLevels } from './landform-mesh.js';
import { erodeHeightfield } from './terrain-erosion.js';

const DOM = { x0: 0, x1: 24, y0: 0, y1: 24 };
const grid = (h, res = 97) => bakeGrid(landformGrid({ ...DOM, res }), h);
const slopes = (s) => { const { gx, gy } = gridGradient(s); return Array.from(gx, (v, k) => Math.hypot(v, gy[k])); };
const interior = (s, f) => { const out = []; for (let j = 3; j < s.ny - 3; j++) for (let i = 3; i < s.nx - 3; i++) out.push(f(j * s.nx + i, i, j)); return out; };
const skew = (xs) => { const n = xs.length, m = xs.reduce((a, b) => a + b, 0) / n; const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / n; return xs.reduce((a, b) => a + (b - m) ** 3, 0) / n / v ** 1.5; };
const laplacian = (s) => interior(s, (k) => s.z[k + 1] + s.z[k - 1] + s.z[k + s.nx] + s.z[k - s.nx] - 4 * s.z[k]);
const D = Math.PI / 180;

describe('peaks', () => {
  it('ridged: knife crests and broad valleys skew the Laplacian negative; plain fBm does not', () => {
    const ridged = peaks(grid(() => 0), { height: 6, wavelength: 10, seed: 3 });
    const plain = grid((x, y) => { let v = 0, n = 0; for (let o = 0; o < 4; o++) { const a = 0.5 ** o; v += a * gnoise((x / 10) * 2 ** o, (y / 10) * 2 ** o, 3 + o); n += a; } return 6 * v / n; });
    expect(skew(laplacian(ridged))).toBeLessThan(-0.6);
    expect(Math.abs(skew(laplacian(plain)))).toBeLessThan(0.4);
  });
  it('a massif stays inside its radius', () => {
    const s = peaks(grid(() => 0), { height: 5, wavelength: 8, center: [12, 12], radius: 6, seed: 1 });
    for (let j = 0; j < s.ny; j++) for (let i = 0; i < s.nx; i++) if (Math.hypot(gridX(s, i) - 12, gridY(s, j) - 12) >= 6) expect(s.z[j * s.nx + i]).toBe(0);
  });
});

describe('strata', () => {
  it('a ramp becomes benches and risers', () => {
    const base = grid((x) => 0.4 * x); const before = slopes(base);
    const s = strata(grid((x) => 0.4 * x), { thickness: 1.2, contrast: 1, hardShare: 0.5, seed: 2 });
    const g = slopes(s); const after = interior(s, (k) => g[k]);
    expect(interior(base, (k) => before[k]).every((v) => Math.abs(v - 0.4) < 1e-9)).toBe(true);   // one slope before
    const benches = after.filter((v) => v < 0.2).length / after.length, risers = after.filter((v) => v > Math.tan(60 * D)).length / after.length;
    expect(benches).toBeGreaterThan(0.15);
    expect(risers).toBeGreaterThan(0.02);
    expect(s.strata.layers.some((l) => l.hard) && s.strata.layers.some((l) => !l.hard)).toBe(true);
  });
});

describe('scarp', () => {
  const s = scarp(grid(() => 1), { path: [[2, 12], [22, 12]], throw: 3, face: 75, rough: 0, taper: 0.15, seed: 1 });
  const zAt = (x, y) => s.z[Math.round(y / s.dx) * s.nx + Math.round(x / s.dx)];
  it('mid-trace throw is the declared throw, raised on the left of travel', () => {
    expect(zAt(12, 16) - zAt(12, 8)).toBeGreaterThan(3 * 0.95); expect(zAt(12, 16) - zAt(12, 8)).toBeLessThan(3 * 1.05);
  });
  it('the face is steep and the tips taper', () => {
    let steepest = 0; for (let j = 0; j < s.ny; j++) { const k = j * s.nx + Math.round(12 / s.dx); const g = Math.abs(s.z[Math.min(s.ny - 1, j + 1) * s.nx + Math.round(12 / s.dx)] - s.z[k]) / s.dx; if (g > steepest) steepest = g; }
    expect(steepest).toBeGreaterThan(Math.tan(65 * D));
    expect(zAt(2.6, 16) - zAt(2.6, 8)).toBeLessThan(0.55 * 3);
  });
});

describe('joints', () => {
  const cone = (x, y) => Math.max(0, 14 - 1.4 * Math.hypot(x - 12, y - 12));
  it('blocky facets crowd onto the joint normals, and never build', () => {
    const b = grid(cone); const s = joints(grid(cone), { pattern: 'blocky', spacing: 1.5, strike: 0, steep: 30, seed: 4 });
    const { gx, gy } = gridGradient(s); let onNormal = 0, n = 0, rise = 0;
    for (let k = 0; k < s.z.length; k++) {
      rise = Math.max(rise, s.z[k] - b.z[k]);
      if (s.hard[k] > 0.9 && Math.hypot(gx[k], gy[k]) > 0.5) { const a = ((Math.atan2(gy[k], gx[k]) / D) % 90 + 90) % 90; if (a < 12 || a > 78) onNormal++; n++; }
    }
    expect(n).toBeGreaterThan(200);
    expect(onNormal / n).toBeGreaterThan(0.45);                 // a smooth cone: 24/90 ≈ 0.27
    expect(rise).toBeLessThanOrEqual(0.08 * 1.5 + 1e-9);
  });
  it('columns have flat tops', () => {
    const s = joints(grid(cone), { pattern: 'columnar', spacing: 1.2, steep: 30, seed: 4 });
    const g = slopes(s); const faceted = interior(s, (k) => (s.hard[k] > 0.9 ? g[k] : null)).filter((v) => v !== null);
    expect(faceted.filter((g) => g < 0.15).length / faceted.length).toBeGreaterThan(0.3);
  });
});

describe('talus', () => {
  const cliff = () => scarp(grid(() => 0.5), { path: [[-2, 12], [26, 12]], throw: 4, face: 85, rough: 0, taper: 0, seed: 1 });
  it('debris is conserved, lies at the repose angle, leaves the rim and the border alone', () => {
    const before = cliff(); const s = talus(cliff(), { angle: 34, retreat: 0.4 });
    const settled = s.apron.reduce((a, b) => a + b, 0);
    expect(settled).toBeGreaterThan(0);
    expect(settled + s.talusStats.left).toBeCloseTo(s.talusStats.supplied, 6);
    const g = slopes(s); const nearFace = (i, j) => { for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) if (before.hard[(j + b) * s.nx + i + a] > 0) return true; return false; };
    const apronSlopes = interior(s, (k, i, j) => (s.apron[k] > 0.05 && !nearFace(i, j) ? g[k] : null)).filter((v) => v !== null).sort((a, b) => a - b);   // the apron, not its seam with the face
    expect(apronSlopes.length).toBeGreaterThan(50);
    expect(apronSlopes[Math.floor(0.9 * apronSlopes.length)]).toBeLessThan(Math.tan(40 * D));
    for (let i = 0; i < s.nx; i++) { const k = Math.round(20 / s.dx) * s.nx + i; expect(s.z[k]).toBe(before.z[k]); }   // the plateau above
    for (let j = 0; j < s.ny; j++) for (let i = 0; i < s.nx; i++) if (i === 0 || j === 0 || i === s.nx - 1 || j === s.ny - 1) expect(s.apron[j * s.nx + i]).toBe(0);
  });
  it('scree sits on the apron with a power-law size', () => {
    const s = talus(cliff(), { retreat: 0.4, scree: 0.5, rmin: 0.05, rmax: 0.5, seed: 3 });
    expect(s.scree.length).toBeGreaterThan(20);
    const big = s.scree.filter((r) => r.size > 0.2).length, small = s.scree.filter((r) => r.size < 0.1).length;
    expect(small).toBeGreaterThan(big);
    for (const r of s.scree) expect(r.size).toBeGreaterThanOrEqual(0.05 - 1e-12);
  });
});

describe('erosion with hardness', () => {
  const dome = (x, y) => 6 * Math.exp(-((x - 12) ** 2 + (y - 12) ** 2) / 60);
  it('hardness 0 everywhere is the plain path, bit for bit', () => {
    const s = grid(dome, 49); const a = erodeHeightfield(s.z, s.nx, s.ny, s.dx, { steps: 12 }), b = erodeHeightfield(s.z, s.nx, s.ny, s.dx, { steps: 12 }, { hardness: () => 0 });
    expect(Buffer.from(b.z.buffer).equals(Buffer.from(a.z.buffer))).toBe(true);
  });
  it('hard beds keep steeper faces than the same erosion without rock', () => {
    const run = (withHard) => { const s = strata(grid(dome, 65), { thickness: 0.8, contrast: 1, seed: 5 }); const { z } = erodeHeightfield(s.z, s.nx, s.ny, s.dx, { steps: 40, strength: 0.8 }, withHard ? { hardness: (k, zk) => s.hardFns[0](gridX(s, k % s.nx), gridY(s, (k / s.nx) | 0), zk) } : {}); s.z.set(z); return slopes(s).sort((a, b) => a - b); };
    const hard = run(true), soft = run(false); const p = (xs) => xs[Math.floor(0.97 * xs.length)];
    expect(p(hard)).toBeGreaterThan(p(soft) * 1.15);   // measured 1.29× at these settings
  });
});

describe('the runner', () => {
  const dome = (x, y) => 5 * Math.exp(-((x - 12) ** 2 + (y - 12) ** 2) / 50);
  it('talus settles after erosion wherever it is listed; the same list gives the same bytes', () => {
    const ops = [{ op: 'talus', retreat: 0.3 }, { op: 'strata', thickness: 0.7 }, { op: 'scarp', path: [[0, 8], [24, 9]], throw: 2 }];
    const a = applyLandform(grid(dome, 65), ops, { seed: 'x', erosion: { steps: 8 } });
    const b = applyLandform(grid(dome, 65), [ops[1], ops[2], ops[0]].map((o, i) => ({ ...o, seed: `x::landform::${[1, 2, 0][i]}` })), { seed: 'x', erosion: { steps: 8 } });
    expect(Buffer.from(a.z.buffer).equals(Buffer.from(b.z.buffer))).toBe(true);
    const c = applyLandform(grid(dome, 65), ops, { seed: 'x', erosion: { steps: 8 } });
    expect(Buffer.from(c.z.buffer).equals(Buffer.from(a.z.buffer))).toBe(true);
  });
  it('a rock picks the joint pattern', () => {
    const s = applyLandform(grid(dome, 49), [{ op: 'joints', rock: 'basalt', spacing: 1 }], { seed: 1 });
    expect(s.fabric).toBe('columnar');
  });
  it('validation teaches', () => {
    expect(validateLandform([{ op: 'peaks', height: 4 }, { op: 'talus' }])).toEqual([]);
    const e = (list) => validateLandform(list).join(' ');
    expect(e([])).toMatch(/non-empty list/);
    expect(e([{ op: 'mesa' }])).toMatch(/op must be one of peaks, strata, scarp, joints, talus/);
    expect(e([{ op: 'scarp', path: [[0, 0]], throw: 2 }])).toMatch(/at least two points/);
    expect(e([{ op: 'strata' }])).toMatch(/thickness is required/);
    expect(e([{ op: 'joints', spacing: 1, pattern: 'cubic' }])).toMatch(/pattern must be one of blocky, columnar, slabby/);
    expect(e([{ op: 'peaks', height: 3, center: [1, 1] }])).toMatch(/center and radius go together/);
    expect(e([{ op: 'talus', angle: 70 }])).toMatch(/angle of repose/);
  });
});

describe('the sliced mesh', () => {
  const edgesOnce = (faces, s) => {
    const key = (p) => `${p[0]},${p[1]},${p[2]}`; const count = new Map();
    for (const f of faces) for (let e = 0; e < 3; e++) { const a = key(f.corners[e]), b = key(f.corners[(e + 1) % 3]); const k = a < b ? `${a}|${b}` : `${b}|${a}`; count.set(k, (count.get(k) || 0) + 1); }
    const x1 = gridX(s, s.nx - 1), y1 = gridY(s, s.ny - 1); const onRim = (str) => str.split('|').every((q) => { const [x, y] = q.split(',').map(Number); return x === s.x0 || y === s.y0 || x === x1 || y === y1; });
    let bad = 0, over = 0; for (const [k, c] of count) { if (c > 2) over++; if (c === 1 && !onRim(k)) bad++; }
    return { bad, over };
  };
  const paint = () => '#808080';
  const cliff = (T) => scarp(grid(() => 0.3, 49), { path: [[-2, 12], [26, 13]], throw: T, face: 80, rough: 0.02, taper: 0, seed: 2 });
  it('no cracks: every interior edge is shared by two triangles, plain and displaced', () => {
    const s = cliff(3); const levels = sliceLevels(0, 4, 0.2);
    expect(edgesOnce(slicedTerrainFaces(s, { stride: 2, levels, paint }), s)).toEqual({ bad: 0, over: 0 });
    const displace = (p) => [p[0] + 0.05 * Math.sin(p[2] * 7), p[1] + 0.05 * Math.cos(p[0] * 3 + p[2]), p[2]];
    const shifted = { ...s, x0: s.x0 }; void shifted;
    const faces = slicedTerrainFaces(s, { stride: 2, levels, paint, displace });
    const count = new Map(); const key = (p) => `${p[0]},${p[1]},${p[2]}`;
    for (const f of faces) for (let e = 0; e < 3; e++) { const a = key(f.corners[e]), b = key(f.corners[(e + 1) % 3]); const k = a < b ? `${a}|${b}` : `${b}|${a}`; count.set(k, (count.get(k) || 0) + 1); }
    const once = [...count.values()].filter((c) => c === 1).length, plainOnce = [...(() => { const m = new Map(); for (const f of slicedTerrainFaces(s, { stride: 2, levels, paint })) for (let e = 0; e < 3; e++) { const a = key(f.corners[e]), b = key(f.corners[(e + 1) % 3]); const k = a < b ? `${a}|${b}` : `${b}|${a}`; m.set(k, (m.get(k) || 0) + 1); } return m; })().values()].filter((c) => c === 1).length;
    expect(once).toBe(plainOnce);                                  // displacement opens no new edge: only the map's rim is single
  });
  it('flat ground stays two triangles a quad; a cliff adds polygons in proportion to its height', () => {
    const flat = grid(() => 0.3, 49); const quads = Math.ceil((flat.nx - 1) / 2) * Math.ceil((flat.ny - 1) / 2);
    expect(slicedTerrainFaces(flat, { stride: 2, levels: sliceLevels(0, 1, 0.2), paint }).length).toBe(2 * quads);
    const n = (T) => slicedTerrainFaces(cliff(T), { stride: 2, levels: sliceLevels(0, 8, 0.2), paint }).length - 2 * quads;
    const r = n(4) / n(2); expect(r).toBeGreaterThan(1.6); expect(r).toBeLessThan(2.4);
  });
  it('is deterministic', () => {
    const s = cliff(3); const a = slicedTerrainFaces(s, { stride: 2, levels: sliceLevels(0, 4, 0.2), paint }), b = slicedTerrainFaces(s, { stride: 2, levels: sliceLevels(0, 4, 0.2), paint });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
