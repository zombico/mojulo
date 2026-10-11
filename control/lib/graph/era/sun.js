/**
 * SUN — the hard key light of an exterior stage, baked per vertex with a real shadow test: the era's vertex-lit
 * daylight, where an eave or a balcony throws a shadow onto the wall and a house throws one across the plaza.
 *
 * `makeSunShadow(faces, toSun, { cell })` → `(p, n) => 0 | 1` (1 = the sun reaches p). Every face is split into
 * triangles and binned in LIGHT SPACE (a grid on the plane perpendicular to the sun), so a query walks only the
 * triangles that could stand between p and the sun — a shadow map's lookup with an exact ray–triangle test.
 * `sunDir(elevationDeg, azimuthDeg)` → the unit vector toward the sun (z-up, azimuth from +x toward +y).
 * Deterministic; no dice.
 */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export function sunDir(elevation, azimuth) {
  const e = (elevation * Math.PI) / 180, a = (azimuth * Math.PI) / 180;
  return [Math.cos(e) * Math.cos(a), Math.cos(e) * Math.sin(a), Math.sin(e)];
}

export function makeSunShadow(faces, toSun, { cell = 0.75, skip = () => false, maskOf = null } = {}) {
  const L = norm(toSun);
  let e1 = cross(L, [0, 0, 1]); if (Math.hypot(...e1) < 1e-6) e1 = [1, 0, 0]; e1 = norm(e1);
  const e2 = cross(L, e1);
  // `maskOf(face)` → { W, H, a } | null: a cutout card's alpha; the sun passes where the texel the ray crosses is clear
  const tris = [], masks = [];
  for (const f of faces) {
    if (skip(f) || !Array.isArray(f.corners) || f.corners.length < 3) continue;
    const m = maskOf && f.uv ? maskOf(f) : null;
    for (let i = 1; i + 1 < f.corners.length; i++) {
      tris.push([f.corners[0], f.corners[i], f.corners[i + 1]]);
      if (m) masks[tris.length - 1] = { m, uv: [f.uv[0], f.uv[i], f.uv[i + 1]] };
    }
  }
  const grid = new Map(), key = (i, j) => i * 73856093 ^ j * 19349663;
  tris.forEach((t, ti) => {
    const us = t.map((p) => dot(p, e1)), vs = t.map((p) => dot(p, e2));
    const i0 = Math.floor(Math.min(...us) / cell), i1 = Math.floor(Math.max(...us) / cell);
    const j0 = Math.floor(Math.min(...vs) / cell), j1 = Math.floor(Math.max(...vs) / cell);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = key(i, j); let b = grid.get(k); if (!b) grid.set(k, b = []); b.push(ti);
    }
  });
  // Möller–Trumbore along +L from o; a hit at t > eps means something stands between o and the sun
  const clear = (k, u, v) => {
    const { m, uv } = masks[k], w = 1 - u - v;
    const s = uv[0][0] * w + uv[1][0] * u + uv[2][0] * v, q = uv[0][1] * w + uv[1][1] * u + uv[2][1] * v;
    const x = Math.floor((s - Math.floor(s)) * m.W), y = Math.floor((1 - (q - Math.floor(q))) * m.H);   // v up: the image's row 0 is v = 1
    return m.a[Math.min(m.H - 1, y) * m.W + Math.min(m.W - 1, x)] === 0;
  };
  const hits = (o, t, k) => {
    const [a, b, c] = t, ab = sub(b, a), ac = sub(c, a), pv = cross(L, ac), det = dot(ab, pv);
    if (Math.abs(det) < 1e-12) return false;
    const inv = 1 / det, tv = sub(o, a), u = dot(tv, pv) * inv;
    if (u < 0 || u > 1) return false;
    const qv = cross(tv, ab), v = dot(L, qv) * inv;
    if (v < 0 || u + v > 1) return false;
    if (dot(ac, qv) * inv <= 1e-3) return false;
    return !(masks[k] && clear(k, u, v));
  };
  return (p, n) => {
    if (n && dot(n, L) <= 0) return 0;   // facing away: self-shadowed
    const o = n ? [p[0] + n[0] * 0.02, p[1] + n[1] * 0.02, p[2] + n[2] * 0.02] : p;
    const b = grid.get(key(Math.floor(dot(o, e1) / cell), Math.floor(dot(o, e2) / cell)));
    if (!b) return 1;
    for (const ti of b) if (hits(o, tris[ti], ti)) return 0;
    return 1;
  };
}

