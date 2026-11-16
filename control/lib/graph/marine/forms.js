/**
 * MARINE FORMS: what grows on a seabed and does not swim, as primitives. One import-free kernel (`marineKernel`), run in
 * Node by the laws and the placer and inlined into the page by its channel (scene/channels/marine.js), so a template is
 * grown where it is drawn and a page carries only where each thing stands.
 *
 * A form is a mesh at its true size, its foot at the origin, z up, metres: `{ pos, col, sway, idx, tris }`: positions,
 * colours (sRGB 0–1, a kind's `base` shaded dark at its foot and running to its `tip`), `sway` (metres a vertex moves in
 * the current at its most: 0 where it is rooted, so nothing slides on the bed) and an index. No light is in the colour:
 * the page lights it (the cube's sun and sky, then the sea).
 *
 * The primitives, each a way of growing (a kind is a row of marine/roster.js that names one):
 *   branch    forking tubes, each fork shorter and thinner, pale at the tips (a staghorn coral)
 *   table     a plate on a stalk, its rim irregular (a table coral)
 *   dome      a boulder ribbed in meanders (a brain coral)
 *   fingers   a cluster of upright round-topped columns (a pillar coral)
 *   fan       a lattice forking in one plane, square to the current (a sea fan)
 *   whips     a few long thin rods bending (sea whips)
 *   barrel    a ribbed vase open at the top (a barrel sponge)
 *   tubes     a cluster of open pipes (tube sponges)
 *   anemone   a column, a disc and a crown of tentacles
 *   worms     pale tubes in a clump, a plume at each mouth (tube worms)
 *   pen       a feather on a stalk (a sea pen)
 *   kelp      stipes rising in a slow curve, blades hanging from them
 *   grass     a tuft of ribbon blades (seagrass)
 *   lettuce   low ruffled fronds (sea lettuce)
 *   rock      a lumpy mound of reef rock, mottled (a bommie): the hardscape the rest is set on; `rockZ` is its height at a
 *             point, the same function the mesh is built from, so what grows on it stands on it
 *
 * Deterministic from the seed: a hash, never a clock or a random. Pure.
 */
