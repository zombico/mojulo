// normal-bake.test.js — the bake's machine gates on fields whose normals are known exactly: a sphere's field on a
// coarse icosphere (every face its own chart island: the seams and the dilation stressed) and a torus's on a coarse
// parametric grid (one chart, the tangents summed across faces) bake to the analytic normal within a degree, as an
// engine shades them (the texel's basis rebuilt the MikkTSpace way); the map byte-identical on a rebuild; the charts
// dilated (no background texel within the dilation of a chart texel, and the mips that dilation covers draw none in);
// the tangents unit, square to the normals, along +u; a face given no field flat.
import { describe, it, expect } from 'vitest';
import { bakeFieldNormals, meshTangents, normalMips, texelNormal, FLAT } from './normal-bake.js';
import { encodePng } from '../landscape/surface-textures.js';

const normalPng = (m) => encodePng(Buffer.from(m.rgb), m.width, m.height);

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };
const deg = (a, b) => (Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) * 180) / Math.PI;

/** an icosphere of radius `r`, subdivided once (80 faces), each face its own island in a grid of cells (a right
 * triangle inset in its cell), its corners its own: the smooth sphere's normals at the flat faces' points */
function icosphere(r) {
  const t = (1 + Math.sqrt(5)) / 2;
  let P = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(unit);
  let T = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  const mid = new Map(), m = (a, b) => { const k = a < b ? `${a},${b}` : `${b},${a}`; if (!mid.has(k)) { mid.set(k, P.length); P.push(unit(P[a].map((x, i) => (x + P[b][i]) / 2))); } return mid.get(k); };
  T = T.flatMap(([a, b, c]) => { const ab = m(a, b), bc = m(b, c), ca = m(c, a); return [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]]; });
  const G = 9, V = [], N = [], uv = [], F = [];
  T.forEach((tri, fi) => {
    const cx = fi % G, cy = Math.floor(fi / G), o = 0.12, s = 0.76;
    const cell = [[cx + o, cy + o + s], [cx + o + s, cy + o + s], [cx + o, cy + o]];
    tri.forEach((v, k) => { V.push(P[v].map((x) => x * r)); N.push(P[v]); uv.push([cell[k][0] / G, cell[k][1] / G]); });
    F.push([fi * 3, fi * 3 + 1, fi * 3 + 2]);
  });
  return { V, F, N, uv };
}

/** a torus (ring radius R, tube r) on a grid of `nu` × `nv`, one chart over [0, 1]², its seam's points twice */
function torus(R, r, nu = 16, nv = 8) {
  const V = [], N = [], uv = [], F = [], id = (i, j) => i * (nv + 1) + j;
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
    const a = (2 * Math.PI * i) / nu, b = (2 * Math.PI * j) / nv, c = [Math.cos(a), Math.sin(a), 0], n = [Math.cos(b) * c[0], Math.cos(b) * c[1], Math.sin(b)];
    V.push([R * c[0] + r * n[0], R * c[1] + r * n[1], r * n[2]]); N.push(n); uv.push([i / nu, 1 - j / nv]);
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { F.push([id(i, j), id(i + 1, j), id(i + 1, j + 1)]); F.push([id(i, j), id(i + 1, j + 1), id(i, j + 1)]); }
  return { V, F, N, uv };
}
const sphereField = (r) => (q) => Math.hypot(q[0], q[1], q[2]) - r;
const torusField = (R, r) => (q) => Math.hypot(Math.hypot(q[0], q[1]) - R, q[2]) - r;
const sphereNormal = (p) => unit(p);
const torusNormal = (R) => (p) => { const l = Math.hypot(p[0], p[1]), c = [p[0] / l * R, p[1] / l * R, 0]; return unit([p[0] - c[0], p[1] - c[1], p[2]]); };

/** the worst angle between the shaded normal (the texel decoded in its basis as an engine rebuilds it) and the analytic
 * one at the texel's point */
function worst(M, bake, analytic) {
  let max = 0, n = 0;
  for (let i = 0; i < bake.width * bake.height; i++) {
    const fi = bake.where[i]; if (fi < 0) continue;
    const t = M.F[fi], b = [bake.bary[i * 2], bake.bary[i * 2 + 1]]; b.push(1 - b[0] - b[1]);
    const lerp = (A, k = 3) => [0, 1, 2].map((c) => b[0] * A[t[0]][c] + b[1] * A[t[1]][c] + b[2] * A[t[2]][c]);
    const p = lerp(M.V), N0 = lerp(M.N), T0 = lerp(bake.tangents), w = bake.tangents[t[0]][3], B0 = cross(N0, T0).map((x) => x * w);
    const x = texelNormal(bake, i % bake.width, Math.floor(i / bake.width)), shaded = [0, 1, 2].map((c) => x[0] * T0[c] + x[1] * B0[c] + x[2] * N0[c]);
    max = Math.max(max, deg(shaded, analytic(p))); n++;
  }
  return { max, n };
}

