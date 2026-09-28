/**
 * atlas-kernel — the ground of a composed terrain world (terrain-atlas.js), as one self-contained function.
 *
 * Like terrain-kernel.js: `atlasKernel(K)` closes over nothing, the server calls it and the World page inlines its
 * source, so both compute the same ground. The height path uses only + − × ÷, Math.floor, Math.sqrt and Math.imul;
 * amplitudes and meanders are computed on the server and carried as numbers.
 *
 * K (world metres, z up, sea level 0):
 *   levels   [{ x0, y0, dx, n, hMin, hStep, h (Uint16 n²), wq (Uint16 n², 0 dry, else 1 + water level quantised on
 *            the same scale), blend, cut, rivers: { seg (Float32 × 8: x0, y0, x1, y1, h0, h1, l0, l1: half-widths and
 *            water levels at the ends), bx0, by0, bdx, bn, boff (Int32 bn² + 1), bidx (Int32) } }], coarsest first,
 *            each finer one inside its parent. A point reads the finest level holding it, blended into the parent over
 *            `blend` metres from its edge (with the parent's missing noise band added back).
 *   oct      [[L, amplitude]…] the noise ladder, longest first: the composer baked every octave down to a level's
 *            `cut` (an index into oct); the kernel adds the rest, scaled by how bare the ground is
 *   seed     the noise seed
 *   rough    { soil, rock } multipliers of the ladder on gentle and on bare ground
 *   zones    { snow, tree } metres: the snowline and the treeline
 *   ramps    { low, forest, high, rock, snow, sand, water, deep, silt }: each { stops: [4 × rgb], pos: [4], gamma }
 *   seaLevel 0 with a coast (any ground below it is sea, so the shore is the ground's own contour), else null
 *   light, lambert, planet?, grade? (cities, as terrain-kernel.js)
 */
