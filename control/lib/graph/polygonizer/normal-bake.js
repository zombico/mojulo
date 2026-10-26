/**
 * normal-bake — a FIELD's relief baked into a normal map on a light mesh's UVs: the seventh generation's pipeline (a
 * dense sculpt's detail baked onto the light mesh that is drawn), done exactly, since the dense one is a signed-distance
 * field and its normal is its own gradient, not a second mesh's.
 *
 *   meshTangents(V, F, uv, N)   each vertex's TANGENT, [x, y, z, w], built the MikkTSpace way: every face's tangent along
 *        +u (oriented by the sign of its UV area), each corner's projected off the vertex normal and normalised, summed
 *        weighted by the corner's angle (its edges laid in the normal's plane), normalised; `w` the handedness (the
 *        angle-weighted vote of the faces' UV orientation, ties +1). UVs as glTF's (u right, v down the image): the
 *        bitangent `w · cross(N, T)` runs up the image, glTF's normal-map convention (+Y up). A vertex no face gives a
 *        tangent (only degenerate UVs about it) takes the axis least along its normal, laid in its plane.
 *   bakeFieldNormals({ V, F, uv, N, T, field, fieldOf, width, height, space, project, dilate, trust })
 *        → { width, height, rgb (RGB8, row 0 the image's top), covered (1 a texel a chart triangle holds), tangents,
 *        stats }. For each texel whose centre a chart triangle holds, its edges included (where charts overlap, the
 *        triangle the chart sees most face-on: the most texels to its area, ties to the first by index):
 *        its point on the light mesh by barycentrics, stepped onto the field's zero set (`project` Newton steps along
 *        the field's gradient, stopped when the field is under `tol` there or a step would leap past `step`: across a
 *        crease that is another sheet), the field's unit gradient there; in `space: 'tangent'` expressed in the
 *        texel's basis as an engine rebuilds it (the vertex tangent and normal interpolated, unnormalised, the
 *        bitangent `w · cross(N, T)` per pixel: MikkTSpace's pixel rule), so the shaded normal is the field's; in
 *        `space: 'object'` the normal itself. A texel whose point is further than `trust[0]` m from the field eases to
 *        the mesh's own normal (flat), wholly by `trust[1]`: the field is not the skin's there. A field normal facing
 *        away from the mesh's (a step that found the far sheet) is flat too. A texel turned more than `aa` degrees from
 *        the mesh's normal (a lid's margin, a nostril's rim: the field folding faster than a texel) is the mean of its
 *        centre and four points a quarter-texel about it, so it does not alias into one-texel sparks. Then the charts DILATED `dilate` texels
 *        (each pass every empty texel beside a written one takes its written neighbours' mean, row by row), so an
 *        engine's mips do not draw the background into a seam; every texel past that is flat (128, 128, 255).
 *        `trace: true` adds `where` (each texel's face, −1 none) and `bary` (its first two barycentrics).
 *   normalMips(map, levels)   the map's mip chain (each texel the renormalised mean of the four under it): what an
 *        engine builds on import; the dilation's gate reads it.
 *
 * `field(q)` takes [x, y, z] (the mesh's frame, metres) and is negative inside; `fieldOf(fi)` (in its place) gives each
 * face's own, null for a face to leave flat. Pure and deterministic: a fixed texel order, ties by face index; no dice,
 * no clock; the transcendental math dmath's (the same bits on every engine).
 */
import { acos, cos } from '../../util/dmath.js';

/** the bake's defaults: Newton steps onto the field and the residual that stops them (m), the gradient's finite step
 * (m), the longest step a projection may take (m), the dilation (texels), the turn from the mesh's normal past which a
 * texel is supersampled (degrees; 0 never) */
export const NORMAL_BAKE = Object.freeze({ project: 3, tol: 1e-6, eps: 1e-5, step: 0.004, dilate: 4, aa: 30 });
/** the four more points a texel turned past `aa` degrees takes its mean over (texels from its centre) */
const AA_OFFSETS = Object.freeze([[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]);
/** a flat texel: the interpolated normal itself, (0, 0, 1) in tangent space */
export const FLAT = Object.freeze([128, 128, 255]);

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]); return l > 0 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]; };
const offPlane = (v, n) => { const d = dot(v, n); return [v[0] - n[0] * d, v[1] - n[1] * d, v[2] - n[2] * d]; };

/** a tangent where no chart lays one: the axis least along the normal `n`, laid in its plane, w 1 (a flat texel never
 * reads it; the bake's own fallback, the rig pack's for a corner off every chart) */
