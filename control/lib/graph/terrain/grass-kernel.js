/**
 * grass-kernel — where a terrain world's grass stands, as one self-contained function (the vegetation kernel's twin,
 * read the other way round: grass is where the trees are not).
 *
 * `grassKernel(V, G)` closes over nothing: the server calls it and the World page inlines its source, calling it with
 * its own ground kernel `G`, so both place the same tufts. It reads the ground's painter (`G.landAt`): no grass on
 * water, a city's graded ground, bare rock, sand or snow; it thins under the painter's wood (light under a crown falls
 * by Beer–Lambert, and grass cover halves by a leaf area index of about 1: Pilon et al. 2021); and it comes in patches
 * (a meadow, a clearing, a slope of tussocks), so the world is not carpeted.
 *
 * The ground is judged per block (`block` metres), and a block's grass stands in clumps: a sward kind as drifts of
 * packed tufts, a tussock kind as knots of a few tussocks (bunchgrasses are overdispersed within a knot, clumped at
 * larger scales), each domed, with open ground between them. The climate's two dials pick the kind:
 * a row's temperature range (T falls with altitude, pinned to the treeline) and moisture (M rises near water).
 *
 * V (world metres):
 *   seed, T0, lapse, moist, zones { tree, snow }   the temperature law and the painter's zones (as the vegetation kernel)
 *   species [{ name, h: [lo, hi], habit: 'tussock' | 'sward' }]
 *   rows [{ s, T?: [lo, hi], M?: [lo, hi], w }]     which kinds grow where (weights)
 *   block, density (tufts a square metre of full meadow, counted over its clumps), patch (metres: the
 *   meadows' scale), cover (0..1: how much of the open ground holds grass)
 * → { grassAt(X, Y), plantsIn(x0, y0, size) }: plantsIn packs PER numbers a tuft: x, y, z, height, species, pick, tint (0–9,
 *   its clump's: a clump is one shade, greener or drier), lean (degrees), az (degrees): a clump leans one way, and a
 *   tussock's outer tufts lean out of it (Ghost of Tsushima's clump points: height, facing and colour shared).
 */