export function atlasKernel(K) {
  const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const lerp2 = (a, b, c, d, fu, fv) => (a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + d * fu) * fv;
  // 2D gradient noise on an 8-direction table (terrain-kernel.js's)
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
  const OCT = K.oct || [], SEED = K.seed | 0;
  /** The noise ladder's octaves [from, to) at (X, Y), each at its own wavelength and amplitude. */
  function band(X, Y, from, to) { let v = 0; for (let k = from; k < to && k < OCT.length; k++) v += OCT[k][1] * gn(X / OCT[k][0], Y / OCT[k][0], SEED + k); return v; }
  const LV = K.levels || [], PL = K.planet || null;
  function sampleH(L, X, Y) {
    let u = (X - L.x0) / L.dx, v = (Y - L.y0) / L.dx; const m = L.n - 1;
    if (u < 0) u = 0; else if (u > m) u = m; if (v < 0) v = 0; else if (v > m) v = m;
    let i = Math.floor(u), j = Math.floor(v); if (i > m - 1) i = m - 1; if (j > m - 1) j = m - 1;
    const k = j * L.n + i, q = L.h; return L.hMin + L.hStep * lerp2(q[k], q[k + 1], q[k + L.n], q[k + L.n + 1], u - i, v - j);
  }
  // water: where any corner of the cell holds water, the highest of their levels (the shore is where the ground rises
  // through it); else null
  function sampleW(L, X, Y) {
    let u = (X - L.x0) / L.dx, v = (Y - L.y0) / L.dx; const m = L.n - 1;
    if (u < 0 || v < 0 || u > m || v > m) return null;
    let i = Math.floor(u), j = Math.floor(v); if (i > m - 1) i = m - 1; if (j > m - 1) j = m - 1;
    const k = j * L.n + i, q = L.wq; const a = q[k], b = q[k + 1], c = q[k + L.n], d = q[k + L.n + 1];
    const hi = a > b ? a : b, hj = c > d ? c : d, top = hi > hj ? hi : hj; return top ? L.hMin + L.hStep * (top - 1) : null;
  }
  const edgeOf = (L, X, Y) => { const e = L.dx * (L.n - 1); const a = X - L.x0, b = L.x0 + e - X, c = Y - L.y0, d = L.y0 + e - Y; let m = a < b ? a : b; if (c < m) m = c; if (d < m) m = d; return m; };
  /** The finest level holding (X, Y) → its index, and its weight against its parent (1 away from its edge). */
  function levelAt(X, Y) {
    for (let l = LV.length - 1; l > 0; l--) { const e = edgeOf(LV[l], X, Y); if (e > 0) return [l, smooth(0, LV[l].blend, e)]; }
    return [0, 1];
  }
  /** The levels' grids at (X, Y), blended at their edges: the macro ground (no noise band, no detail, no rivers). */
  function gridAt(X, Y) {
    if (!LV.length) return 0;
    const [l, t] = levelAt(X, Y); const z = sampleH(LV[l], X, Y);
    return t >= 1 || l === 0 ? z : z * t + sampleH(LV[l - 1], X, Y) * (1 - t);
  }
  // rivers: the nearest channel (by distance past its half-width) among the level's segments bucketed here
  function riverAt(L, X, Y) {
    const R = L.rivers; if (!R || !R.bn) return null;
    const bi = Math.floor((X - R.bx0) / R.bdx), bj = Math.floor((Y - R.by0) / R.bdx);
    if (bi < 0 || bj < 0 || bi >= R.bn || bj >= R.bn) return null;
    const b = bj * R.bn + bi, S = R.seg; let best = null, bs = 1e300;
    for (let p = R.boff[b]; p < R.boff[b + 1]; p++) {
      const o = R.bidx[p] * 8, ax = S[o], ay = S[o + 1], ex = S[o + 2] - ax, ey = S[o + 3] - ay, ll = ex * ex + ey * ey;
      let t = ll > 0 ? ((X - ax) * ex + (Y - ay) * ey) / ll : 0; if (t < 0) t = 0; else if (t > 1) t = 1;
      const px = ax + ex * t - X, py = ay + ey * t - Y, d = Math.sqrt(px * px + py * py), h = S[o + 4] + (S[o + 5] - S[o + 4]) * t;
      if (d - h < bs) { bs = d - h; best = [d, h, S[o + 6] + (S[o + 7] - S[o + 6]) * t, L.dx]; }
    }
    return best;
  }
  const RG = K.rough || { soil: 0.6, rock: 2 };
  function slopeOfGrid(X, Y) {
    const [l] = levelAt(X, Y); const e = LV.length ? LV[l].dx * 0.5 : 1;
    const gx = (gridAt(X + e, Y) - gridAt(X - e, Y)) / (2 * e), gy = (gridAt(X, Y + e) - gridAt(X, Y - e)) / (2 * e);
    return Math.sqrt(gx * gx + gy * gy);
  }
  /** The ground (solid, under any water) at (X, Y), and what shaped it: [z, bare 0..1, river | null, water | null]. */
  function groundInfo(X, Y) {
    if (!LV.length) return [0, 0, null, null];
    const [l, t] = levelAt(X, Y), L = LV[l];
    const g = slopeOfGrid(X, Y), bare = smooth(0.45, 0.9, g), rough = RG.soil + (RG.rock - RG.soil) * bare;
    // inside a level's blend the parent brings the noise band it never baked, at the same roughness the kernel's own
    // detail has on the parent's side of the edge: so the ground is continuous across it
    const zl = sampleH(L, X, Y);
    let z = t >= 1 || l === 0 ? zl : zl * t + (sampleH(LV[l - 1], X, Y) + rough * band(X, Y, LV[l - 1].cut, L.cut)) * (1 - t);
    z += rough * band(X, Y, L.cut, OCT.length);
    const r = riverAt(L, X, Y); let water = sampleW(L, X, Y);
    if (K.seaLevel !== null && K.seaLevel !== undefined && z < K.seaLevel && (water === null || water < K.seaLevel)) water = K.seaLevel;
    if (r) {
      const [d, h, wl, cell] = r, bank = Math.max(1.5 * h, 2 * cell);
      if (d < h) { const f = d / h, depth = 1 + 0.12 * h; z = wl - depth * (1 - f * f); if (water === null || wl > water) water = wl; }
      else if (d < h + bank) {
        const lo = wl + 0.4, hi = wl + 0.4 + (d - h) * 0.35, zc = z < lo ? lo : z > hi ? hi : z;
        z = zc + (z - zc) * smooth(0, 1, (d - h) / bank);
      }
    }
    return [z, bare, r, water];
  }
  // graded ground (cities; terrain-kernel.js's grade layer)
  const GL = K.grade && K.grade.length ? K.grade : null;
  function gradeAt(X, Y) {
    for (let g = 0; g < GL.length; g++) {
      const L = GL[g]; const u = (X - L.x0) / L.dx, v = (Y - L.y0) / L.dx;
      if (!(u >= 0 && v >= 0 && u <= L.nx - 1 && v <= L.ny - 1)) continue;
      let i = Math.floor(u), j = Math.floor(v); if (i > L.nx - 2) i = L.nx - 2; if (j > L.ny - 2) j = L.ny - 2;
      const fu = u - i, fv = v - j, k = j * L.nx + i, w = lerp2(L.w[k], L.w[k + 1], L.w[k + L.nx], L.w[k + L.nx + 1], fu, fv) / 255;
      if (w > 0) return [L.dMin + L.dStep * lerp2(L.dq[k], L.dq[k + 1], L.dq[k + L.nx], L.dq[k + L.nx + 1], fu, fv), w, g];
    }
    return null;
  }
  function groundAt(X, Y) {
    if (GL) { const g = gradeAt(X, Y); if (g && g[1] >= 1) return g[0]; const z = groundInfo(X, Y)[0]; return g ? z + (g[0] - z) * g[1] : z; }
    return groundInfo(X, Y)[0];
  }
  function waterAt(X, Y) {
    if (GL) { const g = gradeAt(X, Y); if (g && g[1] >= 1) return null; }
    const [z, , , w] = groundInfo(X, Y); return w !== null && w > z ? w : null;
  }
  /** The surface: the water's top where there is water, else the ground. The page meshes this and walks on it. */
  function heightAt(X, Y) {
    if (GL) { const g = gradeAt(X, Y); if (g && g[1] >= 1) return g[0]; if (g) { const z = groundInfo(X, Y)[0]; return z + (g[0] - z) * g[1]; } }
    const [z, , , w] = groundInfo(X, Y); return w !== null && w > z ? w : z;
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
  const RP = K.ramps, Z = K.zones;
  function cityColor(L, X, Y, lam) {
    const base = rampAt(L.ramp, lam), P = L.paint; if (!P) return base;
    const u = (X - P.x0) / P.dx, v = (Y - P.y0) / P.dx; if (!(u >= 0 && v >= 0 && u <= P.nx - 1 && v <= P.ny - 1)) return base;
    let i = Math.floor(u), j = Math.floor(v); if (i > P.nx - 2) i = P.nx - 2; if (j > P.ny - 2) j = P.ny - 2;
    const fu = u - i, fv = v - j, q = P.pc, k = (j * P.nx + i) * 4, k2 = k + 4, k3 = k + P.nx * 4, k4 = k3 + 4;
    const a = lerp2(q[k + 3], q[k2 + 3], q[k3 + 3], q[k4 + 3], fu, fv); if (a <= 0) return base;
    const flat = K.lambert.ambient + K.lambert.gain * Math.max(0, K.light[2]), sh = flat > 0 ? lam / flat : 1;
    const c = [0, 1, 2].map((m) => (lerp2(q[k + m], q[k2 + m], q[k3 + m], q[k4 + m], fu, fv) / a) * 255 * sh);
    return mix(base, c, a / 255);
  }
  // the painter's two noises, shared with landAt: a plant kernel (vegetation-kernel.js) stands trees where they say woods
  /** The treeline's and the snowline's wobble, about 0.5. */
  function hnOf(X, Y, fade) { return 0.5 + 0.5 * gn(X / 900, Y / 900, SEED + 501) * 0.6 * fade(900) + 0.2 * gn(X / 130, Y / 130, SEED + 502) * fade(130); }
  /**
   * Land cover: wooded country and open country over tens of kilometres, woods and fields within it down to a field's
   * size, thicker near water (`r`, the river groundInfo found here); each scale fades where the mesh is too coarse to
   * draw it. Above 0.35 the ground is painted wood, below −0.25 open.
   */
  function coverOf(X, Y, r, fade) {
    const nearWater = r ? 1 - smooth(r[1] + 20, r[1] + 400 + 4 * r[1], r[0]) : 0;
    const region = gn(X / 60000, Y / 60000, SEED + 506) * 0.5 + gn(X / 17000, Y / 17000, SEED + 507) * 0.3;
    return region + (gn(X / 2300, Y / 2300, SEED + 503) * 0.35 * fade(2300) + gn(X / 610, Y / 610, SEED + 504) * 0.25 * fade(610) + gn(X / 170, Y / 170, SEED + 505) * 0.15 * fade(170)) + 0.3 * nearWater;
  }
  /** What the painter reads at (X, Y), without the colour: [ground z, bare 0..1, river | null, water | null, cover, hn]. */
  function landAt(X, Y, res) {
    const fade = (L) => (res ? 1 - smooth(0.25 * L, 0.6 * L, res) : 1); const [z, bare, r, w] = groundInfo(X, Y);
    return [z, bare, r, w, coverOf(X, Y, r, fade), hnOf(X, Y, fade)];
  }
  /** Colour (0–255) at (X, Y, Z) with rendered normal n: water by depth, else land by height, slope and shore. `res`
   *  (the mesh's vertex spacing, optional) fades out patterns too fine for the mesh to show, so they do not alias. */
  function colorAt(X, Y, Zs, n, lamIn, res) {
    const fade = (L) => (res ? 1 - smooth(0.25 * L, 0.6 * L, res) : 1);
    const L = K.light, lam = lamIn !== undefined ? lamIn : K.lambert.ambient + K.lambert.gain * Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
    const gc = GL ? gradeAt(X, Y) : null; if (gc && gc[1] >= 1) return cityColor(GL[gc[2]], X, Y, lam);
    // a planet's ground beyond the composed frame: coloured by its own height (the continents), not the frame's edge
    if (PL && (Math.abs(X) > K.S / 2 || Math.abs(Y) > K.S / 2)) {
      if (Zs < PL.sea) { const flat = K.lambert.ambient + K.lambert.gain * Math.max(0, L[2]); return mix(rampAt(RP.water, flat), rampAt(RP.deep, flat), smooth(0, 20, PL.sea - Zs)); }
      const cv = gn(X / 60000, Y / 60000, SEED + 506) * 0.5 + gn(X / 17000, Y / 17000, SEED + 507) * 0.3;
      let c0 = mix(mix(rampAt(RP.low, lam), rampAt(RP.forest || RP.low, lam), 0.15 + 0.7 * smooth(-0.25, 0.35, cv)), rampAt(RP.high, lam), smooth(Z.tree * 0.8, Z.tree * 1.1, Zs));
      if (Zs < 25) c0 = mix(c0, rampAt(RP.sand, lam), 1 - smooth(5, 25, Zs));
      return mix(c0, rampAt(RP.snow, lam), smooth(Z.snow - 200, Z.snow + 200, Zs));
    }
    const [z, bareG, r, w] = groundInfo(X, Y);
    let c;
    if (w !== null && w > z + 0.05) {
      const depth = w - z, flat = K.lambert.ambient + K.lambert.gain * Math.max(0, L[2]);
      c = mix(rampAt(RP.water, flat), rampAt(RP.deep, flat), smooth(0, r && r[0] < r[1] ? 3 + 0.15 * r[1] : 40, depth));
      if (r && r[0] < r[1]) c = mix(c, rampAt(RP.silt, flat), 0.45);
    } else {
      const gN = n[2] > 1e-6 ? Math.sqrt(n[0] * n[0] + n[1] * n[1]) / n[2] : 1e6, bare = Math.max(bareG, smooth(0.7, 1.3, gN));
      const hn = hnOf(X, Y, fade), cover = coverOf(X, Y, r, fade);
      const low = RP.forest ? mix(rampAt(RP.low, lam), rampAt(RP.forest, lam), 0.15 + 0.7 * smooth(-0.25, 0.35, cover)) : rampAt(RP.low, lam);
      c = mix(low, rampAt(RP.high, lam), smooth(Z.tree * 0.8, Z.tree * 1.1, z + (hn - 0.5) * 0.25 * Z.tree));   // woods and meadows up to the treeline
      c = mix(c, rampAt(RP.rock, lam), bare);
      // a shore: ground within a metre and a half of the water beside it, and only at the water's edge
      const edge = r ? r[0] - r[1] : w !== null ? 0 : 1e9, wl = w !== null ? w : r ? r[2] : null;
      const sw = Math.max(6, 0.05 * (r ? r[1] : 120)), small = !!r && r[1] < 15 && (w === null || w <= z);
      if (wl !== null && edge < sw && !small) { const shore = z - wl; if (shore < 1.6) c = mix(c, rampAt(RP.sand, lam), (1 - smooth(0.2, 1.6, shore)) * (1 - bare) * (1 - smooth(0, sw, edge))); }
      // snow above the line, lower on the ridges and higher in the hollows (the grid's own relief), off the steep faces
      const hollow = LV.length ? z - gridAt(X, Y) : 0;
      const sn = smooth(Z.snow - 150, Z.snow + 150, z + (hn - 0.5) * 700 + 3 * hollow) * (1 - smooth(0.8, 1.2, gN)); if (sn > 0) c = mix(c, rampAt(RP.snow, lam), sn);
      // a stream narrower than the mesh can draw: a thread of water over the land, as much as it covers
      if (small && res && r[0] < Math.max(r[1], 0.7 * res)) { const flat = K.lambert.ambient + K.lambert.gain * Math.max(0, L[2]); c = mix(c, rampAt(RP.water, flat), Math.min(0.8, (2.4 * r[1]) / res + 0.15)); }
    }
    if (gc) c = mix(c, cityColor(GL[gc[2]], X, Y, lam), gc[1]);
    return c;
  }
  // ── planet (optional K.planet = { R, inner, outer, cont: { amp, wl, bias, base }, seed, sea }): the composed world at
  // the north pole, azimuthal-equidistant (atan2, so the pole is exact at any radius), continents on the sphere beyond
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
  function polar(dx, dy, dz) { const r = Math.sqrt(dx * dx + dy * dy), th = Math.atan2(r, dz); return r > 1e-15 ? [PL.R * th * dx / r, PL.R * th * dy / r, th] : [0, 0, th]; }
  function continentAt(dx, dy, dz) {
    let v = 0, a = 1, n = 0; const C = PL.cont;
    for (let o = 0; o < 5; o++) { const q = (PL.R / C.wl) * 2 ** o; v += a * gn3(dx * q, dy * q, dz * q, PL.seed + o); n += a; a *= 0.55; }
    return C.base + C.amp * (v / n - C.bias);
  }
  function planetAt(dx, dy, dz) {
    const [X, Y, th] = polar(dx, dy, dz); const w = smooth(PL.inner, PL.outer, th);
    const hp = w < 1 ? heightAt(X, Y) : 0; let hc = w > 0 ? continentAt(dx, dy, dz) : 0; if (w > 0 && hc < PL.sea) hc = PL.sea - (PL.sea - hc) * 0.02;
    return [hp + (hc - hp) * w, X, Y, w];
  }
  return {
    heightAt, groundAt, waterAt, normalAt, colorAt, planetAt, gridAt, band, levelAt, riverAt: (X, Y) => { const [l] = levelAt(X, Y); return riverAt(LV[l], X, Y); },
    baseAt: (X, Y) => groundInfo(X, Y)[0], looseAt: () => 0, seaZ: 0, gradeAt: (X, Y) => (GL ? gradeAt(X, Y) : null), landAt,
    toWorld: (x, y) => [x, y], toPainting: (X, Y) => [X, Y],
  };
}