export function axisTangent(n) {
  const ax = Math.abs(n[0]) <= Math.abs(n[1]) && Math.abs(n[0]) <= Math.abs(n[2]) ? [1, 0, 0] : Math.abs(n[1]) <= Math.abs(n[2]) ? [0, 1, 0] : [0, 0, 1];
  return [...unit(offPlane(ax, n)), 1];
}

/** each vertex's tangent [x, y, z, w] (see the head of the file) */
export function meshTangents(V, F, uv, N) {
  const n = V.length, acc = new Float64Array(n * 3), vote = new Float64Array(n);
  for (const t of F) {
    const [i0, i1, i2] = t, p0 = V[i0], e1 = sub(V[i1], p0), e2 = sub(V[i2], p0);
    // (the UVs with t up the image: s = u, t = 1 − v)
    const ds1 = uv[i1][0] - uv[i0][0], dt1 = uv[i0][1] - uv[i1][1], ds2 = uv[i2][0] - uv[i0][0], dt2 = uv[i0][1] - uv[i2][1];
    const r = ds1 * dt2 - ds2 * dt1;
    if (!(Math.abs(r) > 1e-20)) continue;
    const o = r > 0 ? 1 : -1, ft = unit([(dt2 * e1[0] - dt1 * e2[0]) * o, (dt2 * e1[1] - dt1 * e2[1]) * o, (dt2 * e1[2] - dt1 * e2[2]) * o]);
    if (!(ft[0] || ft[1] || ft[2])) continue;
    for (let k = 0; k < 3; k++) {
      const v = t[k], nv = N[v], pv = V[v], a = unit(offPlane(sub(V[t[(k + 1) % 3]], pv), nv)), b = unit(offPlane(sub(V[t[(k + 2) % 3]], pv), nv));
      const ang = acos(Math.max(-1, Math.min(1, dot(a, b)))), tv = unit(offPlane(ft, nv));
      acc[v * 3] += tv[0] * ang; acc[v * 3 + 1] += tv[1] * ang; acc[v * 3 + 2] += tv[2] * ang; vote[v] += o * ang;
    }
  }
  return V.map((_, v) => {
    const nv = N[v];
    const tv = unit(offPlane([acc[v * 3], acc[v * 3 + 1], acc[v * 3 + 2]], nv));
    if (!(tv[0] || tv[1] || tv[2])) return axisTangent(nv);
    return [tv[0], tv[1], tv[2], vote[v] < 0 ? -1 : 1];
  });
}

/** the field's value and gradient at q from four samples on a tetrahedron about it (`h` m out) */
function valGrad(field, q, h) {
  const a = field([q[0] + h, q[1] - h, q[2] - h]), b = field([q[0] - h, q[1] - h, q[2] + h]), c = field([q[0] - h, q[1] + h, q[2] - h]), d = field([q[0] + h, q[1] + h, q[2] + h]);
  const s = 1 / (4 * h);
  return [(a + b + c + d) / 4, [(a - b - c + d) * s, (-a - b + c + d) * s, (-a + b - c + d) * s]];
}

/** the field's normal at a point `p` of the light mesh (its own normal `nu`): stepped onto the zero set, → { n (null:
 * flat), w (the trust weight), lost, back } */
function fieldNormal(fn, p, nu, { eps, tol, project, step, trust }) {
  let q = p, [f, g] = valGrad(fn, q, eps), w = 1, lost = false;
  const off = Math.abs(f) / (Math.sqrt(dot(g, g)) || 1);
  if (trust) w = off <= trust[0] ? 1 : off >= trust[1] ? 0 : 1 - (off - trust[0]) / (trust[1] - trust[0]);
  for (let it = 0; it < project && Math.abs(f) > tol && w > 0; it++) {
    const g2 = dot(g, g); if (!(g2 > 1e-20)) break;
    const s = f / g2; if (Math.abs(s) * Math.sqrt(g2) > step) { lost = true; w = 0; break; }
    q = [q[0] - s * g[0], q[1] - s * g[1], q[2] - s * g[2]];
    [f, g] = valGrad(fn, q, eps);
  }
  const n = w > 0 ? unit(g) : null, back = !!(n && !(dot(n, nu) > 0));
  return { n: back ? null : n, w, lost, back };
}

const enc = (x) => Math.max(0, Math.min(255, Math.round((x * 0.5 + 0.5) * 255)));
const dec = (b) => (b / 255) * 2 - 1;

