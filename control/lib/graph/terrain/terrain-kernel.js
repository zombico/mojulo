/**
 * terrain-kernel — the ground of a terrain world, as one self-contained function.
 *
 * `terrainKernel(K)` closes over nothing outside itself: no imports, no module state. The server calls it directly
 * (tests, bakes, placement) and the World page inlines its source (`terrainKernel.toString()`) and calls it on the
 * same decoded grids, so both compute the same ground. The height path uses only + − × ÷, Math.floor, Math.sqrt and
 * Math.imul (exact in every engine) and octave amplitudes precomputed on the server.
 *
 * K (all lengths in the painting's units unless named metres):
 *   nx, ny, x0, y0, dx     the painted scene's landform grid
 *   hq, hMin, hStep        heights, quantised (Uint16): z = hMin + hq·hStep
 *   hard, apron, apronStep hardness (Uint8 /255) and loose apron depth (Uint8 × apronStep)
 *   s, zs, yc              metres per painting unit across and up, and the painting y at world y = 0
 *   rect                   [x0, x1, y0, y1], the painting's domain
 *   horizon                { mode: 'plain'|'sea'|'none', base, fall, amp }: how the ground continues past the domain
 *   sea                    the water level (painting z) or null
 *   beds                   null | { b[], hard[], tanD, cx, cy }: the strata table
 *   detail                 { octaves: [[L metres, weight]…], norm, rock, soil (metres), seed }
 *   light, lambert         the painting's light (unit vector) and { ambient, gain }
 *   ramps                  { soil, stone, scree, beds[] }: each { stops: [4 × rgb], pos: [4], gamma }
 *
 * World frame: metres, z up; world (X, Y) = painting (x·s, (y − yc)·s); heights Z = z·zs + detail.
 */