/**
 * A soft sun: the key and four more `spreadDeg` round it (up, down, left, right), averaged, so a shadow's edge falls
 * off over a cell or two instead of stepping. `spreadDeg` 0 is makeSunShadow itself. → `(p, n) => 0..1`
 */
export function makeSoftSunShadow(faces, toSun, spreadDeg, opts = {}) {
  if (!spreadDeg) return makeSunShadow(faces, toSun, opts);
  const d = norm(toSun), e = (Math.asin(d[2]) * 180) / Math.PI, a = (Math.atan2(d[1], d[0]) * 180) / Math.PI, s = spreadDeg;
  const tests = [makeSunShadow(faces, d, opts), ...[[s, 0], [-s, 0], [0, s], [0, -s]].map(([de, da]) => makeSunShadow(faces, sunDir(e + de, a + da), opts))];
  return (p, n) => tests.reduce((acc, t) => acc + t(p, n), 0) / tests.length;
}

/**
 * A point light's shadow, the sun's sibling: a corner is lit by a torch when the segment to the flame is clear.
 * The triangles are binned in the light's own space (azimuth × elevation round it), so a query walks only those
 * in its direction. `soft` (metres) spreads the flame over a small cross of taps, so the edge of a shadow falls off
 * instead of stepping; `radius` (the light's reach) leaves out what lies beyond it. Memoized per corner. Deterministic: fixed taps, no dice. → `(p, n) => 0..1`
 */