export const GRASS_PER = 9;
export function grassKernel(V, G) {
  const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  function hash(i, j, s) { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(s, 1274126177); h = Math.imul(h ^ (h >>> 13), 1103515245); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
  const within = (x, r, e) => (r ? smooth(r[0] - e, r[0] + e, x) * (1 - smooth(r[1] - e, r[1] + e, x)) : 1);
  const Z = V.zones, SEED = V.seed | 0, B = V.block;
  /** Value noise at the meadows' scale: 0..1. */
  function noise(X, Y, salt = 7, scale = V.patch) {
    const x = X / scale, y = Y / scale, i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), a = hash(i, j, SEED + salt), b = hash(i + 1, j, SEED + salt), c = hash(i, j + 1, SEED + salt), d = hash(i + 1, j + 1, SEED + salt);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  /** The ground at (X, Y) as a place for grass: { ok, why?, z, open (0..1: light and room for grass), T, M }. */
  function grassAt(X, Y) {
    const land = G.landAt(X, Y, 0), z = land[0], bareG = land[1], r = land[2], w = land[3], cover = land[4], hn = land[5];
    if (w !== null && w > z) return { ok: 0, why: 'water', z };
    const g = G.gradeAt(X, Y); if (g && g[1] > 0.2) return { ok: 0, why: 'graded', z };
    const n = G.normalAt(X, Y, 1.5), gN = n[2] > 1e-6 ? Math.sqrt(n[0] * n[0] + n[1] * n[1]) / n[2] : 1e6;
    const bare = Math.max(bareG, smooth(0.9, 1.5, gN));
    const edge = r ? r[0] - r[1] : w !== null ? 0 : 1e9, wl = w !== null ? w : r ? r[2] : null;
    const sw = Math.max(6, 0.05 * (r ? r[1] : 120)); let sand = 0;
    if (wl !== null && edge < sw) { const up = z - wl; if (up < 1.6) sand = (1 - smooth(0.2, 1.6, up)) * (1 - smooth(0, sw, edge)); }
    const snow = smooth(Z.snow - 150, Z.snow + 150, z + (hn - 0.5) * 700);
    const high = smooth(Z.tree * 0.8, Z.tree * 1.1, z + (hn - 0.5) * 0.25 * Z.tree);
    // the painter's wood, where it stands (below the treeline): grass thins under it and is gone under a closed canopy
    const wood = smooth(-0.25, 0.35, cover) * (1 - high);
    const open = (1 - smooth(0.25, 0.8, wood)) * (1 - bare) * (1 - sand) * (1 - snow);
    const T = V.T0 - (V.lapse * z) / 1000, nearWater = r ? 1 - smooth(r[1] + 10, r[1] + 150 + 2 * r[1], r[0]) : 0;
    return { ok: open > 0.02 ? 1 : 0, why: open > 0.02 ? undefined : 'shaded or bare', z, open, T, M: V.moist + 0.35 * nearWater };
  }
  function pick(st, u) {
    let sum = 0; const wts = V.rows.map((row) => { const x = row.w * within(st.T, row.T, 1.5) * within(st.M, row.M, 0.08); sum += x; return x; });
    if (sum <= 0) return null; let acc = 0; for (let q = 0; q < V.rows.length; q++) { acc += wts[q]; if (u * sum < acc) return V.rows[q]; }
    return V.rows[V.rows.length - 1];
  }
  /** The tufts of the blocks whose corners lie in [x0, x0 + size) × [y0, y0 + size). */
  function plantsIn(x0, y0, size) {
    const out = [], i0 = Math.ceil(x0 / B), i1 = Math.ceil((x0 + size) / B), j0 = Math.ceil(y0 / B), j1 = Math.ceil((y0 + size) / B);
    for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
      const cx = (i + 0.5) * B, cy = (j + 0.5) * B;
      // patches first: most of the land is not a meadow here, and the painter is only read where one might be
      const p = smooth(1 - V.cover - 0.12, 1 - V.cover + 0.12, noise(cx, cy)); if (p <= 0.02) continue;
      const st = grassAt(cx, cy); if (!st.ok) continue;
      // the kinds come in drifts (a slower noise), not block by block
      const row = pick(st, Math.min(0.9999, clamp01(0.5 + 1.6 * (noise(cx, cy, 29, 0.6 * V.patch) - 0.5) + 0.12 * (hash(i, j, SEED + 3) - 0.5)))); if (!row) continue;
      const sp = V.species[row.s], tussock = sp.habit === 'tussock', tall = sp.h[1] > 1.5, keep = p * st.open;
      // clumps, not a sprinkle: a drift of n tufts packed at `pack` a square metre (sward) or a knot of tussocks, domed
      // (taller at its heart), with open ground between clumps: the meadow reads as grass, not as noise
      // a turf kind (a short sward) is plugs of turf packed into a carpet: many more, and closer
      const turf = sp.habit === 'turf', n = tall ? 5 : tussock ? 6 : turf ? 24 : 16, pack = tall ? 1.6 : tussock ? 2.5 : turf ? 14 : 11, R = Math.sqrt(n / (Math.PI * pack));
      const E = (V.density * (turf ? 4 : 1) * B * B * keep) / n, nc = Math.floor(E + hash(i, j, SEED + 13));
      for (let q = 0; q < nc; q++) {
        const s = SEED + 17 + q * 41, ccx = i * B + (0.1 + 0.8 * hash(i, j, s)) * B, ccy = j * B + (0.1 + 0.8 * hash(i, j, s + 1)) * B, a0 = 2 * Math.PI * hash(i, j, s + 2);
        const m = Math.max(2, Math.round(n * (0.6 + 0.8 * hash(i, j, s + 3)))), Rq = R * Math.sqrt(m / n);
        const tint = Math.floor(10 * hash(i, j, s + 7)), la = 2 * Math.PI * hash(i, j, s + 8), ls = (tall ? 3 : 7) * hash(i, j, s + 9);
        for (let k = 0; k < m; k++) {
          const r = Rq * Math.sqrt((k + 0.5) / m) * (0.85 + 0.3 * hash(i + k, j, s + 4)), a = a0 + k * 2.39996;
          const x = ccx + r * Math.cos(a), y = ccy + r * Math.sin(a), f = r / (Rq + 1e-9);
          const h = (sp.h[0] + (sp.h[1] - sp.h[0]) * hash(i + k, j, s + 5)) * (0.6 + 0.4 * keep) * (1 - 0.3 * f * f);
          // the clump's lean, plus a lean out of its heart toward its rim (a tussock's most)
          const lo = (tussock ? 12 : 5) * f, lx = ls * Math.cos(la) + lo * Math.cos(a), ly = ls * Math.sin(la) + lo * Math.sin(a);
          out.push(x, y, G.groundAt(x, y), h, row.s, hash(i + k, j - k, s + 6), Math.max(0, Math.min(9, tint + Math.round(2 * hash(i + k, j, s + 10) - 1))), Math.hypot(lx, ly), (Math.atan2(ly, lx) * 180) / Math.PI);
        }
      }
    }
    return out;
  }
  return { grassAt, plantsIn };
}