describe('the bake on analytic fields', () => {
  it('a sphere on a coarse icosphere: every texel shades to the sphere\'s normal within a degree, though the faces are flat', () => {
    const M = icosphere(0.1), bake = bakeFieldNormals({ ...M, field: sphereField(0.1), width: 256, step: 0.05, trace: true });
    const { max, n } = worst(M, bake, sphereNormal);
    expect(n).toBeGreaterThan(256 * 256 * 0.25);
    expect(max).toBeLessThan(1);
    // (the flat faces themselves stand off the sphere: their own normals are degrees out, the map puts the curve back)
    const flat = M.F.map((t) => deg(cross(M.V[t[1]].map((x, k) => x - M.V[t[0]][k]), M.V[t[2]].map((x, k) => x - M.V[t[0]][k])), M.N[t[0]]));
    expect(Math.max(...flat)).toBeGreaterThan(5);
    expect(bake.stats.flat).toBe(0);
  });

  it('a torus on a coarse grid, its tangents summed across faces: within a degree, and so in object space', () => {
    const M = torus(0.1, 0.04), bake = bakeFieldNormals({ ...M, field: torusField(0.1, 0.04), width: 256, step: 0.05, trace: true });
    expect(worst(M, bake, torusNormal(0.1)).max).toBeLessThan(1);
    const obj = bakeFieldNormals({ ...M, field: torusField(0.1, 0.04), width: 128, step: 0.05, space: 'object', trace: true });
    let max = 0;
    for (let i = 0; i < 128 * 128; i++) {
      const fi = obj.where[i]; if (fi < 0) continue;
      const t = M.F[fi], b = [obj.bary[i * 2], obj.bary[i * 2 + 1]]; b.push(1 - b[0] - b[1]);
      const p = [0, 1, 2].map((c) => b[0] * M.V[t[0]][c] + b[1] * M.V[t[1]][c] + b[2] * M.V[t[2]][c]);
      max = Math.max(max, deg(texelNormal(obj, i % 128, Math.floor(i / 128)), torusNormal(0.1)(p)));
    }
    expect(max).toBeLessThan(1);
  });

  it('is the same bytes on a rebuild, and its PNG too', () => {
    const M = torus(0.1, 0.04), a = bakeFieldNormals({ ...M, field: torusField(0.1, 0.04), width: 64 }), b = bakeFieldNormals({ ...M, field: torusField(0.1, 0.04), width: 64 });
    expect(Buffer.from(a.rgb).equals(Buffer.from(b.rgb))).toBe(true);
    expect(normalPng(a).equals(normalPng(b))).toBe(true);
    expect(normalPng(a).subarray(1, 4).toString()).toBe('PNG');
  });

  it('dilates the charts: no background texel within the dilation of a chart texel, and the mips it covers draw none in', () => {
    const M = icosphere(0.1), W = 256, D = 4, bake = bakeFieldNormals({ ...M, field: sphereField(0.1), width: W, dilate: D });
    let near = 0, bad = 0;
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      if (bake.covered[y * W + x]) continue;
      let close = false;
      for (let dy = -D; dy <= D && !close; dy++) for (let dx = -D; dx <= D && !close; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < W && bake.covered[yy * W + xx]) close = true; }
      if (!close) continue;
      near++; const j = (y * W + x) * 3;
      if (bake.rgb[j] === FLAT[0] && bake.rgb[j + 1] === FLAT[1] && bake.rgb[j + 2] === FLAT[2] && !bake.filled[y * W + x]) bad++;
    }
    expect(near).toBeGreaterThan(1000);
    expect(bad).toBe(0);
    expect(bake.filled.every((f, i) => f || !bake.covered[i])).toBe(true);
    // a mip texel over any chart texel, at the levels the dilation covers (2^l ≤ D), is the mean of written texels only:
    // against the same mip of a map whose background is a wild colour, it is the same
    const wild = { ...bake, rgb: Uint8Array.from(bake.rgb) };
    for (let i = 0; i < W * W; i++) if (!bake.filled[i]) { wild.rgb[i * 3] = 255; wild.rgb[i * 3 + 1] = 0; wild.rgb[i * 3 + 2] = 0; }
    const m1 = normalMips(bake, 2), m2 = normalMips(wild, 2);
    for (let l = 0; l < 2; l++) {
      const s = 2 ** (l + 1), w = W / s;
      for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
        let over = false; for (let dy = 0; dy < s && !over; dy++) for (let dx = 0; dx < s && !over; dx++) if (bake.covered[(y * s + dy) * W + x * s + dx]) over = true;
        if (!over) continue;
        const j = (y * w + x) * 3; expect([m1[l].rgb[j], m1[l].rgb[j + 1], m1[l].rgb[j + 2]]).toEqual([m2[l].rgb[j], m2[l].rgb[j + 1], m2[l].rgb[j + 2]]);
      }
    }
  });

  it('builds tangents unit, square to the normal, along +u with the bitangent up the image; a face with no field is flat', () => {
    const M = torus(0.1, 0.04), T = meshTangents(M.V, M.F, M.uv, M.N);
    T.forEach((t, v) => { expect(Math.abs(Math.hypot(t[0], t[1], t[2]) - 1)).toBeLessThan(1e-9); expect(Math.abs(dot(t, M.N[v]))).toBeLessThan(1e-9); expect(Math.abs(t[3])).toBe(1); });
    // along +u: the next point round the ring lies ahead of the tangent; the bitangent runs to the next point up the
    // image (v falling: j up the grid)
    const v = 3 * 9 + 2, ahead = M.V[v + 9].map((x, k) => x - M.V[v][k]), up = M.V[v + 1].map((x, k) => x - M.V[v][k]), B = cross(M.N[v], T[v]).map((x) => x * T[v][3]);
    expect(dot(T[v], ahead)).toBeGreaterThan(0);
    expect(dot(B, up)).toBeGreaterThan(0);
    const half = bakeFieldNormals({ ...M, fieldOf: (fi) => (fi % 2 ? null : torusField(0.1, 0.04)), width: 64, trace: true });
    for (let i = 0; i < 64 * 64; i++) if (half.where[i] >= 0 && half.where[i] % 2) expect([...half.rgb.subarray(i * 3, i * 3 + 3)]).toEqual([...FLAT]);
    expect(half.stats.flat).toBeGreaterThan(0);
  });
});