export function terrainKernel(K) {
  const nx = K.nx, ny = K.ny, dx = K.dx, s = K.s, zs = K.zs, yc = K.yc;
  const R = K.rect;
  const T22 = 0.4040262258351568, T30 = 0.5773502691896257, T34 = 0.6745085168424265, T45 = 1, T52 = 1.2799416321930788;
  const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  function cell(x, y) {
    let u = (x - K.x0) / dx, v = (y - K.y0) / dx;
    if (u < 0) u = 0; else if (u > nx - 1) u = nx - 1;
    if (v < 0) v = 0; else if (v > ny - 1) v = ny - 1;
    let i = Math.floor(u), j = Math.floor(v); if (i > nx - 2) i = nx - 2; if (j > ny - 2) j = ny - 2;
    return [j * nx + i, u - i, v - j];
  }
  const lerp2 = (a, b, c, d, fu, fv) => (a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + d * fu) * fv;
  function zIn(x, y) { const [k, fu, fv] = cell(x, y); const q = K.hq; return K.hMin + K.hStep * lerp2(q[k], q[k + 1], q[k + nx], q[k + nx + 1], fu, fv); }
  function hardIn(x, y) { const [k, fu, fv] = cell(x, y); const q = K.hard; return lerp2(q[k], q[k + 1], q[k + nx], q[k + nx + 1], fu, fv) / 255; }
  function apronIn(x, y) { const [k, fu, fv] = cell(x, y); const q = K.apron; return K.apronStep * lerp2(q[k], q[k + 1], q[k + nx], q[k + nx + 1], fu, fv); }
  // 2D gradient noise on an 8-direction table: integer hashing and polynomials only
  const GX = [1, -1, 0, 0, 0.7071067811865476, -0.7071067811865476, 0.7071067811865476, -0.7071067811865476];
  const GY = [0, 0, 1, -1, 0.7071067811865476, 0.7071067811865476, -0.7071067811865476, -0.7071067811865476];
  function gh(i, j, sd) { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(sd, 1274126177); h = Math.imul(h ^ (h >>> 13), 1103515245); return (h ^ (h >>> 16)) & 7; }
  function gn(x, y, sd) {
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const g00 = gh(i, j, sd), g10 = gh(i + 1, j, sd), g01 = gh(i, j + 1, sd), g11 = gh(i + 1, j + 1, sd);
    const n00 = GX[g00] * fx + GY[g00] * fy, n10 = GX[g10] * (fx - 1) + GY[g10] * fy, n01 = GX[g01] * fx + GY[g01] * (fy - 1), n11 = GX[g11] * (fx - 1) + GY[g11] * (fy - 1);
    const a = n00 + u * (n10 - n00), b = n01 + u * (n11 - n01);
    return (a + v * (b - a)) * 1.4142135623730951;
  }
  // outside the painting: the edge's height eased toward the horizon's base over `fall`, with a low swell
  function outside(x, y) {
    const ox = x < R[0] ? R[0] - x : x > R[1] ? x - R[1] : 0, oy = y < R[2] ? R[2] - y : y > R[3] ? y - R[3] : 0;
    return Math.sqrt(ox * ox + oy * oy);
  }
  function macroZ(x, y) {
    const H = K.horizon; if (H.mode === 'none') return zIn(x, y);
    const d = outside(x, y); if (d <= 0) return zIn(x, y);
    // past the edge, the edge's height blurred over a window that widens with distance: clamping alone would draw each
    // edge value out in a straight ridge (stripes); the continuation grows vaguer the farther it runs
    const b = 0.6 * d; const z = 0.25 * (zIn(x - b, y - b) + zIn(x + b, y - b) + zIn(x - b, y + b) + zIn(x + b, y + b));
    // the land carries on: rolling relief on the large-scale law (H 0.5), three octaves from ~3 paintings' widths down
    const swell = gn(x / 30, y / 30, K.detail.seed + 77) + 0.71 * gn(x / 15, y / 15, K.detail.seed + 78) + 0.5 * gn(x / 7.5, y / 7.5, K.detail.seed + 79);
    const w = smooth(0, H.fall, d); return z + (H.base + H.amp * swell / 2.21 - z) * w;
  }
  const bedIndex = (x, y, z) => {
    const B = K.beds; const v = z - B.tanD * (x * B.cx + y * B.cy); let a = 0, c = B.b.length - 1;
    while (a < c) { const m = (a + c + 1) >> 1; if (B.b[m] <= v) a = m; else c = m - 1; }
    return a;
  };
  // slope (metres per metre) of the macro ground, and how bare it is: steep, or hard and steepish
  function bareAt(x, y) {
    const e = dx * 0.5; const gx = (macroZ(x + e, y) - macroZ(x - e, y)) / (2 * e), gy = (macroZ(x, y + e) - macroZ(x, y - e)) / (2 * e);
    const g = Math.sqrt(gx * gx + gy * gy) * zs / s; const hd = outside(x, y) > 0 ? 0 : hardIn(x, y);
    const b1 = smooth(T30, T45, g), b2 = hd > 0.3 && g > T22 ? smooth(T22, T34, g) : 0;
    return [b1 > b2 ? b1 : b2, g];
  }
  const D = K.detail;
  function detail(X, Y) {
    let v = 0; const oc = D.octaves;
    for (let k = 0; k < oc.length; k++) v += oc[k][1] * gn(X / oc[k][0], Y / oc[k][0], D.seed + k);
    return v / D.norm;
  }
  function heightAt(X, Y) {
    const x = X / s, y = Y / s + yc; const zm = macroZ(x, y) * zs;
    if (!(D.rock > 0 || D.soil > 0)) return zm;
    const [bare] = bareAt(x, y); const ap = outside(x, y) > 0 ? 0 : apronIn(x, y);
    let rough = D.soil + (D.rock - D.soil) * bare; if (ap > 0.02) rough += (D.rock * 0.5 - rough) * smooth(0.02, 0.3, ap);
    return zm + rough * detail(X, Y);
  }
  function normalAt(X, Y, e) {
    const hx = heightAt(X + e, Y) - heightAt(X - e, Y), hy = heightAt(X, Y + e) - heightAt(X, Y - e);
    const nx0 = -hx / (2 * e), ny0 = -hy / (2 * e), l = Math.sqrt(nx0 * nx0 + ny0 * ny0 + 1);
    return [nx0 / l, ny0 / l, 1 / l];
  }
  function rampAt(r, lam) {
    let t = clamp01((lam - K.lambert.ambient) / K.lambert.gain); if (r.gamma !== 1) t = Math.pow(t, r.gamma);
    const P = r.pos, S = r.stops;
    for (let i = 0; i < 3; i++) if (t <= P[i + 1]) { const sp = P[i + 1] - P[i], f = sp > 0 ? (t - P[i]) / sp : 0; return [S[i][0] + (S[i + 1][0] - S[i][0]) * f, S[i][1] + (S[i + 1][1] - S[i][1]) * f, S[i][2] + (S[i + 1][2] - S[i][2]) * f]; }
    return S[3].slice();
  }
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  /** Colour (0–255) of the ground at (X, Y, Z) whose rendered normal is n: soil, rock or bed, apron, underwater.
   *  `lamIn` (optional) replaces the light term — a planet lights by the global normal, not the local one. */
  function colorAt(X, Y, Z, n, lamIn) {
    const x = X / s, y = Y / s + yc, z = (Z) / zs, L = K.light;
    const lam = lamIn !== undefined ? lamIn : K.lambert.ambient + K.lambert.gain * Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
    const [bareM] = bareAt(x, y); const gN = n[2] > 1e-6 ? Math.sqrt(n[0] * n[0] + n[1] * n[1]) / n[2] : 1e6;
    const bare = Math.max(bareM, smooth(T34, T52, gN));
    const rockRamp = K.beds && outside(x, y) <= 0 ? K.ramps.beds[bedIndex(x, y, z)] : K.ramps.stone;
    let c = mix(rampAt(K.ramps.soil, lam), rampAt(rockRamp, lam), bare);
    const ap = outside(x, y) > 0 ? 0 : apronIn(x, y);
    if (ap > 0.02) c = mix(c, rampAt(K.ramps.scree, lam), smooth(0.02, 0.3, ap) * 0.9);
    if (K.sea !== null && z < K.sea) c = [c[0] * 0.5, c[1] * 0.5, c[2] * 0.5];
    return c;
  }
  // ── planet (optional K.planet = { R, inner, outer, cont: { amp, wl, bias }, seed }): the world wrapped on a sphere of
  // radius R with the painting at its north pole (+z). A direction's ground is the flat world's at its azimuthal-
  // equidistant (X, Y) — distance from the pole kept, so the painting is undistorted where it lies — eased beyond
  // `outer` radians into continents: 3D gradient noise on the sphere, four octaves, half of it under the sea.
  const G3 = [[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]];
  function gh3(i, j, k, sd) { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 2147483647) ^ Math.imul(sd, 1274126177); h = Math.imul(h ^ (h >>> 13), 1103515245); return ((h ^ (h >>> 16)) >>> 0) % 12; }
  function gn3(x, y, z, sd) {
    const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), fx = x - i, fy = y - j, fz = z - k;
    const f = (t) => t * t * t * (t * (t * 6 - 15) + 10); const u = f(fx), v = f(fy), w = f(fz);
    const g = (a, b, c, px, py, pz) => { const q = G3[gh3(a, b, c, sd)]; return q[0] * px + q[1] * py + q[2] * pz; };
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(g(i, j, k, fx, fy, fz), g(i + 1, j, k, fx - 1, fy, fz), u), l(g(i, j + 1, k, fx, fy - 1, fz), g(i + 1, j + 1, k, fx - 1, fy - 1, fz), u), v),
      l(l(g(i, j, k + 1, fx, fy, fz - 1), g(i + 1, j, k + 1, fx - 1, fy, fz - 1), u), l(g(i, j + 1, k + 1, fx, fy - 1, fz - 1), g(i + 1, j + 1, k + 1, fx - 1, fy - 1, fz - 1), u), v), w);
  }
  const PL = K.planet || null;
  /** A unit direction (planet frame) → [X, Y] on the flat world, distance from the pole preserved. */
  function polar(dx, dy, dz) { const th = Math.acos(dz > 1 ? 1 : dz < -1 ? -1 : dz), r = Math.sqrt(dx * dx + dy * dy); return r > 1e-12 ? [PL.R * th * dx / r, PL.R * th * dy / r, th] : [0, 0, th]; }
  function continentAt(dx, dy, dz) {
    let v = 0, a = 1, n = 0; const C = PL.cont;
    for (let o = 0; o < 4; o++) { const q = (PL.R / C.wl) * 2 ** o; v += a * gn3(dx * q, dy * q, dz * q, PL.seed + o); n += a; a *= 0.55; }
    return C.base + C.amp * (v / n - C.bias);
  }
  /** Height (metres above R) of the planet's ground in direction (dx, dy, dz), and the flat-world coordinates there. */
  function planetAt(dx, dy, dz) {
    const [X, Y, th] = polar(dx, dy, dz); const w = smooth(PL.inner, PL.outer, th);
    const hp = w < 1 ? heightAt(X, Y) : 0, hc = w > 0 ? continentAt(dx, dy, dz) : 0;
    return [hp + (hc - hp) * w, X, Y, w];
  }
  return { heightAt, groundAt: heightAt, normalAt, colorAt, macroZ, detail, bareAt, planetAt, toWorld: (x, y) => [x * s, (y - yc) * s], toPainting: (X, Y) => [X / s, Y / s + yc] };
}