/** The field's relief on the light mesh's UVs (see the head of the file). */
export function bakeFieldNormals({ V, F, uv, N, T = null, field = null, fieldOf = null, width, height = width, space = 'tangent', project = NORMAL_BAKE.project, tol = NORMAL_BAKE.tol, eps = NORMAL_BAKE.eps, step = NORMAL_BAKE.step, dilate = NORMAL_BAKE.dilate, trust = null, aa = NORMAL_BAKE.aa, trace = false } = {}) {
  if (!(Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0)) throw new Error('normal-bake: width and height are whole texels');
  if (space !== 'tangent' && space !== 'object') throw new Error(`normal-bake: space '${space}' is tangent or object`);
  const W = width, H = height, tangents = space === 'tangent' ? T ?? meshTangents(V, F, uv, N) : null;
  const rgb = new Uint8Array(W * H * 3), covered = new Uint8Array(W * H);
  const stats = { texels: 0, overlap: 0, flat: 0, eased: 0, back: 0, lost: 0, supersampled: 0 };
  const aaCos = aa ? cos((aa * Math.PI) / 180) : 1;
  // (`trace`: each texel's face and its first two barycentrics, for a gate to rebuild the basis an engine shades with)
  const where = trace ? new Int32Array(W * H).fill(-1) : null, bary = trace ? new Float64Array(W * H * 2) : null;
  const put = (i, x) => { rgb[i * 3] = enc(x[0]); rgb[i * 3 + 1] = enc(x[1]); rgb[i * 3 + 2] = enc(x[2]); };
  // (where two charts overlap on the map, as a chart cast from one centre folds a lid's margin back under the lid, a
  // texel is the triangle's the chart sees most face-on: the most texels to its area, ties to the first)
  const owner = new Int32Array(W * H).fill(-1), seen = new Float64Array(F.length);
  F.forEach((t, fi) => {
    const fn = fieldOf ? fieldOf(fi) : field;
    const [i0, i1, i2] = t, A = uv[i0], B = uv[i1], C = uv[i2];
    // (the triangle in texel space: a texel's centre at (x + ½, y + ½))
    const ax = A[0] * W, ay = A[1] * H, bx = B[0] * W, by = B[1] * H, cx = C[0] * W, cy = C[1] * H;
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (!(Math.abs(area) > 1e-12)) return;
    const wa = cross(sub(V[i1], V[i0]), sub(V[i2], V[i0])); seen[fi] = Math.abs(area) / (Math.sqrt(dot(wa, wa)) || 1e-30);
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx) - 0.5)), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx) - 0.5));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy) - 0.5)), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy) - 0.5));
    const Pa = V[i0], Pb = V[i1], Pc = V[i2], Na = N[i0], Nb = N[i1], Nc = N[i2];
    const Ta = tangents?.[i0], Tb = tangents?.[i1], Tc = tangents?.[i2], w = tangents ? (Ta[3] + Tb[3] + Tc[3] < 0 ? -1 : 1) : 1;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x; if (covered[i] && !(seen[fi] > seen[owner[i]])) continue;
      const px = x + 0.5, py = y + 0.5;
      const b0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area, b1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area, b2 = 1 - b0 - b1;
      if (b0 < -1e-9 || b1 < -1e-9 || b2 < -1e-9) continue;
      if (covered[i]) stats.overlap++; else stats.texels++;
      covered[i] = 1; owner[i] = fi;
      if (where) { where[i] = fi; bary[i * 2] = b0; bary[i * 2 + 1] = b1; }
      const n0 = [0, 1, 2].map((k) => b0 * Na[k] + b1 * Nb[k] + b2 * Nc[k]), nu = unit(n0);
      // THE FIELD'S NORMAL at the mesh point stepped onto its zero set
      const at = (c0, c1) => { const c2 = 1 - c0 - c1; return [0, 1, 2].map((k) => c0 * Pa[k] + c1 * Pb[k] + c2 * Pc[k]); };
      const S = fn ? fieldNormal(fn, at(b0, b1), nu, { eps, tol, project, step, trust }) : null;
      let n = nu, nf = null;
      if (S) {
        if (S.lost) stats.lost++;
        if (S.back) stats.back++;
        if (S.n && S.w < 1) stats.eased++;
        nf = S.n;
        n = S.n ? (S.w < 1 ? unit([0, 1, 2].map((k) => nu[k] + (S.n[k] - nu[k]) * S.w)) : S.n) : nu;
        // (a texel turned far from the mesh's normal is where the field folds faster than a texel: its mean over four more
        // points about its centre, so a lid's margin is not a scatter of one-texel sparks)
        if (nf && aa && dot(n, nu) < aaCos) {
          const sum = n.slice();
          for (const [ox, oy] of AA_OFFSETS) {
            const qx = px + ox, qy = py + oy;
            const c0 = ((bx - qx) * (cy - qy) - (by - qy) * (cx - qx)) / area, c1 = ((cx - qx) * (ay - qy) - (cy - qy) * (ax - qx)) / area, c2 = 1 - c0 - c1;
            const nq = unit([0, 1, 2].map((k) => c0 * Na[k] + c1 * Nb[k] + c2 * Nc[k])), Q = fieldNormal(fn, at(c0, c1), nq, { eps, tol, project, step, trust });
            const m = Q.n ? (Q.w < 1 ? unit([0, 1, 2].map((k) => nq[k] + (Q.n[k] - nq[k]) * Q.w)) : Q.n) : nq;
            sum[0] += m[0]; sum[1] += m[1]; sum[2] += m[2];
          }
          n = unit(sum); stats.supersampled++;
        }
      }
      if (!nf) stats.flat++;
      if (!tangents) { put(i, n); continue; }
      // IN THE TEXEL'S BASIS as an engine rebuilds it: n = normalize(x·T + y·B + z·N), T and N interpolated, B per pixel
      const t0 = [0, 1, 2].map((k) => b0 * Ta[k] + b1 * Tb[k] + b2 * Tc[k]), bt = cross(n0, t0).map((v) => v * w);
      const det = dot(t0, cross(bt, n0));
      if (!nf || !(Math.abs(det) > 1e-18)) { rgb[i * 3] = FLAT[0]; rgb[i * 3 + 1] = FLAT[1]; rgb[i * 3 + 2] = FLAT[2]; continue; }
      // (Cramer's rule: each component the determinant with its column replaced by n)
      const xs = unit([dot(n, cross(bt, n0)) / det, dot(t0, cross(n, n0)) / det, dot(t0, cross(bt, n)) / det]);
      put(i, xs);
    }
  });
  // THE DILATION: each pass every empty texel beside a written one takes its written neighbours' mean
  const filled = Uint8Array.from(covered);
  for (let pass = 0; pass < dilate; pass++) {
    const was = Uint8Array.from(filled);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (was[i]) continue;
      let r = 0, g = 0, b = 0, c = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx; if (!was[j]) continue;
        r += rgb[j * 3]; g += rgb[j * 3 + 1]; b += rgb[j * 3 + 2]; c++;
      }
      if (!c) continue;
      rgb[i * 3] = Math.round(r / c); rgb[i * 3 + 1] = Math.round(g / c); rgb[i * 3 + 2] = Math.round(b / c); filled[i] = 1;
    }
  }
  for (let i = 0; i < W * H; i++) if (!filled[i]) { rgb[i * 3] = FLAT[0]; rgb[i * 3 + 1] = FLAT[1]; rgb[i * 3 + 2] = FLAT[2]; }
  return { width: W, height: H, space, rgb, covered, filled, tangents, stats, ...(where ? { where, bary } : {}) };
}