export function marineKernel() {
  const TAU = Math.PI * 2;
  const hash = (a, b) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const lerp = (a, b, t) => a + (b - a) * t;
  const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const vert = (M, p, c, s) => { M.pos.push(p[0], p[1], p[2]); M.col.push(c[0], c[1], c[2]); M.sway.push(s); return M.pos.length / 3 - 1; };
  const quad = (M, a, b, c, d) => { M.idx.push(a, b, c, a, c, d); };
  // (two directions square to a tangent)
  const frame = (t) => { const u = norm(cross(t, Math.abs(t[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1])); return [u, cross(t, u)]; };

  /** A tube along `pts` with radii `rad`, `sides` round; `colAt(t)` and `swayAt(t)` along it (t 0 at its foot, 1 at its
   *  tip); capped at the tip by a point. */
  function tube(M, pts, rad, sides, colAt, swayAt) {
    const n = pts.length, rings = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), tan = norm(sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)])), [u, v] = frame(tan), ring = [];
      for (let k = 0; k < sides; k++) { const a = (k / sides) * TAU; ring.push(vert(M, add(add(pts[i], u, Math.cos(a) * rad[i]), v, Math.sin(a) * rad[i]), colAt(t), swayAt(t))); }
      rings.push(ring);
    }
    for (let i = 0; i + 1 < n; i++) for (let k = 0; k < sides; k++) quad(M, rings[i][k], rings[i][(k + 1) % sides], rings[i + 1][(k + 1) % sides], rings[i + 1][k]);
    const tan = norm(sub(pts[n - 1], pts[n - 2])), tip = vert(M, add(pts[n - 1], tan, rad[n - 1] * 0.9), colAt(1), swayAt(1));
    for (let k = 0; k < sides; k++) M.idx.push(rings[n - 1][k], rings[n - 1][(k + 1) % sides], tip);
  }
  /** A ribbon along `pts`, `widthAt(t)` wide, lying square to `face` (turned by `twistAt(t)` radians about its own line). */
  function ribbon(M, pts, widthAt, face, colAt, swayAt, twistAt) {
    const n = pts.length; let prev = null;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), tan = norm(sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]));
      let side = norm(cross(tan, face));
      if (twistAt) { const a = twistAt(t), up = cross(side, tan); side = norm(add(mul(side, Math.cos(a)), up, Math.sin(a))); }
      const w = widthAt(t) / 2, c = colAt(t), s = swayAt(t), a = vert(M, add(pts[i], side, -w), c, s), b = vert(M, add(pts[i], side, w), c, s);
      if (prev) quad(M, prev[0], prev[1], b, a);
      prev = [a, b];
    }
  }
  /** A surface of revolution about z through `prof` ([r, z] rows, foot to top); `rAt(a, i)` scales the radius round it and
   *  `colAt(i, a)` colours it; a row of radius 0 is one point. `at` moves and `lean` tips it. */
  function lathe(M, prof, sides, rAt, colAt, sway, at = [0, 0, 0], lean = [0, 0]) {
    const rows = [];
    for (let i = 0; i < prof.length; i++) {
      const [r, z] = prof[i], row = [], o = [at[0] + lean[0] * z, at[1] + lean[1] * z, at[2] + z];
      if (r <= 0) row.push(vert(M, o, colAt(i, 0), sway(i)));
      else for (let k = 0; k < sides; k++) { const a = (k / sides) * TAU, rr = r * rAt(a, i); row.push(vert(M, [o[0] + Math.cos(a) * rr, o[1] + Math.sin(a) * rr, o[2]], colAt(i, a), sway(i))); }
      rows.push(row);
    }
    for (let i = 0; i + 1 < rows.length; i++) {
      const A = rows[i], B = rows[i + 1];
      for (let k = 0; k < sides; k++) {
        const k1 = (k + 1) % sides;
        if (A.length === 1 && B.length === 1) continue;
        if (B.length === 1) M.idx.push(A[k], A[k1], B[0]);
        else if (A.length === 1) M.idx.push(A[0], B[k1], B[k]);
        else quad(M, A[k], A[k1], B[k1], B[k]);
      }
    }
  }

  // the reef rock's outline round its middle and its height at a point of its own frame: lumps in three waves by its seed
  const rockR = (seed, R, a) => R * (1 + 0.18 * Math.sin(2 * a + TAU * hash(seed, 1)) + 0.1 * Math.sin(3 * a + TAU * hash(seed, 2)) + 0.06 * Math.sin(5 * a + TAU * hash(seed, 3)));
  const rockQ = (q) => Math.pow(Math.max(0, 1 - Math.pow(q, 2.2)), 0.6);
  /** The reef rock's height over its foot at (x, y) from its middle; 0 past its rim. */
  function rockZ(seed, R, H, x, y) {
    const r = Math.hypot(x, y), q = r / rockR(seed, R, Math.atan2(y, x));
    return q >= 1 ? 0 : H * rockQ(q) * (1 + 0.08 * Math.sin(7 * x / R + TAU * hash(seed, 4)) * Math.sin(6 * y / R + TAU * hash(seed, 5)));
  }

  const GROW = {
    branch(M, o) {
      const dice = (a, b = 0) => hash(o.seed * 131 + a, b + 7), shade = (t) => mixc(mul(o.base, 0.62), o.tip, t * t);
      let id = 0;
      const grow = (p, d, len, r, depth, t0) => {
        const k = id++, bend = norm(add(d, [dice(k, 1) - 0.5, dice(k, 2) - 0.5, 0.15], 0.35)), mid = add(p, d, len * 0.5), end = add(mid, bend, len * 0.5), t1 = t0 + (1 - t0) * 0.42;
        tube(M, [p, mid, end], [r, r * 0.86, r * 0.72], 4, (t) => shade(lerp(t0, depth ? t1 : 1, t)), () => 0);
        if (!depth) return;
        const n = 2 + (depth > 1 && dice(k, 3) > 0.5 ? 1 : 0), [u, v] = frame(bend), a0 = TAU * dice(k, 4);
        for (let j = 0; j < n; j++) { const a = a0 + (TAU * j) / n, sp = 0.5 + 0.35 * dice(k, 5 + j); grow(end, norm(add(add(bend, u, Math.cos(a) * sp), v, Math.sin(a) * sp)), len * (0.62 + 0.2 * dice(k, 9 + j)), r * 0.68, depth - 1, t1); }
      };
      const n = Math.max(2, Math.round(o.n));
      for (let s = 0; s < n; s++) { const a = (TAU * (s + 0.4 * dice(900, s))) / n, lean = 0.25 + 0.4 * dice(901, s); grow([Math.cos(a) * o.h * 0.05, Math.sin(a) * o.h * 0.05, 0], norm([Math.cos(a) * lean, Math.sin(a) * lean, 1]), o.h * 0.36, o.h * 0.06, 3, 0); }
    },
    table(M, o) {
      const R = o.w / 2, H = o.h, dice = (a) => hash(o.seed * 17 + a, 3), ph = [TAU * dice(1), TAU * dice(2), TAU * dice(3)];
      const rim = (a, i) => (i < 2 ? 1 : 1 + 0.12 * Math.sin(3 * a + ph[0]) + 0.07 * Math.sin(5 * a + ph[1]) + 0.04 * Math.sin(9 * a + ph[2]));
      lathe(M, [[R * 0.2, -0.05], [R * 0.13, H * 0.45], [R * 0.5, H * 0.86], [R, H * 0.95], [R * 1.02, H], [R * 0.6, H * 1.02], [0, H * 1.03]], 16, rim,
        (i, a) => (i < 3 ? mul(o.base, 0.5 + 0.1 * i) : mixc(o.base, o.tip, i === 4 ? 0.9 : 0.25 + 0.2 * Math.sin(7 * a + ph[1]))), () => 0);
    },
    dome(M, o) {
      const R = o.w / 2, H = o.h, ph = TAU * hash(o.seed, 11), prof = [];
      for (let i = 0; i <= 6; i++) { const a = (i / 6) * (Math.PI / 2); prof.push([i === 6 ? 0 : R * Math.cos(a) * (i ? 1 : 0.86), H * Math.sin(a) - (i ? 0 : 0.04)]); }
      const groove = (a, i) => Math.sin(9 * a + 2.6 * i + 1.7 * Math.sin(3 * a + ph + i));
      lathe(M, prof, 18, (a, i) => 1 + 0.035 * groove(a, i), (i, a) => mixc(mul(o.base, 0.55 + 0.07 * i), o.tip, 0.5 + 0.5 * groove(a, i)), () => 0);
    },
    fingers(M, o) {
      const n = Math.max(3, Math.round(o.n)), dice = (a, b) => hash(o.seed * 29 + a, b);
      for (let k = 0; k < n; k++) {
        const a = TAU * (k / n + 0.3 * dice(k, 1)), rr = o.w * 0.5 * Math.sqrt(dice(k, 2)) * 0.8, h = o.h * (0.45 + 0.55 * dice(k, 3)) * (1 - 0.5 * rr / (o.w * 0.5 + 1e-6)), r = o.w * (0.09 + 0.06 * dice(k, 4));
        lathe(M, [[r * 1.15, -0.04], [r, h * 0.3], [r * 0.95, h * 0.75], [r * 0.7, h * 0.94], [0, h]], 7, () => 1, (i) => mixc(mul(o.base, 0.55), o.tip, Math.pow(i / 4, 1.6)), () => 0,
          [Math.cos(a) * rr, Math.sin(a) * rr, 0], [Math.cos(a) * 0.12 * dice(k, 5), Math.sin(a) * 0.12 * dice(k, 5)]);
      }
    },
    fan(M, o) {
      // (in the x–z plane, its face along y: set square to the current by its yaw)
      const dice = (a, b = 0) => hash(o.seed * 53 + a, b + 2), face = [0, 1, 0]; let id = 0;
      const sw = (z) => o.sway * Math.pow(Math.max(0, z) / o.h, 2);
      const grow = (p, ang, len, w, depth) => {
        const k = id++, a1 = ang + (dice(k, 1) - 0.5) * 0.3, q = [p[0] + Math.sin(a1) * len, p[1] + (dice(k, 2) - 0.5) * 0.02 * o.h, p[2] + Math.cos(a1) * len];
        const t0 = Math.min(1, p[2] / o.h), t1 = Math.min(1, q[2] / o.h);
        ribbon(M, [p, q], (t) => w * (1 - 0.3 * t), face, (t) => mixc(mul(o.base, 0.7), o.tip, Math.pow(lerp(t0, t1, t), 2)), (t) => sw(lerp(p[2], q[2], t)));
        if (!depth) return;
        const n = dice(k, 3) > 0.35 ? 3 : 2;
        for (let j = 0; j < n; j++) grow(q, a1 + (j - (n - 1) / 2) * (0.42 + 0.2 * dice(k, 4 + j)), len * (0.74 + 0.16 * dice(k, 7 + j)), w * 0.72, depth - 1);
      };
      grow([0, 0, -0.03], 0, o.h * 0.2, o.h * 0.055, 5);
    },
    whips(M, o) {
      const n = Math.max(2, Math.round(o.n)), dice = (a, b) => hash(o.seed * 61 + a, b);
      for (let k = 0; k < n; k++) {
        const a = TAU * dice(k, 1), h = o.h * (0.55 + 0.45 * dice(k, 2)), lean = 0.1 + 0.25 * dice(k, 3), curl = (dice(k, 4) - 0.5) * 0.5, f = [Math.cos(a) * o.w * 0.2 * dice(k, 5), Math.sin(a) * o.w * 0.2 * dice(k, 5), -0.03];
        const pts = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => [f[0] + Math.cos(a) * h * (lean * t + curl * t * t), f[1] + Math.sin(a) * h * (lean * t + curl * t * t), f[2] + h * t]);
        tube(M, pts, pts.map((_, i) => o.h * 0.011 * (1 - 0.5 * (i / 5))), 4, (t) => mixc(mul(o.base, 0.65), o.tip, t), (t) => o.sway * t * t);
      }
    },
    barrel(M, o) {
      const R = o.w / 2, H = o.h, ph = TAU * hash(o.seed, 5);
      lathe(M, [[R * 0.55, -0.05], [R * 0.9, H * 0.3], [R, H * 0.62], [R * 0.86, H * 0.95], [R * 0.78, H], [R * 0.64, H * 0.95], [R * 0.55, H * 0.6], [0, H * 0.5]], 14,
        (a, i) => (i > 4 ? 1 : 1 + 0.06 * Math.sin(11 * a + ph)), (i, a) => (i > 4 ? mul(o.base, 0.32) : mixc(mul(o.base, 0.55 + 0.1 * i), o.tip, 0.5 + 0.5 * Math.sin(11 * a + ph))), () => 0);
    },
    tubes(M, o) {
      const n = Math.max(2, Math.round(o.n)), dice = (a, b) => hash(o.seed * 71 + a, b);
      for (let k = 0; k < n; k++) {
        const a = TAU * (k / n + 0.25 * dice(k, 1)), rr = o.w * 0.28 * (0.3 + 0.7 * dice(k, 2)), h = o.h * (0.5 + 0.5 * dice(k, 3)), r = o.w * (0.09 + 0.05 * dice(k, 4)), l = 0.22 * dice(k, 5);
        lathe(M, [[r * 0.8, -0.04], [r, h * 0.5], [r * 1.08, h * 0.96], [r * 0.98, h], [r * 0.75, h * 0.96], [r * 0.6, h * 0.6], [0, h * 0.5]], 8, () => 1,
          (i) => (i > 3 ? mul(o.base, 0.3) : mixc(mul(o.base, 0.6), o.tip, Math.pow(i / 3, 1.5))), () => 0, [Math.cos(a) * rr, Math.sin(a) * rr, 0], [Math.cos(a) * l, Math.sin(a) * l]);
      }
    },
    anemone(M, o) {
      const R = o.w * 0.22, H = o.h * 0.5, n = Math.max(8, Math.round(o.n)), dice = (a, b) => hash(o.seed * 83 + a, b);
      lathe(M, [[R * 1.15, -0.04], [R * 0.9, H * 0.4], [R, H * 0.9], [R * 1.1, H], [R * 0.5, H * 1.02], [0, H * 0.98]], 10, () => 1, (i) => mul(o.base, 0.5 + 0.09 * i), () => 0);
      for (let k = 0; k < n; k++) {
        // (rings of tentacles from the disc's rim inward, each arching out and up, its tip the kind's)
        const ring = k % 3, a = TAU * (k / n + 0.5 * dice(k, 1) / n) + ring, r0 = R * (1.05 - 0.28 * ring), len = o.h * (0.42 + 0.25 * dice(k, 2)) * (1 - 0.12 * ring), out = 0.75 - 0.25 * ring;
        const d = [Math.cos(a), Math.sin(a)], pts = [0, 0.35, 0.7, 1].map((t) => [d[0] * (r0 + len * out * t * (1 - 0.3 * t)), d[1] * (r0 + len * out * t * (1 - 0.3 * t)), H + len * (0.75 * t + 0.15 * t * t) * (1 - 0.3 * out)]);
        tube(M, pts, [R * 0.13, R * 0.11, R * 0.085, R * 0.07], 3, (t) => mixc(o.base, o.tip, Math.pow(t, 2.2)), (t) => o.sway * t);
      }
    },
    worms(M, o) {
      const n = Math.max(3, Math.round(o.n)), dice = (a, b) => hash(o.seed * 97 + a, b), pale = [0.86, 0.84, 0.78];
      for (let k = 0; k < n; k++) {
        const a = TAU * dice(k, 1), rr = o.w * 0.4 * Math.sqrt(dice(k, 2)), h = o.h * (0.45 + 0.55 * dice(k, 3)), lean = 0.08 + 0.25 * dice(k, 4), r = o.h * 0.022;
        const f = [Math.cos(a) * rr, Math.sin(a) * rr, -0.04], pts = [0, 0.33, 0.66, 1].map((t) => [f[0] + Math.cos(a) * h * lean * t * t, f[1] + Math.sin(a) * h * lean * t * t, f[2] + h * t]);
        const n4 = pts.length;
        // (the tube, open-mouthed: no cap; then the plume, two crossed blades in the kind's colour)
        const rings = pts.map((p, i) => { const [u, v] = frame(norm(sub(pts[Math.min(n4 - 1, i + 1)], pts[Math.max(0, i - 1)]))); return [0, 1, 2, 3, 4].map((j) => vert(M, add(add(p, u, Math.cos(j / 5 * TAU) * r), v, Math.sin(j / 5 * TAU) * r), mul(pale, 0.55 + 0.45 * (i / (n4 - 1))), 0)); });
        for (let i = 0; i + 1 < n4; i++) for (let j = 0; j < 5; j++) quad(M, rings[i][j], rings[i][(j + 1) % 5], rings[i + 1][(j + 1) % 5], rings[i + 1][j]);
        const top = pts[n4 - 1], up = norm(sub(top, pts[n4 - 2])), tip = add(top, up, o.h * 0.16);
        for (const face of [[1, 0, 0], [0, 1, 0]]) ribbon(M, [add(top, up, -r), add(top, up, o.h * 0.07), tip], (t) => r * (1.2 + 3.2 * Math.sin(Math.PI * Math.min(1, t * 1.15))), face, (t) => mixc(o.base, o.tip, t), (t) => o.sway * t);
      }
    },
    pen(M, o) {
      const H = o.h, face = [0, 1, 0], bow = 0.12 * (hash(o.seed, 3) - 0.5), at = (t) => [H * bow * t * t, 0, H * t - 0.03];
      tube(M, [0, 0.25, 0.5, 0.75, 1].map(at), [H * 0.018, H * 0.016, H * 0.013, H * 0.009, H * 0.005], 4, (t) => mixc(mul(o.base, 0.6), o.base, t), (t) => o.sway * t * t);
      const n = Math.max(6, Math.round(o.n));
      for (let k = 0; k < n; k++) for (const side of [-1, 1]) {
        const t = 0.3 + 0.68 * (k / (n - 1)), p = at(t), len = H * 0.26 * Math.sin(Math.PI * Math.min(1, (t - 0.22) / 0.82)) + H * 0.02;
        ribbon(M, [p, [p[0] + side * len * 0.6, 0, p[2] + len * 0.3], [p[0] + side * len, 0, p[2] + len * 0.75]], (u) => H * 0.05 * (1 - 0.6 * u), face, (u) => mixc(o.base, o.tip, u), (u) => o.sway * t * t * (1 + 0.5 * u));
      }
    },
    kelp(M, o) {
      const n = Math.max(1, Math.round(o.n)), dice = (a, b) => hash(o.seed * 101 + a, b);
      for (let k = 0; k < n; k++) {
        const a = TAU * dice(k, 1), h = o.h * (0.6 + 0.4 * dice(k, 2)), f = [Math.cos(a) * o.w * 0.3 * dice(k, 3), Math.sin(a) * o.w * 0.3 * dice(k, 3), -0.05], S = 8;
        const wig = [dice(k, 4) - 0.5, dice(k, 5) - 0.5], at = (t) => [f[0] + h * 0.1 * (wig[0] * Math.sin(t * 4.2) + 0.5 * wig[1] * t), f[1] + h * 0.1 * (wig[1] * Math.sin(t * 3.6 + 1) + 0.5 * wig[0] * t), f[2] + h * t];
        const sw = (t) => o.sway * Math.pow(t, 1.5) * (h / o.h);
        const pts = []; for (let i = 0; i <= S; i++) pts.push(at(i / S));
        tube(M, pts, pts.map((_, i) => o.h * 0.006 * (1.6 - i / S)), 4, (t) => mixc(mul(o.base, 0.45), mul(o.base, 0.8), t), sw);
        // (the blades: from a third of the way up, by turns round the stipe, each out, then hanging)
        const B = Math.round(9 * (h / o.h)) + 3;
        for (let b = 0; b < B; b++) {
          const t = 0.28 + 0.72 * ((b + 0.5) / B), p = at(t), ba = a + b * 2.4 + dice(k, 20 + b), len = o.h * (0.1 + 0.07 * dice(k, 40 + b)) * (1.25 - 0.5 * t), d = [Math.cos(ba), Math.sin(ba)];
          const tw = (dice(k, 60 + b) - 0.5) * 2.4;
          ribbon(M, [p, [p[0] + d[0] * len * 0.45, p[1] + d[1] * len * 0.45, p[2] + len * 0.28], [p[0] + d[0] * len * 0.8, p[1] + d[1] * len * 0.8, p[2] + len * 0.2], [p[0] + d[0] * len, p[1] + d[1] * len, p[2] - len * 0.1]],
            (u) => o.h * 0.03 * Math.sin(Math.PI * Math.min(1, 0.12 + u * 0.95)) + 0.01, [0, 0, 1], (u) => mixc(mul(o.base, 0.75), o.tip, u), (u) => sw(t) * (1 + 0.35 * u), (u) => tw * u);
        }
      }
    },
    grass(M, o) {
      const n = Math.max(4, Math.round(o.n)), dice = (a, b) => hash(o.seed * 113 + a, b);
      for (let k = 0; k < n; k++) {
        const a = TAU * dice(k, 1), h = o.h * (0.5 + 0.5 * dice(k, 2)), out = o.w * 0.5 * (0.25 + 0.75 * dice(k, 3)), f = [Math.cos(a) * o.w * 0.12 * dice(k, 4), Math.sin(a) * o.w * 0.12 * dice(k, 4), -0.03];
        const pts = [0, 0.33, 0.66, 1].map((t) => [f[0] + Math.cos(a) * out * t * t, f[1] + Math.sin(a) * out * t * t, f[2] + h * t * (1 - 0.18 * t)]);
        ribbon(M, pts, (t) => o.h * 0.026 * (1 - 0.5 * t * t) + 0.004, [Math.cos(a), Math.sin(a), 0.2], (t) => mixc(mul(o.base, 0.5), o.tip, t), (t) => o.sway * t * t, (t) => (dice(k, 5) - 0.5) * 1.6 * t);
      }
    },
    lettuce(M, o) {
      const n = Math.max(3, Math.round(o.n)), dice = (a, b) => hash(o.seed * 127 + a, b);
      for (let k = 0; k < n; k++) {
        const a = TAU * (k / n + 0.3 * dice(k, 1)), len = o.w * 0.5 * (0.6 + 0.4 * dice(k, 2)), rise = o.h * (0.5 + 0.5 * dice(k, 3)), ph = TAU * dice(k, 4);
        const pts = [0, 0.25, 0.5, 0.75, 1].map((t) => [Math.cos(a) * len * t, Math.sin(a) * len * t, -0.02 + rise * Math.sin(Math.PI * 0.6 * t)]);
        ribbon(M, pts, (t) => o.w * 0.34 * Math.sin(Math.PI * Math.min(1, 0.15 + 0.85 * t)) + 0.02, [0, 0, 1], (t) => mixc(mul(o.base, 0.6), o.tip, t), (t) => o.sway * t, (t) => 0.9 * Math.sin(5 * t + ph));
      }
    },
    rock(M, o) {
      const R = o.w / 2, H = o.h, sides = 20, qs = [1.06, 1, 0.9, 0.74, 0.55, 0.32], rows = [], dice = (a, b) => hash(o.seed * 7 + a, b);
      const col = (x, y, q) => { const m = 0.5 + 0.5 * Math.sin(3.1 * x / R + TAU * dice(1, 1)) * Math.sin(2.7 * y / R + TAU * dice(1, 2)); return mul(mixc(o.base, o.tip, m * m * 0.8), 0.7 + 0.3 * (1 - q)); };
      for (const [qi, q] of qs.entries()) {
        const row = [];
        for (let k = 0; k < sides; k++) { const a = (k / sides) * TAU, r = rockR(o.seed, R, a) * q, x = Math.cos(a) * r, y = Math.sin(a) * r; row.push(vert(M, [x, y, qi ? rockZ(o.seed, R, H, x, y) : -0.35], col(x, y, Math.min(1, q)), 0)); }
        rows.push(row);
      }
      for (let i = 0; i + 1 < rows.length; i++) for (let k = 0; k < sides; k++) quad(M, rows[i][k], rows[i][(k + 1) % sides], rows[i + 1][(k + 1) % sides], rows[i + 1][k]);
      const top = vert(M, [0, 0, rockZ(o.seed, R, H, 0, 0)], col(0, 0, 0), 0), L = rows.length - 1;
      for (let k = 0; k < sides; k++) M.idx.push(rows[L][k], rows[L][(k + 1) % sides], top);
    },
  };

  /** A form: `grow` its primitive, `o` { seed, h, w (m), n (its count: forks, fingers, tentacles, blades), sway (m at its
   *  most), base, tip ([r, g, b] sRGB 0–1) } → { pos, col, sway, idx, tris }. */
  function form(grow, o) {
    if (!GROW[grow]) throw new Error(`marine: '${grow}' is not a way of growing (${Object.keys(GROW).join(', ')})`);
    const M = { pos: [], col: [], sway: [], idx: [] };
    GROW[grow](M, { sway: 0, n: 0, ...o });
    // (the law every primitive keeps: what is in the bed does not move)
    for (let i = 0; i < M.sway.length; i++) if (M.pos[i * 3 + 2] <= 0) M.sway[i] = 0;
    return { pos: M.pos, col: M.col, sway: M.sway, idx: M.idx, tris: M.idx.length / 3 };
  }
  return { form, rockZ, hash, grows: Object.keys(GROW) };
}

/** The kernel, made once for Node's readers (the laws, the placer). */
export const MARINE = marineKernel();
/** The ways of growing the kernel knows. */
export const MARINE_GROWS = Object.freeze(MARINE.grows);