export function makePointShadow(faces, at, { soft = 0, skip = () => false, radius = Infinity } = {}) {
  // only what lies inside the light's reach can stand between it and a corner it lights
  const R = radius + soft, near = (f) => {
    let d = 0;
    for (let k = 0; k < 3; k++) { let lo = Infinity, hi = -Infinity; for (const c of f.corners) { lo = Math.min(lo, c[k]); hi = Math.max(hi, c[k]); } d += Math.max(0, lo - at[k], at[k] - hi) ** 2; }
    return d <= R * R;
  };
  const tris = [];
  for (const f of faces) {
    if (skip(f) || !Array.isArray(f.corners) || f.corners.length < 3 || !near(f)) continue;
    for (let i = 1; i + 1 < f.corners.length; i++) tris.push([f.corners[0], f.corners[i], f.corners[i + 1]]);
  }
  const NA = 96, NE = 48, TAU = Math.PI * 2;
  const angles = (L, q) => { const d = sub(q, L), r = Math.hypot(d[0], d[1], d[2]) || 1; return [Math.atan2(d[1], d[0]), Math.asin(Math.max(-1, Math.min(1, d[2] / r)))]; };
  const binOf = (az, el) => [Math.min(NA - 1, Math.floor(((az + Math.PI) / TAU) * NA)), Math.min(NE - 1, Math.floor(((el + Math.PI / 2) / Math.PI) * NE))];
  const binTap = (L) => {
    const grid = new Map();
    tris.forEach((t, ti) => {
      // the edges sampled too: an edge's elevation bulges between its ends
      const pts = [];
      for (let e = 0; e < 3; e++) { const p0 = t[e], p1 = t[(e + 1) % 3]; for (const u of [0, 0.25, 0.5, 0.75]) pts.push([p0[0] + (p1[0] - p0[0]) * u, p0[1] + (p1[1] - p0[1]) * u, p0[2] + (p1[2] - p0[2]) * u]); }
      const an = pts.map((q) => angles(L, q)), a0 = an[0][0];
      const az = an.map(([x0]) => { let x = x0 - a0; if (x > Math.PI) x -= TAU; if (x < -Math.PI) x += TAU; return a0 + x; });
      const elv = an.map(([, e]) => e), azLo = Math.min(...az), azHi = Math.max(...az);
      // one that wraps round the light (near it, or over a pole) goes in every azimuth of the rows it spans: a pole
      // takes its cap, so the floor under a torch is tested only by the corners that look up or down past it
      let eLo = Math.min(...elv), eHi = Math.max(...elv);
      const wraps = azHi - azLo > Math.PI / 2 || eHi > 1.3 || eLo < -1.3;
      if (eHi > 1.3) eHi = Math.PI / 2;
      if (eLo < -1.3) eLo = -Math.PI / 2;
      const [i0, j0] = binOf(azLo, eLo), [i1, j1] = binOf(azHi, eHi);
      const ia = wraps ? 0 : i0 - 1, ib = wraps ? NA - 1 : i1 + 1;
      for (let i = ia; i <= ib; i++) for (let j = Math.max(0, j0 - 1); j <= Math.min(NE - 1, j1 + 1); j++) {
        const k = (((i % NA) + NA) % NA) * NE + j; let bin = grid.get(k); if (!bin) grid.set(k, (bin = [])); if (bin[bin.length - 1] !== ti) bin.push(ti);
      }
    });
    return { L, grid };
  };
  // the six taps round the centre share its bins: seen from a tap `soft` off the centre, a triangle at least NEAR
  // away moves by under one bin, so a tap's query walks the centre's bin and its eight neighbours; the few nearer
  // than NEAR (the wall a torch hangs on) are tested by every tap's query
  const tapAt = soft > 0 ? [at, ...[[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map((d) => [at[0] + d[0] * soft, at[1] + d[1] * soft, at[2] + d[2] * soft])] : [at];
  const BIN = Math.PI / NE, NEAR = soft > 0 ? soft / Math.tan(BIN * 0.9) + soft : 0;
  let centre = null, nearIx = null;
  const tap = () => centre || (centre = binTap(at));
  const nearList = () => nearIx || (nearIx = tris.map((t, ti) => [t, ti]).filter(([t]) => {
    let d = 0;
    for (let k = 0; k < 3; k++) { const lo = Math.min(t[0][k], t[1][k], t[2][k]), hi = Math.max(t[0][k], t[1][k], t[2][k]); d += Math.max(0, lo - at[k], at[k] - hi) ** 2; }
    return d < NEAR * NEAR;
  }).map(([, ti]) => ti));
  const stamp = new Int32Array(tris.length); let mark = 0;
  const blockedFrom = (o, Lp) => {
    const T = tap(), d = sub(Lp, o), [az, el] = angles(Lp, o), [i, j] = binOf(az, el);
    mark++;
    for (const ti of nearList()) { stamp[ti] = mark; if (hit(o, d, tris[ti])) return true; }
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      const jj = j + dj; if (jj < 0 || jj >= NE) continue;
      for (const ti of T.grid.get((((i + di) % NA + NA) % NA) * NE + jj) || []) { if (stamp[ti] === mark) continue; stamp[ti] = mark; if (hit(o, d, tris[ti])) return true; }
    }
    return false;
  };
  const hit = (o, d, t) => {
    const ab = sub(t[1], t[0]), ac = sub(t[2], t[0]), pv = cross(d, ac), det = dot(ab, pv);
    if (Math.abs(det) < 1e-12) return false;
    const inv = 1 / det, tv = sub(o, t[0]), u = dot(tv, pv) * inv;
    if (u < 0 || u > 1) return false;
    const qv = cross(tv, ab), v = dot(d, qv) * inv;
    if (v < 0 || u + v > 1) return false;
    const s = dot(ac, qv) * inv;
    return s > 1e-3 && s < 1 - 1e-3;
  };
  const blocked = (o, T) => {
    const d = sub(T.L, o), [az, el] = angles(T.L, o), [i, j] = binOf(az, el);
    for (const ti of T.grid.get(i * NE + j) || []) if (hit(o, d, tris[ti])) return true;
    return false;
  };
  const memo = new Map(), memoHard = new Map();
  const keyOf = (p, n) => `${p[0]},${p[1]},${p[2]}|${n ? n.join() : ''}`, from = (p, n) => (n ? [p[0] + n[0] * 0.02, p[1] + n[1] * 0.02, p[2] + n[2] * 0.02] : p);
  const test = (p, n) => {
    const key = keyOf(p, n);
    let v = memo.get(key);
    if (v !== undefined) return v;
    const o = from(p, n);
    let clear = 0;
    for (let i = 0; i < tapAt.length; i++) if (!(i === 0 ? blocked(o, tap()) : blockedFrom(o, tapAt[i]))) clear++;
    memo.set(key, (v = clear / tapAt.length));
    return v;
  };
  if (tapAt.length === 1) return test;
  // the flame's centre alone: a face whose corners all agree on it lies clear of any shadow's edge, so the soft test
  // (seven taps) is run only on the faces an edge crosses (stage.js bakeStageLight)
  test.hard = (p, n) => {
    const key = keyOf(p, n);
    let v = memoHard.get(key);
    if (v === undefined) memoHard.set(key, (v = blocked(from(p, n), tap()) ? 0 : 1));
    return v;
  };
  return test;
}