/** The map's mip chain, `levels` below it (each texel the renormalised mean of the four under it, an odd edge's last
 * texel kept whole): what an engine builds on import. → [{ width, height, rgb }] */
export function normalMips(map, levels = 4) {
  const out = []; let { width: W, height: H, rgb } = map;
  for (let l = 0; l < levels && (W > 1 || H > 1); l++) {
    const w = Math.max(1, W >> 1), h = Math.max(1, H >> 1), next = new Uint8Array(w * h * 3);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const s = [0, 0, 0];
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const xx = Math.min(W - 1, 2 * x + dx), yy = Math.min(H - 1, 2 * y + dy), j = (yy * W + xx) * 3; for (let k = 0; k < 3; k++) s[k] += dec(rgb[j + k]); }
      const u = unit(s), o = (y * w + x) * 3; next[o] = enc(u[0]); next[o + 1] = enc(u[1]); next[o + 2] = enc(u[2]);
    }
    out.push({ width: w, height: h, rgb: next }); W = w; H = h; rgb = next;
  }
  return out;
}

/** a texel's tangent-space normal back out of the map, unit (the gates read it) */
export const texelNormal = (map, x, y) => { const j = (y * map.width + x) * 3; return unit([dec(map.rgb[j]), dec(map.rgb[j + 1]), dec(map.rgb[j + 2])]); };
